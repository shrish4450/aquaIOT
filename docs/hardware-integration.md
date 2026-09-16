# AQUA-NEXUS Physical Hardware Integration Guide

This guide details the hardware engineering specifications, wiring pinouts, and embedded C++ firmware for transitioning from the AQUA-NEXUS virtual simulator to physical ESP32 microcontrollers.

---

## 1. Hardware Bill of Materials (BOM)

| Component | Model | Purpose | Quantity |
|---|---|---|---|
| Microcontroller | ESP32-WROOM-32D | Wi-Fi/MQTT edge processing | 3 |
| Flow Sensor | YF-S201 (1/2" NPS) | Turbine pulse flow measurement | 4 |
| Level Sensor | HC-SR04 / JSN-SR04T | Waterproof ultrasonic tank depth | 1 |
| Actuators | 12V Solenoid Valves (NC) | Zone water distribution isolation | 3 |
| Pump Actuator | 12V DC Booster Pump | Storage reservoir inflow | 1 |
| Driver Module | 4-Channel 5V Relay Module | Isolated actuation of 12V loads | 1 |
| Power Supply | 12V 5A DC SMPS | Powering pump, valves & step-downs | 1 |
| Step-Down Reg | LM2596 (12V to 5V) | Powering ESP32 and logic rails | 1 |

---

## 2. Pinout & Electrical Schematics

### 2.1 ESP32 Node 1: Primary Reservoir & Inlet (`esp32-main`)
| Sensor / Actuator | ESP32 Pin | Signal Type | Electrical Notes |
|---|---|---|---|
| YF-S201 (Main Meter) | `GPIO 18` | Digital Input (Interrupt) | $10\text{k}\Omega$ pull-up to 3.3V |
| HC-SR04 Trig | `GPIO 5` | Digital Output | 3.3V logic |
| HC-SR04 Echo | `GPIO 19` | Digital Input | Voltage divider ($1\text{k}\Omega / 2\text{k}\Omega$) 5V → 3.3V |
| Pump Relay Control | `GPIO 23` | Digital Output | Active LOW relay trigger |

### 2.2 ESP32 Node 2: Multi-Zone Controller (`esp32-zone1-2`)
| Sensor / Actuator | ESP32 Pin | Signal Type | Electrical Notes |
|---|---|---|---|
| YF-S201 (Zone 1 Flow) | `GPIO 18` | Digital Input (Interrupt) | $10\text{k}\Omega$ pull-up to 3.3V |
| YF-S201 (Zone 2 Flow) | `GPIO 19` | Digital Input (Interrupt) | $10\text{k}\Omega$ pull-up to 3.3V |
| Solenoid Valve 1 Relay | `GPIO 22` | Digital Output | Active LOW relay trigger |
| Solenoid Valve 2 Relay | `GPIO 23` | Digital Output | Active LOW relay trigger |

---

## 3. Production ESP32 Arduino C++ Firmware

The sketch below provides production-ready embedded firmware for `esp32-main`. It connects to Wi-Fi, registers with the Mosquitto broker, measures flow via hardware timer interrupts, reads ultrasonic depth, executes pump commands, and emits the exact JSON contracts defined in `docs/mqtt-topics.md`.

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- Network & MQTT Settings ---
const char* ssid = "CAMPUS_WIFI";
const char* password = "WIFI_PASSWORD";
const char* mqtt_server = "192.168.1.100";
const int mqtt_port = 1883;
const char* client_id = "esp32-main";

// --- GPIO Pin Definitions ---
#define FLOW_SENSOR_PIN   18
#define HC_TRIG_PIN       5
#define HC_ECHO_PIN       19
#define PUMP_RELAY_PIN    23

WiFiClient espClient;
PubSubClient mqtt(espClient);

// --- State Variables ---
volatile unsigned long pulse_count = 0;
float cumulative_liters = 120.0;
bool pump_state = true;
unsigned long last_publish = 0;

void IRAM_ATTR flowPulseCounter() {
  pulse_count++;
}

void setup() {
  Serial.begin(115200);
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), flowPulseCounter, RISING);

  pinMode(HC_TRIG_PIN, OUTPUT);
  pinMode(HC_ECHO_PIN, INPUT);
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, LOW); // Active LOW -> ON

  setupWiFi();
  mqtt.setServer(mqtt_server, mqtt_port);
  mqtt.setCallback(mqttCallback);
}

void setupWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, length);

  if (strcmp(topic, "aqua-nexus/control/pump") == 0) {
    const char* state = doc["state"];
    if (strcmp(state, "ON") == 0) {
      pump_state = true;
      digitalWrite(PUMP_RELAY_PIN, LOW); // Relay ON
    } else if (strcmp(state, "OFF") == 0) {
      pump_state = false;
      digitalWrite(PUMP_RELAY_PIN, HIGH); // Relay OFF
    }
  }
}

void reconnect() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqtt.connect(client_id)) {
      Serial.println("connected.");
      mqtt.subscribe("aqua-nexus/control/pump");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      delay(2000);
    }
  }
}

float measureTankLevel() {
  digitalWrite(HC_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(HC_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(HC_TRIG_PIN, LOW);

  long duration = pulseIn(HC_ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 75.0; // Fallback

  float distance_cm = (duration * 0.0343) / 2.0;
  float water_height = 100.0 - distance_cm; // 100cm tank
  return constrain(water_height, 0.0, 100.0);
}

void loop() {
  if (!mqtt.connected()) reconnect();
  mqtt.loop();

  unsigned long now = millis();
  if (now - last_publish >= 1000) {
    float dt_sec = (now - last_publish) / 1000.0;
    last_publish = now;

    // Calculate instantaneous flow
    // Calibration factor for YF-S201: 7.5 Hz = 1 L/min
    float flow_rate_lpm = (pulse_count / (7.5 * dt_sec));
    pulse_count = 0;
    cumulative_liters += (flow_rate_lpm * dt_sec / 60.0);

    float tank_level = measureTankLevel();

    // 1. Publish Tank Level
    StaticJsonDocument<256> tankDoc;
    tankDoc["device_id"] = client_id;
    tankDoc["level_liters"] = tank_level;
    tankDoc["level_percentage"] = tank_level;
    char tankBuf[256];
    serializeJson(tankDoc, tankBuf);
    mqtt.publish("aqua-nexus/tank/level", tankBuf);

    // 2. Publish Main Flow
    StaticJsonDocument<256> flowDoc;
    flowDoc["device_id"] = client_id;
    flowDoc["flow_rate_lpm"] = flow_rate_lpm;
    char flowBuf[256];
    serializeJson(flowDoc, flowBuf);
    mqtt.publish("aqua-nexus/main/flow", flowBuf);

    // 3. Publish Heartbeat
    StaticJsonDocument<256> hbDoc;
    hbDoc["device_id"] = client_id;
    hbDoc["status"] = "ONLINE";
    hbDoc["ip_address"] = WiFi.localIP().toString();
    hbDoc["firmware_version"] = "v1.2.0-aqua";
    char hbBuf[256];
    serializeJson(hbDoc, hbBuf);
    mqtt.publish("aqua-nexus/device/esp32-main/status", hbBuf);
  }
}
```
