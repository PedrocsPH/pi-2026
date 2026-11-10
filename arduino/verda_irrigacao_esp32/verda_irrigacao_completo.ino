/*
 * ============================================================================
 * PLATAFORMA VERDA — FIRMWARE COMPLETO COM MÓDULO I2C NO LCD 16x2 + SENSOR
 * ============================================================================
 * Escola de Ensino Médio Senac Distrito Criativo — Projeto Integrador 2026
 * Autores: Dori A. C. V. Z. Aguzzoli, Pedro H. T. de Andrade
 *
 * VANTAGENS DESTA VERSÃO PARA MÓDULO I2C:
 * - Detecta SOZINHO o endereço do seu Módulo I2C (0x27, 0x3F, etc.) ao ligar!
 * - Usa apenas a biblioteca nativa <Wire.h> (já vem instalada na Arduino IDE,
 *   não precisa baixar nenhuma biblioteca externa).
 * - Atualiza o LCD I2C (pinos SDA=A4 e SCL=A5 no Uno) e também os pinos
 *   paralelos (12, 11, 5, 4, 3, 2) ao mesmo tempo!
 * ============================================================================
 */

#include <Wire.h>

#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>

  const char* WIFI_SSID     = "NOME_DO_SEU_WIFI";
  const char* WIFI_PASSWORD = "SENHA_DO_SEU_WIFI";
  const char* SERVER_IP     = "192.168.15.2";
  const int   SERVER_PORT   = 8080;
  const char* DEVICE_ID     = "ARD-IRR-0421";

  const int PIN_SENSOR_UMIDADE = 34; // Sensor no ESP32
  const int PIN_RELE_BOMBA     = 26; // Relé no ESP32
  const int PIN_LED_STATUS     = 2;  // LED no ESP32
  const int LEITURA_SOLO_SECO  = 3400;
  const int LEITURA_SOLO_UMIDO = 1300;
#else
  #include <LiquidCrystal.h>
  LiquidCrystal lcdParalelo(12, 11, 5, 4, 3, 2);

  const int PIN_SENSOR_UMIDADE = A0;          // Sensor de Umidade no pino A0
  const int PIN_RELE_BOMBA     = 7;           // Módulo Relé no pino 7
  const int PIN_LED_STATUS     = LED_BUILTIN; // LED "L" (pino 13)
  const int LEITURA_SOLO_SECO  = 980;
  const int LEITURA_SOLO_UMIDO = 320;
#endif

const bool RELE_ATIVO_EM_LOW          = true;
const int  LIMITE_UMIDADE_MIN         = 40;
const bool IRRIGACAO_AUTOMATICA_LOCAL = false;
const int  GATILHO_REGA_AUTO_PCT      = 25;

bool  bombaLigada        = false;
bool  comandoRemotoAtivo = false;
float umidadeAtual       = 55.0;
float temperaturaAtual   = 25.4;
float nivelAguaAtual     = 82.0;
float phAtual            = 6.5;

unsigned long ultimoEnvioMs   = 0;
unsigned long ultimoDisplayMs = 0;

// ============================================================================
// DRIVER NATIVO PARA MÓDULO I2C DO LCD (Funciona em 0x27 e 0x3F sem biblioteca extra)
// ============================================================================
byte enderecoI2C = 0x27;
bool i2cEncontrado = false;
const byte LCD_BACKLIGHT = 0x08;
const byte LCD_ENABLE    = 0x04;

void i2cEscreverByte(byte valor) {
  if (!i2cEncontrado) return;
  Wire.beginTransmission(enderecoI2C);
  Wire.write(valor | LCD_BACKLIGHT);
  Wire.endTransmission();
}

void i2cPulsoEnable(byte valor) {
  i2cEscreverByte(valor | LCD_ENABLE);
  delayMicroseconds(1);
  i2cEscreverByte(valor & ~LCD_ENABLE);
  delayMicroseconds(50);
}

void i2cEnviar4Bits(byte valor) {
  i2cEscreverByte(valor);
  i2cPulsoEnable(valor);
}

void i2cEnviar(byte valor, byte modo) {
  byte parteAlta  = valor & 0xF0;
  byte parteBaixa = (valor << 4) & 0xF0;
  i2cEnviar4Bits(parteAlta | modo);
  i2cEnviar4Bits(parteBaixa | modo);
}

void lcdI2CComando(byte cmd) {
  i2cEnviar(cmd, 0);
  if (cmd <= 3) delay(2);
}

void lcdI2CPosicionar(byte col, byte lin) {
  byte offsets[] = { 0x00, 0x40 };
  lcdI2CComando(0x80 | (col + offsets[lin]));
}

void lcdI2CImprimir(const String& texto) {
  for (unsigned int i = 0; i < texto.length(); i++) {
    i2cEnviar((byte)texto[i], 1);
  }
}

void inicializarLcdI2C() {
  Wire.begin();
  // Procura automaticamente o endereço do Módulo I2C (ex: 0x27 ou 0x3F)
  for (byte addr = 0x20; addr <= 0x3F; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      enderecoI2C = addr;
      i2cEncontrado = true;
      break;
    }
  }
  if (!i2cEncontrado) {
    // Mesmo se não respondeu no scan inicial, tenta no endereço padrão 0x27
    enderecoI2C = 0x27;
    i2cEncontrado = true;
  }

  delay(50);
  i2cEscreverByte(LCD_BACKLIGHT);
  delay(100);
  i2cEnviar4Bits(0x30);
  delayMicroseconds(4500);
  i2cEnviar4Bits(0x30);
  delayMicroseconds(4500);
  i2cEnviar4Bits(0x30);
  delayMicroseconds(150);
  i2cEnviar4Bits(0x20); // Modo 4 bits

  lcdI2CComando(0x28); // 2 linhas, fonte 5x8
  lcdI2CComando(0x0C); // Display ligado, sem cursor piscando
  lcdI2CComando(0x06); // Incremento automático
  lcdI2CComando(0x01); // Limpa tela
  delay(2);
}

// ============================================================================
// ATUALIZAÇÃO DO DISPLAY LCD (I2C E PARALELO)
// ============================================================================
void atualizarPainelLCD() {
  String linha1 = "Umidade: " + String((int)round(umidadeAtual)) + " %     ";
  linha1 = linha1.substring(0, 16);

  String linha2;
  if (bombaLigada) {
    linha2 = "   Regando...   ";
  } else if (umidadeAtual < LIMITE_UMIDADE_MIN) {
    linha2 = "Solo Seco! (<40)";
  } else {
    linha2 = "Solo Ideal (OK) ";
  }

  // 1. Atualiza via Módulo I2C (pinos SDA=A4, SCL=A5)
  lcdI2CPosicionar(0, 0);
  lcdI2CImprimir(linha1);
  lcdI2CPosicionar(0, 1);
  lcdI2CImprimir(linha2);

#if !defined(ESP32)
  // 2. Atualiza também no modo paralelo por garantia
  lcdParalelo.setCursor(0, 0);
  lcdParalelo.print(linha1);
  lcdParalelo.setCursor(0, 1);
  lcdParalelo.print(linha2);
#endif
}

// ============================================================================
// LEITURA DO SENSOR DE UMIDADE E CONTROLE DO RELÉ
// ============================================================================
float lerUmidadeSoloReal() {
  long soma = 0;
  for (int i = 0; i < 10; i++) {
    soma += analogRead(PIN_SENSOR_UMIDADE);
    delay(4);
  }
  int leituraBruta = (int)(soma / 10);

#if !defined(ESP32)
  if (leituraBruta < 25)   return 95.0;
  if (leituraBruta > 1005) return 3.0;
#endif

  long pctMapeado = map(leituraBruta, LEITURA_SOLO_SECO, LEITURA_SOLO_UMIDO, 0, 1000);
  float pct = pctMapeado / 10.0;
  if (pct < 0.0)   pct = 0.0;
  if (pct > 100.0) pct = 100.0;
  return pct;
}

void atualizarHardwareBomba(bool ligar) {
  bombaLigada = ligar;
  digitalWrite(PIN_LED_STATUS, bombaLigada ? HIGH : LOW);
  if (RELE_ATIVO_EM_LOW) {
    digitalWrite(PIN_RELE_BOMBA, bombaLigada ? LOW : HIGH);
  } else {
    digitalWrite(PIN_RELE_BOMBA, bombaLigada ? HIGH : LOW);
  }
}

void lerComandoSerial() {
  while (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();

    if (cmd == "LIGA" || cmd.startsWith("LIGA:")) {
      comandoRemotoAtivo = true;
      atualizarHardwareBomba(true);
      atualizarPainelLCD();
    } else if (cmd == "DESLIGA") {
      comandoRemotoAtivo = false;
      atualizarHardwareBomba(false);
      atualizarPainelLCD();
    }
  }
}

void enviarLeiturasSerial() {
  Serial.print("{\"moisture\":");
  Serial.print(umidadeAtual, 1);
  Serial.print(",\"temperature\":");
  Serial.print(temperaturaAtual, 1);
  Serial.print(",\"water\":");
  Serial.print(nivelAguaAtual, 1);
  Serial.print(",\"ph\":");
  Serial.print(phAtual, 2);
  Serial.println("}");
}

void setup() {
  Serial.begin(9600);
  pinMode(PIN_SENSOR_UMIDADE, INPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_RELE_BOMBA, OUTPUT);
  atualizarHardwareBomba(false);

  // Inicializa o LCD via Módulo I2C (detectando 0x27 ou 0x3F sozinho)
  inicializarLcdI2C();
  lcdI2CPosicionar(0, 0);
  lcdI2CImprimir("Plataforma Verda");
  lcdI2CPosicionar(0, 1);
  lcdI2CImprimir("Iniciando IoT...");

#if !defined(ESP32)
  lcdParalelo.begin(16, 2);
  lcdParalelo.setCursor(0, 0);
  lcdParalelo.print("Plataforma Verda");
#endif

  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED_STATUS, HIGH);
    delay(150);
    digitalWrite(PIN_LED_STATUS, LOW);
    delay(150);
  }
}

void loop() {
  unsigned long agora = millis();

  lerComandoSerial();

  if (agora - ultimoDisplayMs >= 1000) {
    ultimoDisplayMs  = agora;
    umidadeAtual     = lerUmidadeSoloReal();
    temperaturaAtual = bombaLigada ? 24.4 : 25.8;
    nivelAguaAtual   = bombaLigada ? 79.0 : 82.0;

    if (comandoRemotoAtivo) {
      atualizarHardwareBomba(true);
    } else if (IRRIGACAO_AUTOMATICA_LOCAL && umidadeAtual <= GATILHO_REGA_AUTO_PCT) {
      atualizarHardwareBomba(true);
    } else {
      atualizarHardwareBomba(false);
    }

    atualizarPainelLCD();
  }

  if (agora - ultimoEnvioMs >= 4000) {
    ultimoEnvioMs = agora;
    enviarLeiturasSerial();
  }
}
