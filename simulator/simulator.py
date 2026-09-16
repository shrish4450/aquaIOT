"""
AQUA-NEXUS Virtual IoT Multi-Sensor Simulator
Simulates physical ESP32 nodes communicating via MQTT telemetry and reacting to control commands.
"""

import argparse
import datetime
import logging
import os
import signal
import sys
import time
from typing import Dict, Any

from simulator.config import sim_config
from simulator.mqtt_client import SimulatorMQTTClient
from simulator.scenarios import ScenarioEngine, ScenarioType

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SIMULATOR] %(message)s"
)
logger = logging.getLogger("AQUA-NEXUS-SIMULATOR")


class AquaNexusSimulator:
    def __init__(self, host: str = None, port: int = None):
        self.broker_host = host or sim_config.broker_host
        self.broker_port = port or sim_config.broker_port
        self.running = False
        self.start_time = time.time()
        self.last_step_time = time.time()

        # Hydraulic State
        self.tank_level = sim_config.initial_tank_level_liters
        self.main_cumulative_liters = 120.0
        self.zone_cumulative_liters = {
            1: 22.5,
            2: 26.0,
            3: 18.0
        }

        # Actuator States
        self.pump_state = sim_config.default_pump_state
        self.valve_states = {
            1: sim_config.default_valve_state,
            2: sim_config.default_valve_state,
            3: sim_config.default_valve_state
        }

        # Physics & Scenarios
        self.scenario_engine = ScenarioEngine()

        # MQTT Client
        self.mqtt = SimulatorMQTTClient(
            broker_host=self.broker_host,
            broker_port=self.broker_port,
            client_id="aqua-nexus-virtual-nodes",
            on_command_callback=self.handle_incoming_command
        )

    def handle_incoming_command(self, topic: str, data: Dict[str, Any]):
        """Processes control signals received from MQTT broker."""
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if topic == "aqua-nexus/control/pump":
            new_state = data.get("state", "OFF").upper()
            if new_state in ("ON", "OFF"):
                self.pump_state = new_state
                logger.info(f"PUMP command executed -> {self.pump_state} (Reason: {data.get('reason', 'N/A')})")
                self.mqtt.publish_json("aqua-nexus/events", {
                    "event_type": "PUMP_CONTROL",
                    "details": f"Pump turned {self.pump_state} by controller",
                    "source": "SIMULATOR_ACTUATOR",
                    "timestamp": timestamp
                })

        elif topic.startswith("aqua-nexus/control/valve/"):
            try:
                zone_id = int(topic.split("/")[-1])
                new_state = data.get("state", "CLOSED").upper()
                if new_state in ("OPEN", "CLOSED") and zone_id in self.valve_states:
                    self.valve_states[zone_id] = new_state
                    logger.info(f"VALVE Zone {zone_id} command executed -> {new_state} (Reason: {data.get('reason', 'N/A')})")
                    self.mqtt.publish_json("aqua-nexus/events", {
                        "event_type": "VALVE_CONTROL",
                        "details": f"Zone {zone_id} valve turned {new_state} by controller",
                        "source": "SIMULATOR_ACTUATOR",
                        "timestamp": timestamp
                    })
            except ValueError:
                logger.warning(f"Invalid valve topic format: {topic}")

        elif topic == "aqua-nexus/simulator/scenario":
            requested = data.get("scenario", "NORMAL").upper()
            failed_sensor = data.get("failed_sensor", "zone_2")
            excessive_zone = int(data.get("zone_id", 2))
            self.scenario_engine.set_scenario(requested, failed_sensor=failed_sensor, excessive_zone=excessive_zone)
            logger.info(f"Switched simulation scenario to: {requested}")
            self.mqtt.publish_json("aqua-nexus/events", {
                "event_type": "SCENARIO_TRIGGERED",
                "details": f"Simulation scenario altered to {requested}",
                "source": "OPERATOR_DASHBOARD",
                "timestamp": timestamp
            })

    def run_step(self):
        now = time.time()
        dt = max(0.1, min(now - self.last_step_time, 5.0))
        self.last_step_time = now
        iso_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        uptime = int(now - self.start_time)

        # 1. Compute physical step
        step_result = self.scenario_engine.compute_step(
            current_tank_level=self.tank_level,
            pump_state=self.pump_state,
            valve_states=self.valve_states,
            dt_seconds=dt
        )

        self.tank_level = step_result["actual_tank_level"]

        # 2. Integrate cumulative volumes (Volume = Flow * dt / 60)
        main_flow = step_result["actual_main_flow"]
        self.main_cumulative_liters += main_flow * (dt / 60.0)

        for z_id, flow_val in step_result["actual_zone_flows"].items():
            self.zone_cumulative_liters[z_id] += flow_val * (dt / 60.0)

        # 3. Publish Telemetry via MQTT
        # A. Storage Tank Node (esp32-main)
        if step_result["tank_level"] is not None:
            self.mqtt.publish_json("aqua-nexus/tank/level", {
                "device_id": sim_config.device_main,
                "level_liters": round(self.tank_level, 2),
                "level_percentage": round(self.tank_level, 1),
                "raw_height_cm": round(100.0 - self.tank_level, 1),
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/tank/status", {
                "device_id": sim_config.device_main,
                "capacity_liters": sim_config.tank_capacity_liters,
                "pump_state": self.pump_state,
                "status": "NORMAL" if 20 <= self.tank_level <= 90 else ("HIGH" if self.tank_level > 90 else "LOW"),
                "timestamp": iso_timestamp
            })

        # B. Main Inlet Meter (esp32-main)
        if step_result["main_flow"] is not None:
            self.mqtt.publish_json("aqua-nexus/main/flow", {
                "device_id": sim_config.device_main,
                "flow_rate_lpm": step_result["main_flow"],
                "unit": "L/min",
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/main/total", {
                "device_id": sim_config.device_main,
                "total_volume_l": round(self.main_cumulative_liters, 2),
                "unit": "L",
                "timestamp": iso_timestamp
            })

        # C. Zone 1 & 2 Node (esp32-zone1-2)
        # Zone 1
        if step_result["zone_flows"][1] is not None:
            self.mqtt.publish_json("aqua-nexus/zone/1/flow", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 1,
                "flow_rate_lpm": step_result["zone_flows"][1],
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/1/total", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 1,
                "total_volume_l": round(self.zone_cumulative_liters[1], 2),
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/1/received", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 1,
                "water_received_l": round(self.zone_cumulative_liters[1] * 1.08, 2),
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/1/status", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 1,
                "valve_state": self.valve_states[1],
                "timestamp": iso_timestamp
            })

        # Zone 2 (Could be suppressed in SENSOR_FAILURE scenario)
        if step_result["zone_flows"][2] is not None:
            self.mqtt.publish_json("aqua-nexus/zone/2/flow", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 2,
                "flow_rate_lpm": step_result["zone_flows"][2],
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/2/total", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 2,
                "total_volume_l": round(self.zone_cumulative_liters[2], 2),
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/2/received", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 2,
                "water_received_l": round(self.zone_cumulative_liters[2] * 1.08, 2),
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/2/status", {
                "device_id": sim_config.device_zone1_2,
                "zone_id": 2,
                "valve_state": self.valve_states[2],
                "timestamp": iso_timestamp
            })

        # D. Zone 3 Node (esp32-zone3)
        if step_result["zone_flows"][3] is not None:
            self.mqtt.publish_json("aqua-nexus/zone/3/flow", {
                "device_id": sim_config.device_zone3,
                "zone_id": 3,
                "flow_rate_lpm": step_result["zone_flows"][3],
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/3/total", {
                "device_id": sim_config.device_zone3,
                "zone_id": 3,
                "total_volume_l": round(self.zone_cumulative_liters[3], 2),
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/3/received", {
                "device_id": sim_config.device_zone3,
                "zone_id": 3,
                "water_received_l": round(self.zone_cumulative_liters[3] * 1.08, 2),
                "timestamp": iso_timestamp
            })
            self.mqtt.publish_json("aqua-nexus/zone/3/status", {
                "device_id": sim_config.device_zone3,
                "zone_id": 3,
                "valve_state": self.valve_states[3],
                "timestamp": iso_timestamp
            })

        # E. Device Heartbeats (Every step or periodically)
        self.mqtt.publish_json(f"aqua-nexus/device/{sim_config.device_main}/status", {
            "device_id": sim_config.device_main,
            "status": "ONLINE",
            "ip_address": "192.168.1.101",
            "firmware_version": "v1.2.0-aqua",
            "uptime_seconds": uptime,
            "timestamp": iso_timestamp
        })

        # If Zone 2 sensor failed, esp32-zone1-2 can stop sending heartbeat or mark DEGRADED
        if "zone_2" in self.scenario_engine.failed_sensors:
            # Drop heartbeat to simulate node offline/watchdog trip
            pass
        else:
            self.mqtt.publish_json(f"aqua-nexus/device/{sim_config.device_zone1_2}/status", {
                "device_id": sim_config.device_zone1_2,
                "status": "ONLINE",
                "ip_address": "192.168.1.102",
                "firmware_version": "v1.2.0-aqua",
                "uptime_seconds": uptime,
                "timestamp": iso_timestamp
            })

        self.mqtt.publish_json(f"aqua-nexus/device/{sim_config.device_zone3}/status", {
            "device_id": sim_config.device_zone3,
            "status": "ONLINE",
            "ip_address": "192.168.1.103",
            "firmware_version": "v1.2.0-aqua",
            "uptime_seconds": uptime,
            "timestamp": iso_timestamp
        })

    def start(self):
        logger.info(f"Starting AQUA-NEXUS IoT Simulator on {self.broker_host}:{self.broker_port}")
        self.running = True
        self.mqtt.connect()

        # Wait briefly for MQTT connection
        time.sleep(1.0)
        logger.info("Simulator loop active. Publishing virtual ESP32 sensor telemetry...")

        try:
            while self.running:
                self.run_step()
                time.sleep(sim_config.publish_interval_sec)
        except KeyboardInterrupt:
            logger.info("Simulator stopped by user.")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        self.mqtt.disconnect()
        logger.info("Simulator shutdown complete.")


def main():
    parser = argparse.ArgumentParser(description="AQUA-NEXUS Virtual IoT Simulator")
    parser.add_argument("--host", default="localhost", help="MQTT broker hostname")
    parser.add_argument("--port", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--scenario", default="NORMAL", help="Initial scenario")
    args = parser.parse_args()

    sim = AquaNexusSimulator(host=args.host, port=args.port)
    if args.scenario != "NORMAL":
        sim.scenario_engine.set_scenario(args.scenario)

    def sig_handler(sig, frame):
        sim.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    sim.start()


if __name__ == "__main__":
    main()
