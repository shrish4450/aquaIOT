"""
AQUA-NEXUS IoT Sensor Simulator Configuration
Defines physical dimensions, virtual sensor specs, and default operating points.
"""

from pydantic import BaseModel


class SimulatorConfig(BaseModel):
    # MQTT Broker Connection
    broker_host: str = "localhost"
    broker_port: int = 1883
    client_id: str = "aqua-nexus-simulator-esp32"
    keepalive: int = 60

    # Simulation Physics & Loop Timing
    publish_interval_sec: float = 1.0  # Publishes telemetry every 1.0s
    tank_capacity_liters: float = 100.0
    initial_tank_level_liters: float = 75.0

    # Normal Operating Flow Rates (L/min)
    normal_main_inlet_flow: float = 3.0
    normal_zone1_flow: float = 1.0
    normal_zone2_flow: float = 1.2
    normal_zone3_flow: float = 0.8
    flow_jitter_pct: float = 0.05  # ±5% realistic noise

    # Allocations (L/day)
    zone1_allocation: float = 50.0
    zone2_allocation: float = 40.0
    zone3_allocation: float = 60.0

    # Actuator Defaults
    default_pump_state: str = "ON"
    default_valve_state: str = "OPEN"

    # Virtual ESP32 Device IDs
    device_main: str = "esp32-main"
    device_zone1_2: str = "esp32-zone1-2"
    device_zone3: str = "esp32-zone3"


sim_config = SimulatorConfig()
