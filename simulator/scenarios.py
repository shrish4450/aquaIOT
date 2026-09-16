"""
AQUA-NEXUS Simulator Scenarios
Implements realistic dynamic physics models for all evaluation scenarios.
"""

import random
from enum import Enum
from typing import Dict, Any


class ScenarioType(str, Enum):
    NORMAL = "NORMAL"
    LEAK = "LEAK"
    OVERFLOW = "OVERFLOW"
    LOW_LEVEL = "LOW_LEVEL"
    EXCESSIVE_CONSUMPTION = "EXCESSIVE_CONSUMPTION"
    SENSOR_FAILURE = "SENSOR_FAILURE"


class ScenarioEngine:
    def __init__(self):
        self.current_scenario: ScenarioType = ScenarioType.NORMAL
        self.failed_sensors = set()
        self.excessive_zone_id: int = 2

    def set_scenario(self, scenario: str, failed_sensor: str = None, excessive_zone: int = 2):
        try:
            self.current_scenario = ScenarioType(scenario.upper())
        except ValueError:
            self.current_scenario = ScenarioType.NORMAL

        self.failed_sensors.clear()
        if self.current_scenario == ScenarioType.SENSOR_FAILURE:
            # By default, Zone 2 flow sensor goes silent
            self.failed_sensors.add(failed_sensor or "zone_2")

        if self.current_scenario == ScenarioType.EXCESSIVE_CONSUMPTION:
            self.excessive_zone_id = excessive_zone

    def compute_step(
        self,
        current_tank_level: float,
        pump_state: str,
        valve_states: Dict[int, str],
        dt_seconds: float
    ) -> Dict[str, Any]:
        """
        Calculates instantaneous flow rates and tank level delta based on the active scenario.
        """
        jitter = lambda base: max(0.0, base * (1.0 + random.uniform(-0.03, 0.03)))

        # Default normal rates
        z1_flow = jitter(1.0) if valve_states.get(1, "OPEN") == "OPEN" else 0.0
        z2_flow = jitter(1.2) if valve_states.get(2, "OPEN") == "OPEN" else 0.0
        z3_flow = jitter(0.8) if valve_states.get(3, "OPEN") == "OPEN" else 0.0

        # Pump determines inlet flow
        if pump_state == "ON":
            main_inflow = jitter(3.0)
        else:
            main_inflow = 0.0

        # Scenario overrides
        if self.current_scenario == ScenarioType.NORMAL:
            # Perfect hydraulic balance: Main inflow matches or slightly leads consumption
            if pump_state == "ON":
                main_inflow = max(0.1, (z1_flow + z2_flow + z3_flow) * (1.0 + random.uniform(-0.02, 0.02)))
            else:
                main_inflow = 0.0

        elif self.current_scenario == ScenarioType.LEAK:
            # Pipe rupture between main meter and distribution manifold:
            # Main flow indicates high volume (e.g., 5.2 L/min), but zones only sum to ~3.0 L/min.
            # Creates ~2.2 L/min unaccounted loss (~42%)!
            if pump_state == "ON":
                zone_sum = z1_flow + z2_flow + z3_flow
                main_inflow = zone_sum + jitter(2.2)
            else:
                main_inflow = 0.0

        elif self.current_scenario == ScenarioType.OVERFLOW:
            # Inlet pump pumping furiously, outflow throttled
            if pump_state == "ON":
                main_inflow = jitter(7.5)
            else:
                main_inflow = 0.0
            z1_flow *= 0.3
            z2_flow *= 0.3
            z3_flow *= 0.3

        elif self.current_scenario == ScenarioType.LOW_LEVEL:
            # Inlet pipe supply dried up / supply cut off, zones continue draining
            main_inflow = 0.0
            # Ensure significant outflow to rapidly reach critical tank level in demo
            z1_flow = max(1.5, z1_flow) if valve_states.get(1, "OPEN") == "OPEN" else 0.0
            z2_flow = max(2.0, z2_flow) if valve_states.get(2, "OPEN") == "OPEN" else 0.0
            z3_flow = max(1.5, z3_flow) if valve_states.get(3, "OPEN") == "OPEN" else 0.0

        elif self.current_scenario == ScenarioType.EXCESSIVE_CONSUMPTION:
            # Burst pipe or runaway tap in selected zone
            if self.excessive_zone_id == 1 and valve_states.get(1, "OPEN") == "OPEN":
                z1_flow = jitter(8.5)
            elif self.excessive_zone_id == 2 and valve_states.get(2, "OPEN") == "OPEN":
                z2_flow = jitter(8.5)
            elif self.excessive_zone_id == 3 and valve_states.get(3, "OPEN") == "OPEN":
                z3_flow = jitter(8.5)

            if pump_state == "ON":
                main_inflow = z1_flow + z2_flow + z3_flow

        # Calculate Tank Level Delta:
        # Rate of change = (Inflow - Outflow) in L/min
        # Volume change = (Inflow - Outflow) * (dt_seconds / 60)
        outflow_sum = z1_flow + z2_flow + z3_flow
        net_flow_rate_lpm = main_inflow - outflow_sum
        volume_delta = net_flow_rate_lpm * (dt_seconds / 60.0)

        # For demo purposes, speed up level shifts in OVERFLOW and LOW_LEVEL scenarios
        # so evaluators see results in seconds without waiting 30 minutes:
        if self.current_scenario == ScenarioType.OVERFLOW and pump_state == "ON":
            volume_delta = 1.8 * (dt_seconds / 1.0)
        elif self.current_scenario == ScenarioType.LOW_LEVEL:
            volume_delta = -1.8 * (dt_seconds / 1.0)

        new_tank_level = max(0.0, min(100.0, current_tank_level + volume_delta))

        # Check sensor failure suppression
        published_z1 = None if "zone_1" in self.failed_sensors else round(z1_flow, 2)
        published_z2 = None if "zone_2" in self.failed_sensors else round(z2_flow, 2)
        published_z3 = None if "zone_3" in self.failed_sensors else round(z3_flow, 2)
        published_main = None if "main" in self.failed_sensors else round(main_inflow, 2)
        published_tank = None if "tank" in self.failed_sensors else round(new_tank_level, 1)

        return {
            "scenario": self.current_scenario.value,
            "main_flow": published_main,
            "actual_main_flow": round(main_inflow, 2),
            "zone_flows": {
                1: published_z1,
                2: published_z2,
                3: published_z3
            },
            "actual_zone_flows": {
                1: round(z1_flow, 2),
                2: round(z2_flow, 2),
                3: round(z3_flow, 2)
            },
            "tank_level": published_tank,
            "actual_tank_level": round(new_tank_level, 2),
            "tank_level_pct": round(new_tank_level, 1),
            "outflow_sum": round(outflow_sum, 2)
        }
