CREATE SCHEMA IF NOT EXISTS verda;

CREATE TABLE IF NOT EXISTS device (
  id                   VARCHAR(40)  PRIMARY KEY,               -- código impresso no Arduino, ex.: ARD-IRR-0421
  name                 VARCHAR(120) NOT NULL,
  location             VARCHAR(160) NOT NULL DEFAULT '',
  type                 VARCHAR(60)  NOT NULL,
  moisture             DOUBLE PRECISION,                       -- última leitura (NULL até a primeira)
  temperature          DOUBLE PRECISION,
  water                DOUBLE PRECISION,
  last_seen_at         TIMESTAMPTZ,
  firmware             VARCHAR(30)  NOT NULL DEFAULT 'v2.4.1',
  connectivity         VARCHAR(60)  NOT NULL DEFAULT 'Wi-Fi',
  rssi                 INTEGER,
  installed_at         DATE         NOT NULL DEFAULT CURRENT_DATE,
  min_moisture         INTEGER      NOT NULL DEFAULT 40,
  default_duration_min INTEGER      NOT NULL DEFAULT 15,
  auto_irrigation      BOOLEAN      NOT NULL DEFAULT FALSE,
  disconnect_alerts    BOOLEAN      NOT NULL DEFAULT TRUE,
  schedule_time        TIME         DEFAULT '18:00',           -- rotina diária de irrigação
  irrigating_until     TIMESTAMPTZ,                            -- futuro => irrigando agora
  irrigation_mode      VARCHAR(10),                            -- manual | auto
  irrigation_minutes   INTEGER      NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading (
  id          BIGSERIAL PRIMARY KEY,
  device_id   VARCHAR(40) NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  moisture    DOUBLE PRECISION NOT NULL,
  temperature DOUBLE PRECISION NOT NULL,
  water       DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reading_device_time ON reading (device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_time ON reading (recorded_at DESC);

-- v2: pH, cultura, faixa ideal de pH e regime de chuva padrao (ALTER idempotente, funciona em bancos ja existentes)
ALTER TABLE reading ADD COLUMN IF NOT EXISTS ph DOUBLE PRECISION;
ALTER TABLE device ADD COLUMN IF NOT EXISTS ph DOUBLE PRECISION;
ALTER TABLE device ADD COLUMN IF NOT EXISTS crop VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE device ADD COLUMN IF NOT EXISTS min_ph DOUBLE PRECISION NOT NULL DEFAULT 5.5;
ALTER TABLE device ADD COLUMN IF NOT EXISTS max_ph DOUBLE PRECISION NOT NULL DEFAULT 7.0;
ALTER TABLE device ADD COLUMN IF NOT EXISTS default_regime VARCHAR(20) NOT NULL DEFAULT 'moderada';
ALTER TABLE device ADD COLUMN IF NOT EXISTS irrigation_regime VARCHAR(20);

-- Programacoes de rega: dias da semana (ISO, 1 = segunda ... 7 = domingo), horario, duracao e regime de chuva
CREATE TABLE IF NOT EXISTS irrigation_schedule (
  id           BIGSERIAL PRIMARY KEY,
  device_id    VARCHAR(40) NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  name         VARCHAR(80) NOT NULL,
  days         VARCHAR(20) NOT NULL,
  start_time   TIME NOT NULL,
  duration_min INTEGER NOT NULL,
  regime       VARCHAR(20) NOT NULL DEFAULT 'moderada',
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_on  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_device ON irrigation_schedule (device_id);

-- Historico de irrigacoes (manual, agendada ou automatica)
CREATE TABLE IF NOT EXISTS irrigation_log (
  id              BIGSERIAL PRIMARY KEY,
  device_id       VARCHAR(40) NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL,
  planned_minutes INTEGER NOT NULL,
  ended_at        TIMESTAMPTZ,
  mode            VARCHAR(12) NOT NULL,
  regime          VARCHAR(20) NOT NULL DEFAULT 'moderada',
  schedule_name   VARCHAR(80)
);
CREATE INDEX IF NOT EXISTS idx_irrigation_log_device_time ON irrigation_log (device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_irrigation_log_time ON irrigation_log (started_at DESC);

CREATE TABLE IF NOT EXISTS alert (
  id          BIGSERIAL PRIMARY KEY,
  device_id   VARCHAR(40) REFERENCES device(id) ON DELETE CASCADE,
  kind        VARCHAR(30)  NOT NULL,   -- LOW_MOISTURE | LOW_WATER | OFFLINE | IRRIGATION_DONE | FIRMWARE
  level       VARCHAR(10)  NOT NULL,   -- high | medium | low
  title       VARCHAR(160) NOT NULL,
  message     VARCHAR(400) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ               -- NULL => ainda ativo
);
CREATE INDEX IF NOT EXISTS idx_alert_created ON alert (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_device_kind ON alert (device_id, kind) WHERE resolved_at IS NULL;

-- Configurações da conta ativa (padrão inicial: Pedro Henrique Tavares de Andrade)
CREATE TABLE IF NOT EXISTS app_settings (
  id                SMALLINT PRIMARY KEY CHECK (id = 1),
  full_name         VARCHAR(120) NOT NULL,
  email             VARCHAR(160) NOT NULL,
  phone             VARCHAR(40)  NOT NULL DEFAULT '',
  role              VARCHAR(40)  NOT NULL DEFAULT 'Administrador(a)',
  property_name     VARCHAR(120) NOT NULL,
  property_location VARCHAR(160) NOT NULL DEFAULT '',
  notify_critical   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_offline    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_routines   BOOLEAN NOT NULL DEFAULT FALSE,
  notify_weekly     BOOLEAN NOT NULL DEFAULT TRUE,
  language          VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
  timezone          VARCHAR(60) NOT NULL DEFAULT 'America/Sao_Paulo',
  temperature_unit  VARCHAR(1)  NOT NULL DEFAULT 'C',
  date_format       VARCHAR(20) NOT NULL DEFAULT 'DD/MM/AAAA'
);

INSERT INTO app_settings (id, full_name, email, phone, role, property_name, property_location)
VALUES (1, 'Pedro Henrique Tavares de Andrade', 'pedro@senacrs.edu.br', '(51) 99981-2026', 'Administrador(a)', 'Horta Experimental Senac', 'Porto Alegre, RS')
ON CONFLICT (id) DO NOTHING;

-- Tabela de usuários para Login e Cadastro na Plataforma Verda
CREATE TABLE IF NOT EXISTS app_user (
  id                BIGSERIAL PRIMARY KEY,
  full_name         VARCHAR(120) NOT NULL,
  email             VARCHAR(160) NOT NULL UNIQUE,
  password_hash     VARCHAR(160) NOT NULL,
  phone             VARCHAR(40)  NOT NULL DEFAULT '',
  role              VARCHAR(40)  NOT NULL DEFAULT 'Operador(a) de Irrigação',
  property_name     VARCHAR(120) NOT NULL DEFAULT 'Horta Experimental Senac',
  property_location VARCHAR(160) NOT NULL DEFAULT 'Porto Alegre, RS',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO app_user (full_name, email, password_hash, phone, role, property_name, property_location)
VALUES
  ('Pedro Henrique Tavares de Andrade', 'pedro@senacrs.edu.br', '123456', '(51) 99981-2026', 'Administrador(a)', 'Horta Experimental Senac', 'Porto Alegre, RS'),
  ('Dori Amado C. V. Z. Aguzzoli', 'dori@senacrs.edu.br', '123456', '(51) 99982-2026', 'Administrador(a)', 'Horta Experimental Senac', 'Porto Alegre, RS')
ON CONFLICT (email) DO NOTHING;

-- Remove a conta demo antiga Marina Costa caso já exista no banco local
DELETE FROM app_user WHERE LOWER(email) = 'marina@fazenda.com';
UPDATE app_settings
SET full_name = 'Pedro Henrique Tavares de Andrade',
    email = 'pedro@senacrs.edu.br',
    phone = '(51) 99981-2026',
    role = 'Administrador(a)',
    property_name = 'Horta Experimental Senac',
    property_location = 'Porto Alegre, RS'
WHERE LOWER(email) = 'marina@fazenda.com';

-- Inicia todos os dispositivos no Modo Manual por padrão ao iniciar o sistema
UPDATE device SET auto_irrigation = FALSE, irrigating_until = NULL, irrigation_mode = NULL;
