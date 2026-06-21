/*
 * ============================================================
 *  CHUVEIRO ELÉTRICO INTELIGENTE - Firmware ESP32
 *  Comunicação MQTT com App Mobile (HiveMQ / broker gratuito)
 * ============================================================
 *
 *  BIBLIOTECAS NECESSÁRIAS (Arduino IDE > Gerenciador de Bibliotecas):
 *    - PubSubClient by Nick O'Leary
 *    - OneWire by Paul Stoffregen
 *    - DallasTemperature by Miles Burton
 *
 *  CONEXÕES DE HARDWARE:
 *
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  COMPONENTE          │  PINO ESP32  │  OBSERVAÇÃO       │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  Relé Principal      │  GPIO 26     │  LOW = desligado  │
 *  │  Triac/PWM Potência  │  GPIO 25     │  PWM 0-255        │
 *  │  ACS712 (Corrente)   │  GPIO 34     │  Entrada ADC only │
 *  │  Sensor Fuga (GFCI)  │  GPIO 35     │  Entrada ADC only │
 *  │  DS18B20 (Temp)      │  GPIO 4      │  OneWire bus      │
 *  │  LED Status          │  GPIO 2      │  LED onboard      │
 *  │  Botão Reset Prot.   │  GPIO 0      │  Pull-up interno  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  ESQUEMA ACS712-30A:
 *    - VCC → 5V (ou 3.3V com divisor)
 *    - GND → GND
 *    - OUT → GPIO 34
 *    - Sensibilidade: 66mV/A (modelo 30A)
 *    - Tensão em repouso (0A): VCC/2 = 2.5V
 *
 *  ESQUEMA DS18B20:
 *    - VCC → 3.3V
 *    - GND → GND
 *    - DATA → GPIO 4 (com resistor 4.7kΩ para VCC)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ============================================================
//  CONFIGURAÇÕES — ALTERE CONFORME SUA REDE E BROKER
// ============================================================

const char* WIFI_SSID     = "SUA_REDE_WIFI";
const char* WIFI_PASSWORD = "SUA_SENHA_WIFI";

// HiveMQ Public Broker (gratuito, sem autenticação)
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;

// Identificador único do dispositivo (deve coincidir com o App)
const char* DEVICE_ID     = "chuveiro_01";

// Limites de segurança
const float CURRENT_MAX_A       = 28.0f;   // Corrente máxima segura (A)
const float LEAKAGE_MAX_MA      = 30.0f;   // Fuga máxima tolerada (mA)
const float TEMP_DEFAULT_LIMIT  = 30.0f;   // Temperatura limite padrão (°C)

// Usar sensores reais ou simulados
#define USE_REAL_SENSORS  false

// ============================================================
//  PINOS
// ============================================================

#define PIN_RELAY           26
#define PIN_TRIAC_PWM       25
#define PIN_CURRENT_SENSOR  34   // ACS712 — ADC1 only
#define PIN_LEAKAGE_SENSOR  35   // Sensor de fuga — ADC1 only
#define PIN_TEMP_SENSOR     4    // DS18B20 OneWire
#define PIN_LED_STATUS      2
#define PIN_BTN_RESET       0

// PWM
#define PWM_CHANNEL  0
#define PWM_FREQ     5000
#define PWM_RES      8

// ACS712 calibração (ajuste conforme seu sensor)
#define ACS712_SENSITIVITY  0.066f   // 66 mV/A para modelo 30A
#define ACS712_VREF         3.3f
#define ACS712_ADC_MAX      4095.0f
#define ACS712_ZERO_POINT   1.65f    // Tensão em 0A (VCC/2 adaptado para 3.3V)

// ============================================================
//  TÓPICOS MQTT
// ============================================================

String topicStatus    = String("chuveiro/") + DEVICE_ID + "/status";
String topicTelemetry = String("chuveiro/") + DEVICE_ID + "/telemetry";
String topicCommand   = String("chuveiro/") + DEVICE_ID + "/command";
String topicAlert     = String("chuveiro/") + DEVICE_ID + "/alert";

// ============================================================
//  VARIÁVEIS GLOBAIS
// ============================================================

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
OneWire oneWire(PIN_TEMP_SENSOR);
DallasTemperature tempSensor(&oneWire);

// Estado do chuveiro
struct ShowerState {
  bool  powerOn          = false;
  int   powerLevel       = 50;       // 0-100%
  bool  autoTempEnabled  = false;
  float tempLimit        = TEMP_DEFAULT_LIMIT;
  bool  protectionActive = false;
  String protectionReason = "";
} state;

// Leituras dos sensores
struct SensorData {
  float current    = 0.0f;   // Amperes
  float leakage    = 0.0f;   // miliAmperes
  float temperature = 25.0f; // Celsius
  float resistance = 0.0f;   // Ohms (calculado)
} sensors;

// Timers
unsigned long lastTelemetryMs  = 0;
unsigned long lastSensorReadMs = 0;
const unsigned long TELEMETRY_INTERVAL  = 2000;  // ms
const unsigned long SENSOR_READ_INTERVAL = 500;  // ms

// ============================================================
//  PROTÓTIPOS
// ============================================================

void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void readSensors();
void applyProtection();
void setRelay(bool on);
void setPowerLevel(int level);
void publishTelemetry();
void publishAlert(const char* reason);
void handleCommand(JsonDocument& doc);
float readCurrentACS712();
float readLeakageSensor();
float readTemperatureDS18B20();
float calculateResistance();

// ============================================================
//  SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Chuveiro Inteligente ESP32 ===");

  // Configurar pinos
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_BTN_RESET, INPUT_PULLUP);
  pinMode(PIN_CURRENT_SENSOR, INPUT);
  pinMode(PIN_LEAKAGE_SENSOR, INPUT);

  // Relé desligado por padrão (LOW = desligado)
  digitalWrite(PIN_RELAY, LOW);
  digitalWrite(PIN_LED_STATUS, LOW);

  // Configurar PWM para controle de potência (Triac)
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_TRIAC_PWM, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0);

  // Inicializar sensor de temperatura
  tempSensor.begin();

  setupWiFi();
  setupMQTT();

  Serial.println("Sistema iniciado. Aguardando comandos...");
}

// ============================================================
//  LOOP PRINCIPAL
// ============================================================

void loop() {
  // Manter conexão MQTT
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Botão físico para resetar proteção
  if (digitalRead(PIN_BTN_RESET) == LOW) {
    delay(50); // Debounce
    if (digitalRead(PIN_BTN_RESET) == LOW && state.protectionActive) {
      state.protectionActive = false;
      state.protectionReason = "";
      Serial.println("Proteção resetada via botão.");
      publishTelemetry();
    }
    while (digitalRead(PIN_BTN_RESET) == LOW) delay(10);
  }

  unsigned long now = millis();

  // Leitura de sensores
  if (now - lastSensorReadMs >= SENSOR_READ_INTERVAL) {
    lastSensorReadMs = now;
    readSensors();
    applyProtection();
  }

  // Publicar telemetria periodicamente
  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL) {
    lastTelemetryMs = now;
    publishTelemetry();
  }

  // LED de status
  if (state.protectionActive) {
    digitalWrite(PIN_LED_STATUS, (now / 300) % 2); // Pisca rápido
  } else if (state.powerOn) {
    digitalWrite(PIN_LED_STATUS, HIGH);
  } else {
    digitalWrite(PIN_LED_STATUS, LOW);
  }
}

// ============================================================
//  Wi-Fi
// ============================================================

void setupWiFi() {
  Serial.printf("Conectando ao Wi-Fi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWi-Fi conectado! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nFalha ao conectar Wi-Fi. Tentando novamente no loop...");
  }
}

// ============================================================
//  MQTT
// ============================================================

void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
    return;
  }

  while (!mqttClient.connected()) {
    Serial.print("Conectando MQTT...");

    String clientId = String("esp32_") + DEVICE_ID;

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(" conectado!");
      mqttClient.subscribe(topicCommand.c_str(), 1);
      Serial.printf("Inscrito em: %s\n", topicCommand.c_str());
      publishTelemetry();
    } else {
      Serial.printf(" falhou, rc=%d. Tentando em 5s...\n", mqttClient.state());
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[512];
  if (length >= sizeof(message)) length = sizeof(message) - 1;
  memcpy(message, payload, length);
  message[length] = '\0';

  Serial.printf("MQTT recebido [%s]: %s\n", topic, message);

  StaticJsonDocument<384> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.printf("Erro JSON: %s\n", error.c_str());
    return;
  }

  handleCommand(doc);
}

void handleCommand(JsonDocument& doc) {
  if (doc.containsKey("power")) {
    bool requested = doc["power"];
    if (requested && !state.protectionActive) {
      state.powerOn = true;
      setRelay(true);
      setPowerLevel(state.powerLevel);
    } else if (!requested) {
      state.powerOn = false;
      setRelay(false);
      setPowerLevel(0);
    }
  }

  if (doc.containsKey("power_level")) {
    state.powerLevel = constrain(doc["power_level"].as<int>(), 0, 100);
    if (state.powerOn && !state.protectionActive) {
      setPowerLevel(state.powerLevel);
    }
  }

  if (doc.containsKey("auto_temp_enabled")) {
    state.autoTempEnabled = doc["auto_temp_enabled"];
  }

  if (doc.containsKey("temp_limit")) {
    state.tempLimit = constrain(doc["temp_limit"].as<float>(), 20.0f, 60.0f);
  }

  if (doc.containsKey("reset_protection") && doc["reset_protection"].as<bool>()) {
    state.protectionActive = false;
    state.protectionReason = "";
    Serial.println("Proteção resetada via App.");
  }

  publishTelemetry();
}

// ============================================================
//  SENSORES
// ============================================================

void readSensors() {
#if USE_REAL_SENSORS
  sensors.current     = readCurrentACS712();
  sensors.leakage     = readLeakageSensor();
  sensors.temperature = readTemperatureDS18B20();
#else
  // Sensores simulados para testes sem hardware
  if (state.powerOn && !state.protectionActive) {
    sensors.current     = (state.powerLevel / 100.0f) * 25.0f + random(-10, 10) / 10.0f;
    sensors.leakage     = random(0, 80) / 10.0f;
    sensors.temperature = 22.0f + (state.powerLevel / 100.0f) * 18.0f + random(-5, 15) / 10.0f;
  } else {
    sensors.current     = random(0, 5) / 100.0f;
    sensors.leakage     = random(0, 20) / 10.0f;
    sensors.temperature = 22.0f + random(-3, 3) / 10.0f;
  }
#endif

  sensors.resistance = calculateResistance();
}

float readCurrentACS712() {
  // Média de 64 amostras para reduzir ruído
  long sum = 0;
  for (int i = 0; i < 64; i++) {
    sum += analogRead(PIN_CURRENT_SENSOR);
    delayMicroseconds(150);
  }
  float avgADC = sum / 64.0f;
  float voltage = (avgADC / ACS712_ADC_MAX) * ACS712_VREF;
  float current = (voltage - ACS712_ZERO_POINT) / ACS712_SENSITIVITY;
  return abs(current);
}

float readLeakageSensor() {
  int raw = analogRead(PIN_LEAKAGE_SENSOR);
  float voltage = (raw / ACS712_ADC_MAX) * ACS712_VREF;
  // Converter tensão para mA (ajuste conforme seu sensor de fuga)
  float leakage_mA = (voltage / ACS712_VREF) * 100.0f;
  return leakage_mA;
}

float readTemperatureDS18B20() {
  tempSensor.requestTemperatures();
  float temp = tempSensor.getTempCByIndex(0);
  if (temp == DEVICE_DISCONNECTED_C) {
    return sensors.temperature; // Manter último valor válido
  }
  return temp;
}

float calculateResistance() {
  if (!state.powerOn || sensors.current < 0.1f) return 0.0f;
  // P = V * I, R = V / I — assumindo 220V
  const float MAINS_VOLTAGE = 220.0f;
  return MAINS_VOLTAGE / sensors.current;
}

// ============================================================
//  PROTEÇÃO ELÉTRICA (Rotina Interrompível)
// ============================================================

void applyProtection() {
  if (state.protectionActive) {
    setRelay(false);
    setPowerLevel(0);
    state.powerOn = false;
    return;
  }

  // Verificar sobrecorrente
  if (state.powerOn && sensors.current > CURRENT_MAX_A) {
    state.protectionActive = true;
    state.protectionReason = "Sobrecarga — corrente acima de " + String(CURRENT_MAX_A) + "A";
    setRelay(false);
    setPowerLevel(0);
    state.powerOn = false;
    publishAlert(state.protectionReason.c_str());
    Serial.println("!!! PROTEÇÃO: Sobrecorrente !!!");
    return;
  }

  // Verificar fuga de corrente
  if (sensors.leakage > LEAKAGE_MAX_MA) {
    state.protectionActive = true;
    state.protectionReason = "Fuga de corrente detectada — " + String(sensors.leakage, 1) + " mA";
    setRelay(false);
    setPowerLevel(0);
    state.powerOn = false;
    publishAlert(state.protectionReason.c_str());
    Serial.println("!!! PROTEÇÃO: Fuga de corrente !!!");
    return;
  }

  // Desligamento automático por temperatura
  if (state.autoTempEnabled && state.powerOn &&
      sensors.temperature >= state.tempLimit) {
    state.powerOn = false;
    setRelay(false);
    setPowerLevel(0);
    Serial.printf("Desligado: temperatura %.1f°C >= limite %.1f°C\n",
                  sensors.temperature, state.tempLimit);
  }
}

// ============================================================
//  ATUADORES
// ============================================================

void setRelay(bool on) {
  digitalWrite(PIN_RELAY, on ? HIGH : LOW);
  Serial.printf("Relé: %s\n", on ? "LIGADO" : "DESLIGADO");
}

void setPowerLevel(int level) {
  level = constrain(level, 0, 100);
  // Mapear 0-100% para duty cycle PWM (0-255)
  int pwmValue = map(level, 0, 100, 0, 255);
  ledcWrite(PWM_CHANNEL, pwmValue);
  Serial.printf("Potência PWM: %d%% (duty=%d)\n", level, pwmValue);
}

// ============================================================
//  PUBLICAÇÃO MQTT
// ============================================================

void publishTelemetry() {
  StaticJsonDocument<512> doc;

  doc["power"]              = state.powerOn;
  doc["power_level"]        = state.powerLevel;
  doc["auto_temp_enabled"]  = state.autoTempEnabled;
  doc["temp_limit"]         = state.tempLimit;
  doc["protection_active"]  = state.protectionActive;
  doc["protection_reason"]  = state.protectionReason;
  doc["current"]            = round(sensors.current * 100) / 100.0;
  doc["leakage"]            = round(sensors.leakage * 10) / 10.0;
  doc["temperature"]        = round(sensors.temperature * 10) / 10.0;
  doc["resistance"]         = round(sensors.resistance * 10) / 10.0;
  doc["uptime"]             = millis() / 1000;
  doc["rssi"]               = WiFi.RSSI();

  char buffer[512];
  serializeJson(doc, buffer);
  mqttClient.publish(topicTelemetry.c_str(), buffer, true);
}

void publishAlert(const char* reason) {
  StaticJsonDocument<256> doc;
  doc["reason"]   = reason;
  doc["timestamp"] = millis();
  doc["current"]  = sensors.current;
  doc["leakage"]  = sensors.leakage;

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(topicAlert.c_str(), buffer, 1);
  publishTelemetry();
}
