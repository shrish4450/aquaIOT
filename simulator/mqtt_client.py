"""
AQUA-NEXUS Simulator MQTT Communication Client
Manages telemetry publishing and incoming actuator command subscriptions.
"""

import json
import logging
from typing import Callable, Dict, Any, Optional
import paho.mqtt.client as mqtt

logger = logging.getLogger("AQUA-NEXUS-SIM-MQTT")


class SimulatorMQTTClient:
    def __init__(
        self,
        broker_host: str = "localhost",
        broker_port: int = 1883,
        client_id: str = "aqua-nexus-simulator",
        on_command_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.client_id = client_id
        self.on_command = on_command_callback
        self.is_connected = False

        # Support paho-mqtt v2.x CallbackAPIVersion
        try:
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self.client_id
            )
        except AttributeError:
            self.client = mqtt.Client(client_id=self.client_id)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.is_connected = True
            logger.info(f"Connected to MQTT Broker at {self.broker_host}:{self.broker_port}")
            # Subscribe to control and scenario topics
            subscriptions = [
                ("aqua-nexus/control/pump", 1),
                ("aqua-nexus/control/valve/+", 1),
                ("aqua-nexus/simulator/scenario", 1),
            ]
            for topic, qos in subscriptions:
                self.client.subscribe(topic, qos=qos)
                logger.info(f"Subscribed to control topic: {topic}")
        else:
            logger.error(f"MQTT Connection failed with return code {rc}")

    def _on_disconnect(self, client, userdata, rc, properties=None):
        self.is_connected = False
        logger.warning(f"Disconnected from MQTT Broker (rc={rc})")

    def _on_message(self, client, userdata, msg):
        topic = msg.topic
        payload_str = msg.payload.decode("utf-8", errors="ignore")
        logger.info(f"Received MQTT command on [{topic}]: {payload_str}")

        try:
            data = json.loads(payload_str)
        except json.JSONDecodeError:
            # Handle plain string payloads (e.g. "ON", "OFF", "OPEN", "CLOSED")
            data = {"state": payload_str.strip()}

        if self.on_command:
            self.on_command(topic, data)

    def connect(self):
        logger.info(f"Connecting to MQTT Broker {self.broker_host}:{self.broker_port}...")
        self.client.connect_async(self.broker_host, self.broker_port, keepalive=60)
        self.client.loop_start()

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
        self.is_connected = False

    def publish_json(self, topic: str, data: Dict[str, Any], qos: int = 0, retain: bool = False):
        if not self.is_connected:
            return
        payload = json.dumps(data)
        self.client.publish(topic, payload, qos=qos, retain=retain)
