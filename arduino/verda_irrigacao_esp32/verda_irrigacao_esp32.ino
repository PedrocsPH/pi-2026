/*
 * ============================================================================
 * PLATAFORMA VERDA — FIRMWARE DE IRRIGAÇÃO INTELIGENTE (ESP32 / ESP8266)
 * ============================================================================
 * Este código conecta o seu microcontrolador (ESP32 ou ESP8266 NodeMCU,
 * programado na Arduino IDE) diretamente ao backend Spring Boot da Plataforma
 * Verda (pi-2026).
 *
 * O QUE ESTE FIRMWARE FAZ:
 * 1. Lê os sensores (Umidade do Solo, Temperatura DHT, Nível de Água e pH).
 *    - Possui modo de teste (SIMULAR_SENSORES_FALTANTES = true) caso você ainda
 *      não tenha todos os sensores plugados na protoboard.
 * 2. Envia os dados periodicamente via HTTP POST para:
 *      http://<IP_DO_SERVIDOR>:8080/api/ingest/<DEVICE_ID>/readings
 *    no formato exato esperado pelo backend:
 *      { "moisture": 62.5, "temperature": 24.8, "water": 80.0, "ph": 6.5 }
 * 3. Consulta o estado/comando da bomba a cada 3 segundos para saber se você
 *    clicou em "Iniciar irrigação" ou "Interromper irrigação" pelo CELULAR
 *    ou pelo computador, ou se uma programação de rega iniciou.
 * 4. Aciona o Relé / Bomba d'água (com suporte tanto a Relé LIGA/DESLIGA quanto
 *    a controle de potência PWM conforme o Regime de Chuva:
 *    garoa = 30%, leve = 50%, moderada = 75%, forte = 100%).
 *
 * BIBLIOTECAS NECESSÁRIAS NA ARDUINO IDE:
 * - Placa ESP32 ou ESP8266 instalada no Gerenciador de Placas
 * - "DHT sensor library" (by Adafruit) + "Adafruit Unified Sensor" (se usar DHT11/DHT22)
 * ============================================================================
 */

#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClient.h>
#else
  #error "Selecione uma placa com Wi-Fi (ESP32 ou ESP8266/NodeMCU) na Arduino IDE!"
#endif

// Descomente a linha abaixo quando estiver com o sensor DHT11/DHT22 conectado:
// #define USAR_SENSOR_DHT

#ifdef USAR_SENSOR_DHT
  #include <DHT.h>
#endif

// ============================================================================
// 1. CONFIGURAÇÕES DE REDE E DO DISPOSITIVO (AJUSTE AQUI!)
// ============================================================================
const char* WIFI_SSID     = "NOME_DO_SEU_WIFI";
const char* WIFI_PASSWORD = "SENHA_DO_SEU_WIFI";

// Coloque aqui o IPv4 do computador onde o backend Spring Boot está rodando
// (No Windows, abra o cmd e digite: ipconfig -> Endereço IPv4, ex: 192.168.1.100)
const char* SERVER_IP     = "192.168.1.100";
const int   SERVER_PORT   = 8080;

// ID do dispositivo cadastrado na Plataforma Verda (ex.: ARD-IRR-0421 = Horta Norte)
const char* DEVICE_ID     = "ARD-IRR-0421";

// Se você definiu INGEST_API_KEY no backend, preencha abaixo (por padrão fica vazio "")
const char* DEVICE_API_KEY = "";

// Se true, usa valores simulados estáveis para sensores que você ainda não conectou
const bool  USAR_SIMULACAO_SENSORES_OPCIONAIS = true;

// ============================================================================
// 2. PINAGEM NO ESP32 (Ajuste conforme sua montagem na protoboard)
// ============================================================================
#if defined(ESP32)
  const int PIN_SOIL_MOISTURE = 34; // Pino analógico (ADC1) do sensor de umidade do solo
  const int PIN_WATER_LEVEL   = 35; // Pino analógico (ADC1) do sensor de nível de água (ou boia)
  const int PIN_PH_SENSOR     = 32; // Pino analógico (ADC1) da sonda de pH (opcional)
  const int PIN_DHT           = 4;  // Pino digital de dados do sensor DHT11/DHT22
  const int PIN_PUMP_RELAY    = 26; // Pino que aciona o Módulo Relé ou Ponte H/MOSFET da bomba
  const int PIN_LED_STATUS    = 2;  // LED onboard do ESP32 (acende quando a bomba está ligada)
#else // ESP8266 (NodeMCU)
  const int PIN_SOIL_MOISTURE = A0; // Pino analógico único do ESP8266
  const int PIN_WATER_LEVEL   = D5; // Entrada digital (boia de nível) no ESP8266
  const int PIN_PH_SENSOR     = A0;
  const int PIN_DHT           = D4;
  const int PIN_PUMP_RELAY    = D1; // Pino do Relé da bomba
  const int PIN_LED_STATUS    = D2;
#endif

// Configuração do Relé / Bomba:
// Módulos relé comuns acionam com sinal LOW (ativo em nível baixo).
// Se você usar um módulo relé ativo em LOW, deixe RELE_ATIVO_EM_LOW = true.
// Se usar um MOSFET / Ponte H com controle de velocidade PWM, mude USAR_PWM_BOMBA = true.
const bool RELE_ATIVO_EM_LOW = true;
const bool USAR_PWM_BOMBA    = false;

// Calibração do sensor de umidade do solo (ADC de 12 bits no ESP32: 0 a 4095)
// Coloque o sensor no ar seco e veja o valor no Monitor Serial (ex: 3300)
// Coloque o sensor em um copo com água e veja o valor (ex: 1300)
const int ADC_SOLO_SECO  = 3300;
const int ADC_SOLO_UMIDO = 1300;

#ifdef USAR_SENSOR_DHT
  #define DHTTYPE DHT11   // Mude para DHT22 se o seu sensor for o branco (DHT22)
  DHT dht(PIN_DHT, DHTTYPE);
#endif

// ============================================================================
// 3. VARIÁVEIS DE CONTROLE E TEMPORIZAÇÃO
// ============================================================================
unsigned long ultimoEnvioLeituraMs   = 0;
unsigned long ultimaConsultaBombaMs  = 0;

const unsigned long INTERVALO_LEITURA_MS = 10000; // Envia dados ao site a cada 10 segundos
const unsigned long INTERVALO_COMANDO_MS = 3000;  // Checa comandos do celular/site a cada 3 segundos

bool   bombaLigadaAtual = false;
int    potenciaBombaPct = 0;
String regimeAtual      = "moderada";
int    limiteUmidadeMin = 40;
bool   irrigacaoAuto    = true;

// ============================================================================
// 4. FUNÇÕES AUXILIARES DE LEITURA DE SENSORES
// ============================================================================

float lerUmidadeSoloPercentual() {
  // Faz média de 10 leituras para reduzir ruído elétrico
  long soma = 0;
  for (int i = 0; i < 10; i++) {
    soma += analogRead(PIN_SOIL_MOISTURE);
    delay(5);
  }
  int leituraBruta = soma / 10;

  // Se o pino estiver desconectado/flutuando e a simulação estiver ativa:
  if (USAR_SIMULACAO_SENSORES_OPCIONAIS && (leituraBruta == 0 || leituraBruta >= 4090)) {
    return bombaLigadaAtual ? 64.0 : 48.5;
  }

  // Converte a leitura analógica em porcentagem (0% = seco, 100% = muito úmido)
  float pct = map(leituraBruta, ADC_SOLO_SECO, ADC_SOLO_UMIDO, 0, 100);
  if (pct < 0.0) pct = 0.0;
  if (pct > 100.0) pct = 100.0;
  return pct;
}

float lerTemperaturaC() {
#ifdef USAR_SENSOR_DHT
  float t = dht.readTemperature();
  if (!isnan(t) && t > -10.0 && t < 70.0) {
    return t;
  }
#endif
  // Valor padrão caso o DHT ainda não esteja conectado
  return 25.4;
}

float lerNivelAguaPercentual() {
  if (USAR_SIMULACAO_SENSORES_OPCIONAIS) {
    return 82.0; // Caso ainda não tenha sensor no reservatório, envia 82% (nível bom)
  }
#if defined(ESP32)
  int raw = analogRead(PIN_WATER_LEVEL);
  float pct = map(raw, 0, 4095, 0, 100);
  return constrain(pct, 0.0, 100.0);
#else
  return digitalRead(PIN_WATER_LEVEL) == HIGH ? 85.0 : 20.0;
#endif
}

float lerPhSolo() {
  if (USAR_SIMULACAO_SENSORES_OPCIONAIS) {
    return 6.4; // Valor dentro da faixa ideal (5.5 a 7.0) caso não tenha sonda de pH
  }
  int raw = analogRead(PIN_PH_SENSOR);
  float tensao = raw * (3.3 / 4095.0);
  float ph = 7.0 + ((2.5 - tensao) / 0.18);
  return constrain(ph, 3.5, 9.5);
}

// ============================================================================
// 5. ACIONAMENTO FÍSICO DA BOMBA / RELÉ
// ============================================================================

int potenciaPorRegime(const String& regime) {
  if (regime == "garoa")    return 30;
  if (regime == "leve")     return 50;
  if (regime == "moderada") return 75;
  if (regime == "forte")    return 100;
  return 75;
}

void aplicarEstadoBomba(bool ligar, int potenciaPct, const String& regime) {
  if (ligar != bombaLigadaAtual || potenciaPct != potenciaBombaPct || regime != regimeAtual) {
    bombaLigadaAtual = ligar;
    potenciaBombaPct = ligar ? potenciaPct : 0;
    regimeAtual      = regime;

    Serial.println("=========================================");
    if (bombaLigadaAtual) {
      Serial.print("[BOMBA] LIGADA! Regime: ");
      Serial.print(regimeAtual);
      Serial.print(" | Potencia: ");
      Serial.print(potenciaBombaPct);
      Serial.println("%");
    } else {
      Serial.println("[BOMBA] DESLIGADA.");
    }
    Serial.println("=========================================");
  }

  digitalWrite(PIN_LED_STATUS, bombaLigadaAtual ? HIGH : LOW);

  if (USAR_PWM_BOMBA) {
    int dutyCycle = bombaLigadaAtual ? map(potenciaBombaPct, 0, 100, 0, 255) : 0;
    analogWrite(PIN_PUMP_RELAY, dutyCycle);
  } else {
    if (RELE_ATIVO_EM_LOW) {
      digitalWrite(PIN_PUMP_RELAY, bombaLigadaAtual ? LOW : HIGH);
    } else {
      digitalWrite(PIN_PUMP_RELAY, bombaLigadaAtual ? HIGH : LOW);
    }
  }
}

// ============================================================================
// 6. PARSER SIMPLES DE JSON (Sem depender de versão específica do ArduinoJson)
// ============================================================================

bool extrairBoolJson(const String& json, const char* chave, bool valorPadrao) {
  String padrao = String("\"") + chave + "\":";
  int idx = json.indexOf(padrao);
  if (idx < 0) return valorPadrao;
  idx += padrao.length();
  while (idx < (int)json.length() && json[idx] == ' ') idx++;
  if (json.substring(idx).startsWith("true"))  return true;
  if (json.substring(idx).startsWith("false")) return false;
  return valorPadrao;
}

int extrairIntJson(const String& json, const char* chave, int valorPadrao) {
  String padrao = String("\"") + chave + "\":";
  int idx = json.indexOf(padrao);
  if (idx < 0) return valorPadrao;
  idx += padrao.length();
  while (idx < (int)json.length() && json[idx] == ' ') idx++;
  int fim = idx;
  while (fim < (int)json.length() && (isDigit(json[fim]) || json[fim] == '-')) fim++;
  if (fim == idx) return valorPadrao;
  return json.substring(idx, fim).toInt();
}

String extrairStringJson(const String& json, const char* chave, const String& valorPadrao) {
  String padrao = String("\"") + chave + "\":";
  int idx = json.indexOf(padrao);
  if (idx < 0) return valorPadrao;
  idx += padrao.length();
  while (idx < (int)json.length() && json[idx] == ' ') idx++;
  if (json.substring(idx).startsWith("null")) return valorPadrao;
  if (json[idx] != '"') return valorPadrao;
  idx++;
  int fim = json.indexOf('"', idx);
  if (fim < 0) return valorPadrao;
  return json.substring(idx, fim);
}

void processarRespostaEstado(const String& payload) {
  if (payload.length() < 5) return;

  bool irrigating = extrairBoolJson(payload, "irrigating", bombaLigadaAtual);
  limiteUmidadeMin = extrairIntJson(payload, "minMoisture", limiteUmidadeMin);
  irrigacaoAuto    = extrairBoolJson(payload, "autoIrrigation", irrigacaoAuto);

  String regime = extrairStringJson(payload, "regime", "");
  if (regime.length() == 0) {
    regime = extrairStringJson(payload, "irrigationRegime", "");
  }
  if (regime.length() == 0) {
    regime = extrairStringJson(payload, "defaultRegime", "moderada");
  }

  int pumpPower = extrairIntJson(payload, "pumpPower", -1);
  if (pumpPower < 0) {
    pumpPower = irrigating ? potenciaPorRegime(regime) : 0;
  }

  aplicarEstadoBomba(irrigating, pumpPower, regime);
}

// ============================================================================
// 7. COMUNICAÇÃO HTTP COM O BACKEND DA PLATAFORMA VERDA
// ============================================================================

String montarUrl(const String& caminho) {
  return String("http://") + SERVER_IP + ":" + String(SERVER_PORT) + caminho;
}

void enviarLeiturasSensores() {
  if (WiFi.status() != WL_CONNECTED) return;

  float moisture    = lerUmidadeSoloPercentual();
  float temperature = lerTemperaturaC();
  float water       = lerNivelAguaPercentual();
  float ph          = lerPhSolo();

  String url = montarUrl(String("/api/ingest/") + DEVICE_ID + "/readings");
  String body = String("{") +
                "\"moisture\":" + String(moisture, 1) + "," +
                "\"temperature\":" + String(temperature, 1) + "," +
                "\"water\":" + String(water, 1) + "," +
                "\"ph\":" + String(ph, 2) +
                "}";

  WiFiClient client;
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_API_KEY) > 0) {
    http.addHeader("X-Device-Key", DEVICE_API_KEY);
  }

  int httpCode = http.POST(body);
  if (httpCode > 0) {
    String resposta = http.getString();
    Serial.print("[POST Leituras] Status HTTP ");
    Serial.print(httpCode);
    Serial.print(" | Enviado: ");
    Serial.println(body);

    // Se o backend já devolver o JSON de comando no POST, atualiza na hora:
    if (resposta.indexOf("\"irrigating\"") >= 0) {
      processarRespostaEstado(resposta);
    }

    // Caso a irrigação automática esteja ligada, a umidade esteja abaixo do limite
    // e o servidor ainda não tenha iniciado a irrigação, pede o início automático:
    if (irrigacaoAuto && !bombaLigadaAtual && moisture < limiteUmidadeMin && water >= 15.0) {
      Serial.println("[AUTO] Umidade abaixo do limite! Solicitando inicio da rega ao servidor...");
      HTTPClient httpStart;
      httpStart.begin(client, montarUrl(String("/api/devices/") + DEVICE_ID + "/irrigation/start"));
      httpStart.addHeader("Content-Type", "application/json");
      int startCode = httpStart.POST("{}");
      if (startCode > 0) {
        processarRespostaEstado(httpStart.getString());
      }
      httpStart.end();
    }
  } else {
    Serial.print("[ERRO POST] Falha ao conectar em ");
    Serial.print(url);
    Serial.print(" -> ");
    Serial.println(http.errorToString(httpCode));
  }
  http.end();
}

void consultarComandoBomba() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;

  // Tenta primeiro o endpoint leve /api/ingest/{deviceId}/command
  String urlCmd = montarUrl(String("/api/ingest/") + DEVICE_ID + "/command");
  http.begin(client, urlCmd);
  int httpCode = http.GET();

  if (httpCode == 200) {
    processarRespostaEstado(http.getString());
    http.end();
    return;
  }
  http.end();

  // Fallback automático para /api/devices/{deviceId}?days=1 (funciona também no backend original sem alterações)
  String urlDevice = montarUrl(String("/api/devices/") + DEVICE_ID + "?days=1");
  http.begin(client, urlDevice);
  httpCode = http.GET();
  if (httpCode == 200) {
    processarRespostaEstado(http.getString());
  }
  http.end();
}

// ============================================================================
// 8. SETUP E LOOP PRINCIPAL
// ============================================================================

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
  Serial.print("[Wi-Fi] Conectando a: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 30) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[Wi-Fi] Conectado! IP da placa: ");
    Serial.println(WiFi.localIP());
    Serial.print("[Wi-Fi] Enviando para servidor Verda em http://");
    Serial.print(SERVER_IP);
    Serial.print(":");
    Serial.println(SERVER_PORT);
  } else {
    Serial.println("[Wi-Fi] Falha na conexao. Tentando novamente no proximo ciclo...");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_PUMP_RELAY, OUTPUT);

  // Garante que a bomba inicie desligada por segurança
  aplicarEstadoBomba(false, 0, "moderada");

#if defined(ESP32)
  analogReadResolution(12); // Leituras analógicas de 0 a 4095 no ESP32
#endif

#ifdef USAR_SENSOR_DHT
  dht.begin();
#endif

  conectarWiFi();

  // Faz a primeira sincronização imediata ao ligar
  consultarComandoBomba();
  enviarLeiturasSensores();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
  }

  unsigned long agora = millis();

  // 1. A cada 3 segundos, consulta se o usuário acionou/parou a bomba pelo celular ou site
  if (agora - ultimaConsultaBombaMs >= INTERVALO_COMANDO_MS) {
    ultimaConsultaBombaMs = agora;
    consultarComandoBomba();
  }

  // 2. A cada 10 segundos, lê os sensores e envia ao banco de dados para atualizar os gráficos
  if (agora - ultimoEnvioLeituraMs >= INTERVALO_LEITURA_MS) {
    ultimoEnvioLeituraMs = agora;
    enviarLeiturasSensores();
  }
}
