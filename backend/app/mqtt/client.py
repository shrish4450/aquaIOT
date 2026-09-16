"""
AQUA-NEXUS Backend MQTT Ingestion Service
Listens to all IoT telemetry, validates payloads, persists time-series data,
runs detection checks, and triggers automated control responses.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import paho.mqtt.client as mqtt

from backend.app.config import settings
from backend.app.database import SyncSessionLocal
from backend.app.models.models import (
    Device,
    SensorReading,
    TankReading,
    Zone,
    utc_now
)
from backend.app.detection.engine import detection_engine
from backend.app.control.engine import control_engine

logger = logging.getLogger("AQUA-NEXUS-BACKEND-MQTT")


class BackendMQTTClient:
    def __init__(self):
        self.host = settings.mqtt_broker_host
        self.port = settings.mqtt_broker_port
        self.client_id = settings.mqtt_client_id
        self.is_connected = False
        self.ws_broadcast_callback = None

        try:
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self.client_id
            )
        except AttributeError:
            self.client = mqtt.Client(client_id=self.client_id)

        if settings.mqtt_username and settings.mqtt_password:
            self.client.username_pw_set(settings.mqtt_username, settings.mqtt_password)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

        # Wire control engine to publish via this client
        control_engine.set_mqtt_publisher(self.publish_message)

    def set_websocket_broadcaster(self, broadcaster_func):
        self.ws_broadcast_callback = broadcaster_func

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.is_connected = True
            logger.info(f"Backend MQTT Client connected to {self.host}:{self.port}")
            topics = [
                ("aqua-nexus/tank/#", 0),
                ("aqua-nexus/main/#", 0),
                ("aqua-nexus/zone/#", 0),
                ("aqua-nexus/device/#", 0),
                ("aqua-nexus/events", 0),
                ("aqua-nexus/alerts", 0),
            ]
            for topic, qos in topics:
                self.client.subscribe(topic, qos=qos)
                logger.info(f"Subscribed to: {topic}")
        else:
            logger.error(f"Failed to connect to MQTT broker, rc={rc}")

    def _on_disconnect(self, client, userdata, *args, **kwargs):
        self.is_connected = False
        logger.warning(f"Backend MQTT disconnected args={args}")

    def _on_message(self, client, userdata, msg):
        topic = msg.topic
        payload_raw = msg.payload.decode("utf-8", errors="ignore")

        try:
            payload = json.loads(payload_raw)
        except Exception as e:
            logger.warning(f"Malformed JSON payload on {topic}: {payload_raw} ({e})")
            return

        self.process_telemetry(topic, payload)

    def process_telemetry(self, topic: str, data: Dict[str, Any]):
        session = SyncSessionLocal()
        try:
            timestamp_str = data.get("timestamp")
            dt = datetime.fromisoformat(timestamp_str) if timestamp_str else utc_now()
            # Ensure tz aware
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)

            allocation_violations = {}

            # 1. Tank Level
            if topic == "aqua-nexus/tank/level":
                level = float(data.get("level_liters", 0.0))
                # Validate impossible tank values
                if level < 0.0 or level > (settings.tank_capacity_liters * 1.5):
                    logger.warning(f"Invalid tank level reading rejected: {level}")
                    return

                pct = float(data.get("level_percentage", (level / settings.tank_capacity_liters) * 100))
                raw_height = data.get("raw_height_cm")

                detection_engine.latest_tank_level = level
                detection_engine.latest_tank_pct = pct

                reading = TankReading(
                    timestamp=dt,
                    level_liters=round(level, 2),
                    level_percentage=round(pct, 1),
                    raw_height_cm=round(raw_height, 1) if raw_height is not None else None
                )
                session.add(reading)

                # Detection & Rules
                detection_engine.evaluate_tank_level(session, pct)
                control_engine.evaluate_rules(session, pct, allocation_violations)

            # 2. Main Inflow
            elif topic == "aqua-nexus/main/flow":
                flow = float(data.get("flow_rate_lpm", 0.0))
                if flow < 0.0:
                    flow = 0.0  # Sanitize negative flow

                detection_engine.latest_main_flow = flow
                session.add(SensorReading(
                    timestamp=dt,
                    device_id=data.get("device_id", "esp32-main"),
                    zone_id=None,
                    metric_type="flow_rate",
                    value=round(flow, 2),
                    unit="L/min"
                ))
                detection_engine.evaluate_flow_balance(session)

            elif topic == "aqua-nexus/main/total":
                total = float(data.get("total_volume_l", 0.0))
                if total >= 0.0:
                    detection_engine.latest_main_total = total

            # 3. Zone Telemetry
            elif topic.startswith("aqua-nexus/zone/"):
                parts = topic.split("/")
                if len(parts) >= 4:
                    zone_id = int(parts[2])
                    sub_metric = parts[3]

                    if sub_metric == "flow":
                        flow = float(data.get("flow_rate_lpm", 0.0))
                        if flow < 0.0:
                            flow = 0.0
                        detection_engine.latest_zone_flows[zone_id] = flow
                        session.add(SensorReading(
                            timestamp=dt,
                            device_id=data.get("device_id", f"esp32-zone{zone_id}"),
                            zone_id=zone_id,
                            metric_type="flow_rate",
                            value=round(flow, 2),
                            unit="L/min"
                        ))
                        detection_engine.evaluate_flow_balance(session)

                    elif sub_metric == "total":
                        total = float(data.get("total_volume_l", 0.0))
                        if total >= 0.0:
                            detection_engine.latest_zone_totals[zone_id] = total
                            alloc_obj, alert_obj = detection_engine.evaluate_zone_allocation(
                                session, zone_id, total
                            )
                            if not alloc_obj.water_received_liters or alloc_obj.water_received_liters <= 0:
                                alloc_obj.water_received_liters = round(total * 1.08, 2)
                            alloc_obj.zone_difference_liters = round(alloc_obj.water_received_liters - total, 2)
                            session.commit()

                            if alloc_obj.status == "EXCEEDED":
                                allocation_violations[zone_id] = "EXCEEDED"
                                control_engine.evaluate_rules(
                                    session,
                                    detection_engine.latest_tank_pct,
                                    allocation_violations
                                )

                    elif sub_metric == "received":
                        received_val = float(data.get("water_received_l", data.get("total_volume_l", 0.0)))
                        if received_val >= 0.0:
                            today_str = datetime.date.today().isoformat()
                            alloc_record = session.query(Allocation).filter_by(zone_id=zone_id, date=today_str).first()
                            if alloc_record:
                                alloc_record.water_received_liters = round(received_val, 2)
                                alloc_record.zone_difference_liters = round(received_val - alloc_record.consumed_liters, 2)
                                session.commit()

                    elif sub_metric == "status":
                        valve_state = data.get("valve_state")
                        if valve_state in ("OPEN", "CLOSED"):
                            control_engine.current_valve_states[zone_id] = valve_state
                            zone_record = session.query(Zone).filter_by(id=zone_id).first()
                            if zone_record:
                                zone_record.current_valve_state = valve_state

            # 4. Device Heartbeat
            elif topic.startswith("aqua-nexus/device/"):
                dev_id = data.get("device_id")
                if dev_id:
                    dev = session.query(Device).filter_by(id=dev_id).first()
                    if dev:
                        dev.status = data.get("status", "ONLINE")
                        dev.last_seen = dt
                        if "ip_address" in data:
                            dev.ip_address = data["ip_address"]
                        if "firmware_version" in data:
                            dev.firmware_version = data["firmware_version"]
                    else:
                        dev = Device(
                            id=dev_id,
                            name=f"ESP32 Node {dev_id}",
                            device_type="ESP32",
                            status=data.get("status", "ONLINE"),
                            last_seen=dt,
                            ip_address=data.get("ip_address", "192.168.1.100"),
                            firmware_version=data.get("firmware_version", "v1.2.0-aqua")
                        )
                        session.add(dev)

            session.commit()

            # Optional real-time WebSocket push
            if self.ws_broadcast_callback:
                self.ws_broadcast_callback({
                    "type": "TELEMETRY_UPDATE",
                    "topic": topic,
                    "data": data,
                    "timestamp": dt.isoformat()
                })

        except Exception as e:
            session.rollback()
            logger.error(f"Error processing telemetry [{topic}]: {e}", exc_info=True)
        finally:
            session.close()

    def publish_message(self, topic: str, data: Dict[str, Any], qos: int = 1):
        if not self.is_connected:
            logger.warning(f"Cannot publish [{topic}], MQTT not connected.")
            return
        payload = json.dumps(data)
        self.client.publish(topic, payload, qos=qos)
        logger.info(f"Dispatched MQTT message on [{topic}]: {payload}")

    def start(self):
        logger.info(f"Starting Backend MQTT client on {self.host}:{self.port}...")
        try:
            self.client.connect_async(self.host, self.port, keepalive=settings.mqtt_keepalive)
            self.client.loop_start()
        except Exception as e:
            logger.warning(f"Initial MQTT broker connection failed: {e}. Will retry automatically.")

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()
        self.is_connected = False
        logger.info("Backend MQTT client stopped.")


backend_mqtt = BackendMQTTClient()
