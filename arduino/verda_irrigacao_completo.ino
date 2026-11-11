#include <Wire.h>
#include <LiquidCrystal.h>

LiquidCrystal lcdParalelo(12, 11, 5, 4, 3, 2);

const int PIN_SENSOR_UMIDADE = A0;          // Sensor de Umidade no pino A0
const int PIN_RELE_BOMBA     = 7;           // Módulo Relé no pino 7
const int PIN_LED_STATUS     = LED_BUILTIN; // LED "L" (pino 13)
const int LEITURA_SOLO_SECO  = 980;
const int LEITURA_SOLO_UMIDO = 320;

const bool RELE_ATIVO_EM_LOW = true;

int  limiteUmidadeMin          = 40;
bool modoAutoRemoto            = false;
bool bombaLigada               = false;
bool comandoRemotoAtivo        = false;
bool bloqueioAutoSoloUmido     = false;

int  adcSemMotor               = 980;
int  adcComMotorBase           = 980;
int  offsetMotorAdc            = 0;
int  contagemSoloUmidoComBomba = 0;
unsigned long instanteLigouBombaMs = 0;

float umidadeAtual             = 55.0;
float umidadeAntesDaBomba      = 55.0;
float temperaturaAtual         = 25.4;
float nivelAguaAtual           = 82.0;
float phAtual                  = 6.5;

const unsigned long TIMEOUT_SEGURANCA_BOMBA_MS   = 60000;
const unsigned long TEMPO_ESTABILIZACAO_MOTOR_MS = 1800;

unsigned long ultimoEnvioMs       = 0;
unsigned long ultimoDisplayMs     = 0;
unsigned long ultimoComandoLigaMs = 0;

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
  Wire.setWireTimeout(3000, true);
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

void escreverTextoLCD(bool mostrandoRega) {
  String linha1 = "Umidade: " + String((int)round(umidadeAtual)) + " %     ";
  linha1 = linha1.substring(0, 16);

  String linha2;
  if (mostrandoRega) {
    linha2 = "   Regando...   ";
  } else if (umidadeAtual < limiteUmidadeMin) {
    linha2 = "Solo Seco (<" + String(limiteUmidadeMin) + "%) ";
    linha2 = linha2.substring(0, 16);
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

int lerAdcMediana() {
  int amostras[16];
  for (int i = 0; i < 16; i++) {
    amostras[i] = analogRead(PIN_SENSOR_UMIDADE);
    delayMicroseconds(1500);
  }
  for (int i = 0; i < 15; i++) {
    for (int j = i + 1; j < 16; j++) {
      if (amostras[j] < amostras[i]) {
        int tmp = amostras[i];
        amostras[i] = amostras[j];
        amostras[j] = tmp;
      }
    }
  }
  long soma = 0;
  for (int i = 4; i < 12; i++) {
    soma += amostras[i];
  }
  return (int)(soma / 8);
}

float converterAdcParaPorcentagem(int leituraAdc) {
  if (leituraAdc > 1005) return 3.0;
  if (leituraAdc < 120)  return 95.0;

  long pctMapeado = map(leituraAdc, LEITURA_SOLO_SECO, LEITURA_SOLO_UMIDO, 0, 1000);
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

void atualizarHardwareBomba(bool ligar) {
  if (ligar && !bombaLigada) {
    adcSemMotor = lerAdcMediana();
    umidadeAntesDaBomba = converterAdcParaPorcentagem(adcSemMotor);
    umidadeAtual = umidadeAntesDaBomba;

    escreverTextoLCD(true);
    delay(40);

    bombaLigada = true;
    contagemSoloUmidoComBomba = 0;
    instanteLigouBombaMs = millis();
    acionarPinoRele(true);

    // Mede a queda inicial de tensão da protoboard causada pelo motor (sem trava de 450!)
    delay(500);
    adcComMotorBase = lerAdcMediana();
    int queda = adcSemMotor - adcComMotorBase;
    offsetMotorAdc = (queda > 0) ? (queda + 25) : 25;
  } else if (!ligar && bombaLigada) {
    bombaLigada = false;
    contagemSoloUmidoComBomba = 0;
    acionarPinoRele(false);

    delay(350);
    adcSemMotor = lerAdcMediana();
    umidadeAtual = converterAdcParaPorcentagem(adcSemMotor);
    ressincronizarLcdI2C();
    escreverTextoLCD(false);
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

void atualizarParametrosDoComando(const String& cmd) {
  if (cmd.indexOf("AUTO") >= 0) {
    modoAutoRemoto = true;
  } else if (cmd.indexOf("MANUAL") >= 0) {
    modoAutoRemoto = false;
    bloqueioAutoSoloUmido = false;
  }

  int ultimoDoisPontos = cmd.lastIndexOf(':');
  if (ultimoDoisPontos > 0 && ultimoDoisPontos < (int)cmd.length() - 1) {
    int valorLimite = cmd.substring(ultimoDoisPontos + 1).toInt();
    if (valorLimite >= 5 && valorLimite <= 95) {
      limiteUmidadeMin = valorLimite;
    }
  }
}

void lerComandoSerial() {
  while (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();
    if (cmd.length() == 0) continue;

    atualizarParametrosDoComando(cmd);

    if (cmd.indexOf("DESLIGA") >= 0 || cmd.indexOf("PARAR") >= 0 || cmd.indexOf("STOP") >= 0) {
      comandoRemotoAtivo = false;
      atualizarHardwareBomba(false);
    } else if (cmd.indexOf("LIGA") >= 0) {
      if (modoAutoRemoto && (bloqueioAutoSoloUmido || (!bombaLigada && umidadeAtual >= limiteUmidadeMin))) {
        comandoRemotoAtivo = false;
        atualizarHardwareBomba(false);
      } else {
        comandoRemotoAtivo = true;
        ultimoComandoLigaMs = millis();
        atualizarHardwareBomba(true);
      }
    }
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(PIN_SENSOR_UMIDADE, INPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_RELE_BOMBA, OUTPUT);
  acionarPinoRele(false);

  adcSemMotor = lerAdcMediana();
  umidadeAtual = converterAdcParaPorcentagem(adcSemMotor);
  umidadeAntesDaBomba = umidadeAtual;

  inicializarLcdI2C();
  lcdI2CPosicionar(0, 0);
  lcdI2CImprimir("Plataforma Verda");
  lcdI2CPosicionar(0, 1);
  lcdI2CImprimir("Modo Manual Ini.");

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

  if (comandoRemotoAtivo && (agora - ultimoComandoLigaMs >= TIMEOUT_SEGURANCA_BOMBA_MS)) {
    comandoRemotoAtivo = false;
    atualizarHardwareBomba(false);
  }

  if (agora - ultimoDisplayMs >= 500) {
    ultimoDisplayMs = agora;

    if (!bombaLigada) {
      adcSemMotor         = lerAdcMediana();
      umidadeAtual        = converterAdcParaPorcentagem(adcSemMotor);
      umidadeAntesDaBomba = umidadeAtual;
      temperaturaAtual    = 25.8;
      nivelAguaAtual      = 82.0;

      if (umidadeAtual < limiteUmidadeMin) {
        bloqueioAutoSoloUmido = false;
      }

      escreverTextoLCD(false);
    } else {
      int adcComMotor = lerAdcMediana();
      unsigned long tempoLigada = agora - instanteLigouBombaMs;

      // Nos primeiros 1.8s de giro do motor, calibra o ponto mais baixo da tensão da protoboard
      if (tempoLigada < TEMPO_ESTABILIZACAO_MOTOR_MS) {
        if (adcComMotor < adcComMotorBase) {
          adcComMotorBase = adcComMotor;
        }
        int quedaMaxima = adcSemMotor - adcComMotorBase;
        offsetMotorAdc = (quedaMaxima > 0) ? (quedaMaxima + 25) : 25;
        contagemSoloUmidoComBomba = 0;
        umidadeAtual = umidadeAntesDaBomba;
      } else {
        int adcCompensado = adcComMotor + offsetMotorAdc;
        if (adcCompensado > 1023) adcCompensado = 1023;
        float umidadeCompensada = converterAdcParaPorcentagem(adcCompensado);

        // Exige que o sensor tenha uma queda adicional real (solo molhado tocando a haste)
        bool quedaRealNoSensor = (adcComMotor <= (adcComMotorBase - 40)) || (adcComMotor < 200);
        if (quedaRealNoSensor && umidadeCompensada >= limiteUmidadeMin) {
          contagemSoloUmidoComBomba++;
        } else {
          contagemSoloUmidoComBomba = 0;
        }

        // Enquanto NÃO confirmar 3 leituras seguidas de solo úmido, envia umidadeAntesDaBomba
        // para o Backend NUNCA mandar "DESLIGA" no meio da rega!
        if (contagemSoloUmidoComBomba >= 3) {
          if (modoAutoRemoto) {
            comandoRemotoAtivo = false;
            bloqueioAutoSoloUmido = true;
            atualizarHardwareBomba(false);
          } else {
            umidadeAtual = umidadeCompensada;
          }
          ultimoEnvioMs = agora;
          enviarLeiturasSerial();
        } else {
          umidadeAtual = umidadeAntesDaBomba;
        }
      }

      temperaturaAtual = 24.4;
      nivelAguaAtual   = 79.0;
    }
  }

  if (agora - ultimoEnvioMs >= 1800) {
    ultimoEnvioMs = agora;
    enviarLeiturasSerial();
  }
}