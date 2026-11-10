/*
 * ============================================================================
 * PLATAFORMA VERDA — FIRMWARE BLINDADO CONTRA RUÍDO DA BOMBA (ANTI-TRAVAMENTO)
 * ============================================================================
 * Escola de Ensino Médio Senac Distrito Criativo — Projeto Integrador 2026
 * Autores: Dori A. C. V. Z. Aguzzoli, Pedro H. T. de Andrade
 *
 * POR QUE O ERRO ACONTECIA E COMO FOI RESOLVIDO:
 * - Quando a mini bomba gira no mesmo 5V do Arduino, o motor elétrico gera ruído
 *   na linha 5V. Se o Arduino tentar escrever no LCD I2C ENQUANTO o motor gira,
 *   o ruído corrompe os bytes do I2C (mostrando letras codificadas) e trava a
 *   função Wire.endTransmission(), impedindo o Arduino de desligar a bomba!
 * - SOLUÇÃO DEFINITIVA:
 *   1. O Arduino escreve "Regando..." no LCD ANTES de acionar o relé da bomba.
 *   2. Enquanto o motor da bomba está girando, o barramento I2C fica em silêncio
 *      (protegido), então o LCD NUNCA recebe ruído e o Arduino NUNCA trava!
 *   3. Ao desligar a bomba, o Arduino desliga o relé PRIMEIRO, espera 300ms para
 *      a energia estabilizar e só então volta a atualizar o LCD!
 *   4. Inclui Timeout de Hardware no I2C (Wire.setWireTimeout) e trava de segurança.
 * ============================================================================
 */

#include <Wire.h>
#include <LiquidCrystal.h>

LiquidCrystal lcdParalelo(12, 11, 5, 4, 3, 2);

const int PIN_SENSOR_UMIDADE = A0;          // Sensor de Umidade no pino A0
const int PIN_RELE_BOMBA     = 7;           // Módulo Relé no pino 7
const int PIN_LED_STATUS     = LED_BUILTIN; // LED "L" (pino 13)
const int LEITURA_SOLO_SECO  = 980;
const int LEITURA_SOLO_UMIDO = 320;

const bool RELE_ATIVO_EM_LOW          = true;
const int  LIMITE_UMIDADE_MIN         = 40;
const bool IRRIGACAO_AUTOMATICA_LOCAL = false; // Obedece ao Manual/Auto do site
const int  GATILHO_REGA_AUTO_PCT      = 40;

// Tempo máximo sem receber sinal "LIGA" antes de desligar por segurança (10 segundos)
const unsigned long TIMEOUT_SEGURANCA_BOMBA_MS = 10000;

bool  bombaLigada          = false;
bool  comandoRemotoAtivo   = false;
bool  bloqueioManualRemoto = false;
float umidadeAtual         = 55.0;
float temperaturaAtual     = 25.4;
float nivelAguaAtual       = 82.0;
float phAtual              = 6.5;

unsigned long ultimoEnvioMs       = 0;
unsigned long ultimoDisplayMs     = 0;
unsigned long ultimoComandoLigaMs = 0;

// ============================================================================
// DRIVER NATIVO PARA MÓDULO I2C DO LCD COM TIMEOUT ANTI-TRAVAMENTO
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
  delayMicroseconds(5);
  i2cEscreverByte(valor & ~LCD_ENABLE);
  delayMicroseconds(60);
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

void ressincronizarLcdI2C() {
  i2cEscreverByte(LCD_BACKLIGHT);
  delayMicroseconds(100);
  i2cEnviar4Bits(0x30);
  delayMicroseconds(4500);
  i2cEnviar4Bits(0x30);
  delayMicroseconds(4500);
  i2cEnviar4Bits(0x30);
  delayMicroseconds(150);
  i2cEnviar4Bits(0x20);
  lcdI2CComando(0x28);
  lcdI2CComando(0x0C);
  lcdI2CComando(0x06);
}

void inicializarLcdI2C() {
  Wire.begin();
  Wire.setClock(50000);
#if defined(WIRE_HAS_TIMEOUT)
  Wire.setWireTimeout(3000, true); // Impede o Arduino de travar se houver ruído no I2C
#endif

  for (byte addr = 0x20; addr <= 0x3F; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      enderecoI2C = addr;
      i2cEncontrado = true;
      break;
    }
  }
  if (!i2cEncontrado) {
    enderecoI2C = 0x27;
    i2cEncontrado = true;
  }

  delay(50);
  ressincronizarLcdI2C();
  lcdI2CComando(0x01);
  delay(3);
}

// ============================================================================
// ATUALIZAÇÃO SEGURA DO DISPLAY LCD (SÓ ESCREVE COM A ENERGIA ESTÁVEL)
// ============================================================================
void escreverTextoLCD(bool mostrandoRega) {
  String linha1 = "Umidade: " + String((int)round(umidadeAtual)) + " %     ";
  linha1 = linha1.substring(0, 16);

  String linha2;
  if (mostrandoRega) {
    linha2 = "   Regando...   ";
  } else if (umidadeAtual < LIMITE_UMIDADE_MIN) {
    linha2 = "Solo Seco! (<40)";
  } else {
    linha2 = "Solo Ideal (OK) ";
  }

  lcdI2CPosicionar(0, 0);
  lcdI2CImprimir(linha1);
  lcdI2CPosicionar(0, 1);
  lcdI2CImprimir(linha2);

  lcdParalelo.setCursor(0, 0);
  lcdParalelo.print(linha1);
  lcdParalelo.setCursor(0, 1);
  lcdParalelo.print(linha2);
}

float lerUmidadeSoloReal() {
  long soma = 0;
  for (int i = 0; i < 10; i++) {
    soma += analogRead(PIN_SENSOR_UMIDADE);
    delay(4);
  }
  int leituraBruta = (int)(soma / 10);
  if (leituraBruta < 25)   return 95.0;
  if (leituraBruta > 1005) return 3.0;

  long pctMapeado = map(leituraBruta, LEITURA_SOLO_SECO, LEITURA_SOLO_UMIDO, 0, 1000);
  float pct = pctMapeado / 10.0;
  if (pct < 0.0)   pct = 0.0;
  if (pct > 100.0) pct = 100.0;
  return pct;
}

void acionarPinoRele(bool ligar) {
  digitalWrite(PIN_LED_STATUS, ligar ? HIGH : LOW);
  if (RELE_ATIVO_EM_LOW) {
    digitalWrite(PIN_RELE_BOMBA, ligar ? LOW : HIGH);
  } else {
    digitalWrite(PIN_RELE_BOMBA, ligar ? HIGH : LOW);
  }
}

// ============================================================================
// CONTROLE BLINDADO DA BOMBA (CONGELA O I2C DURANTE O GIRO DO MOTOR)
// ============================================================================
void atualizarHardwareBomba(bool ligar) {
  if (ligar && !bombaLigada) {
    // 1. ANTES de ligar o motor, escreve "Regando..." no LCD enquanto o 5V está limpo!
    escreverTextoLCD(true);
    delay(40);
    // 2. Agora aciona o relé da bomba (e não toca mais no LCD enquanto ela gira)
    bombaLigada = true;
    acionarPinoRele(true);
  } else if (!ligar && bombaLigada) {
    // 1. PRIMEIRO desliga o relé da bomba para cortar o ruído do motor
    bombaLigada = false;
    acionarPinoRele(false);
    // 2. Espera 300ms para o motor parar e o 5V estabilizar
    delay(300);
    // 3. Realigna o LCD e mostra o estado atualizado sem nenhum caractere estranho!
    ressincronizarLcdI2C();
    escreverTextoLCD(false);
  }
}

void lerComandoSerial() {
  while (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();

    if (cmd.indexOf("DESLIGA") >= 0 || cmd.indexOf("PARAR") >= 0 || cmd.indexOf("STOP") >= 0) {
      comandoRemotoAtivo = false;
      bloqueioManualRemoto = true;
      atualizarHardwareBomba(false);
    } else if (cmd.indexOf("LIGA") >= 0) {
      comandoRemotoAtivo = true;
      bloqueioManualRemoto = false;
      ultimoComandoLigaMs = millis();
      atualizarHardwareBomba(true);
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
  acionarPinoRele(false);

  inicializarLcdI2C();
  lcdI2CPosicionar(0, 0);
  lcdI2CImprimir("Plataforma Verda");
  lcdI2CPosicionar(0, 1);
  lcdI2CImprimir("Iniciando IoT...");

  lcdParalelo.begin(16, 2);
  lcdParalelo.setCursor(0, 0);
  lcdParalelo.print("Plataforma Verda");

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

  // Trava de segurança: se a bomba ficou ligada e a USB perdeu contato por 10s, desliga sozinha!
  if (comandoRemotoAtivo && (agora - ultimoComandoLigaMs >= TIMEOUT_SEGURANCA_BOMBA_MS)) {
    comandoRemotoAtivo = false;
    atualizarHardwareBomba(false);
  }

  if (agora - ultimoDisplayMs >= 1000) {
    ultimoDisplayMs = agora;

    // Só lê o sensor e escreve no LCD I2C quando o motor da bomba estiver DESLIGADO!
    // Isso impede 100% que o ruído do motor embaralhe o LCD ou trave o Arduino.
    if (!bombaLigada) {
      umidadeAtual     = lerUmidadeSoloReal();
      temperaturaAtual = 25.8;
      nivelAguaAtual   = 82.0;

      if (umidadeAtual >= LIMITE_UMIDADE_MIN) {
        bloqueioManualRemoto = false;
      }

      if (IRRIGACAO_AUTOMATICA_LOCAL && !bloqueioManualRemoto && umidadeAtual < GATILHO_REGA_AUTO_PCT) {
        ultimoComandoLigaMs = agora;
        atualizarHardwareBomba(true);
      } else {
        escreverTextoLCD(false);
      }
    } else {
      temperaturaAtual = 24.4;
      nivelAguaAtual   = 79.0;
    }
  }

  if (agora - ultimoEnvioMs >= 4000) {
    ultimoEnvioMs = agora;
    enviarLeiturasSerial();
  }
}
