# AQUA-NEXUS MQTT Broker & Messaging Subsystem

This directory contains the MQTT broker configuration and runner for local development and hardware production testing.

## Mosquitto Configuration

`mosquitto.conf` configures:
- TCP Port: `1883`
- Anonymous access: Enabled for local lab/development
- Logging: Verbose connection, subscribe, and publish events

## Running Mosquitto

### Option A: System Mosquitto (if installed)
```bash
mosquitto -c mqtt/mosquitto.conf -v
```

### Option B: Universal Embedded Broker (Zero External Dependencies)
If Mosquitto is not installed on your machine, AQUA-NEXUS provides an embedded pure-Python MQTT 3.1.1 broker runner:
```bash
python mqtt/broker_runner.py
```
This listens on port `1883` and supports full MQTT 3.1.1 semantics (QoS 0/1, topic wildcards `+` and `#`, retained messages, and keepalive).
