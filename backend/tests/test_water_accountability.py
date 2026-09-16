"""
Tests for Water Accountability Calculations and Leakage Classification.
"""

import pytest
from backend.app.detection.engine import DetectionEngine


def test_accountability_normal():
    # Incoming = 100L, Zones = 98L -> Unaccounted = 2L (2.0%) -> NORMAL
    result = DetectionEngine.calculate_accountability(
        total_incoming=100.0,
        total_consumed=98.0,
        warning_thresh_pct=5.0,
        leak_thresh_pct=10.0
    )
    assert result["total_incoming_liters"] == 100.0
    assert result["total_consumed_liters"] == 98.0
    assert result["unaccounted_liters"] == 2.0
    assert result["unaccounted_percentage"] == 2.0
    assert result["status"] == "NORMAL"


def test_accountability_warning():
    # Incoming = 100L, Zones = 93L -> Unaccounted = 7L (7.0%) -> WARNING
    result = DetectionEngine.calculate_accountability(
        total_incoming=100.0,
        total_consumed=93.0,
        warning_thresh_pct=5.0,
        leak_thresh_pct=10.0
    )
    assert result["unaccounted_percentage"] == 7.0
    assert result["status"] == "WARNING"


def test_accountability_possible_leak():
    # Incoming = 100L, Zones = 85L -> Unaccounted = 15L (15.0%) -> POSSIBLE_LEAK
    result = DetectionEngine.calculate_accountability(
        total_incoming=100.0,
        total_consumed=85.0,
        warning_thresh_pct=5.0,
        leak_thresh_pct=10.0
    )
    assert result["unaccounted_percentage"] == 15.0
    assert result["status"] == "POSSIBLE_LEAK"


def test_accountability_critical_leak():
    # Incoming = 100L, Zones = 60L -> Unaccounted = 40L (40.0%) -> CRITICAL
    result = DetectionEngine.calculate_accountability(
        total_incoming=100.0,
        total_consumed=60.0,
        warning_thresh_pct=5.0,
        leak_thresh_pct=10.0
    )
    assert result["unaccounted_percentage"] == 40.0
    assert result["status"] == "CRITICAL"


def test_accountability_zero_incoming_division_safe():
    # Test division by zero safety
    result = DetectionEngine.calculate_accountability(
        total_incoming=0.0,
        total_consumed=0.0
    )
    assert result["unaccounted_liters"] == 0.0
    assert result["unaccounted_percentage"] == 0.0
    assert result["status"] == "NORMAL"


def test_accountability_negative_consumed_safe():
    # If consumed slightly exceeds incoming due to sensor drift, unaccounted clamped to 0.0
    result = DetectionEngine.calculate_accountability(
        total_incoming=50.0,
        total_consumed=51.0
    )
    assert result["unaccounted_liters"] == 0.0
    assert result["unaccounted_percentage"] == 0.0
    assert result["status"] == "NORMAL"
