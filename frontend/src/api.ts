// Cliente da API da Plataforma Verda.
// Conecta automaticamente na seguinte ordem de prioridade:
// 1. URL de túnel salva via parâmetro ?api=https://... ou variável VITE_API_URL na Vercel
// 2. Backend local na mesma máquina (http://localhost:8080) — conecta o site da Vercel direto ao Arduino no PC!
// 3. Proxy local do Vite (/api)
// 4. Modo Nuvem Interativo (fallback automático quando o PC/Arduino estiver desligado)

const SAVED_API_KEY = "verda_custom_api_url";

export const PROTECTED_ADMIN_EMAILS = [
  "pedro@senacrs.edu.br",
  "dori@senacrs.edu.br",
];

const DURATION_SEC_PREFIX = "verda_duration_sec_";

export function getDeviceDurationSeconds(deviceId: string, fallbackMinutes = 15): number {
  try {
    const raw = localStorage.getItem(DURATION_SEC_PREFIX + deviceId);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 30) return Math.round(n);
    }
  } catch {}
  return Math.max(30, (fallbackMinutes || 15) * 60);
}

export function setDeviceDurationSeconds(deviceId: string, seconds: number): number {
  const valid = Math.max(30, Math.min(14400, Math.round(seconds || 30)));
  try {
    localStorage.setItem(DURATION_SEC_PREFIX + deviceId, String(valid));
  } catch {}
  return valid;
}

export function formatDurationLabel(seconds: number): string {
  const s = Math.max(30, Math.round(seconds));
  if (s < 60) return `${s} segundos`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (rem === 0) return `${mins} min (${s}s)`;
  return `${mins}m ${rem}s (${s}s)`;
}

function resolveCandidateBaseUrls(): string[] {
  const candidates: string[] = [];

  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const apiParam = params.get("api");
      if (apiParam) {
        const clean = apiParam.trim().replace(/\/+$/, "");
        localStorage.setItem(SAVED_API_KEY, clean);
      }
      const saved = localStorage.getItem(SAVED_API_KEY);
      if (saved) candidates.push(saved);
    } catch {}
  }

  const envUrl = ((import.meta as any).env?.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (envUrl && !candidates.includes(envUrl)) {
    candidates.push(envUrl);
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      if (!candidates.includes("http://localhost:8080")) {
        candidates.push("http://localhost:8080");
      }
    } else {
      candidates.push("");
    }
  } else {
    candidates.push("");
  }

  return candidates;
}

export type DeviceStatus = "online" | "offline" | "alerta";

export type DeviceSummary = {
  id: string;
  name: string;
  location: string;
  type: string;
  status: DeviceStatus;
  moisture: number | null;
  temperature: number | null;
  water: number | null;
  ph: number | null;
  crop: string;
  irrigating: boolean;
  lastSeenAt: string | null;
};

export type SeriesPoint = { t: string; moisture: number | null; temperature: number | null; water: number | null; ph: number | null };

export type RegimeKey = "garoa" | "leve" | "moderada" | "forte";

export type Regime = { key: RegimeKey; label: string; description: string; pumpPower: number; mmPerHour: number };

export type Schedule = {
  id: number;
  deviceId: string;
  name: string;
  days: number[];
  startTime: string;
  durationMin: number;
  regime: RegimeKey;
  estimatedMm: number;
  enabled: boolean;
  nextRunAt: string | null;
};

export type IrrigationLogItem = {
  id: number;
  deviceId: string;
  deviceName: string;
  startedAt: string;
  endedAt: string | null;
  plannedMinutes: number;
  actualMinutes: number;
  running: boolean;
  mode: "manual" | "agendada";
  regime: RegimeKey;
  scheduleName: string | null;
  estimatedMm: number;
};

export type DeviceDetail = DeviceSummary & {
  firmware: string;
  connectivity: string;
  installedAt: string | null;
  minMoisture: number;
  minPh: number;
  maxPh: number;
  defaultDurationMin: number;
  defaultDurationSec?: number;
  defaultRegime: RegimeKey;
  autoIrrigation: boolean;
  disconnectAlerts: boolean;
  scheduleTime: string | null;
  irrigationMinutes: number;
  irrigationMode: string | null;
  irrigationRegime: RegimeKey | null;
  irrigatingUntil: string | null;
  series: SeriesPoint[];
  schedules: Schedule[];
  history: IrrigationLogItem[];
};

export type AlertItem = {
  id: number;
  deviceId: string;
  deviceName: string | null;
  kind: string;
  level: "high" | "medium" | "low";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type AlertsSummary = { unread: number; highPriority: number; attention: number; resolvedThisMonth: number };
export type AlertsResponse = { items: AlertItem[]; summary: AlertsSummary };

export type DeviceCounts = { total: number; online: number; offline: number; alerta: number };

export type DailyIrrigation = { date: string; runs: number; minutes: number; mm: number };
export type UpcomingRun = { scheduleId: number; scheduleName: string; deviceId: string; deviceName: string; runAt: string; durationMin: number; regime: RegimeKey };

export type DashboardResponse = {
  greetingName: string;
  deviceCounts: DeviceCounts;
  avgMoisture: number | null;
  avgMoistureDeltaPercent: number | null;
  avgWaterLevel: number | null;
  avgPh: number | null;
  avgTemperature: number | null;
  activeAlerts: number;
  highPriorityAlerts: number;
  irrigatingNow: number;
  irrigationsToday: number;
  waterMmToday: number;
  moistureSeries: SeriesPoint[];
  weeklyIrrigation: DailyIrrigation[];
  upcomingRuns: UpcomingRun[];
  recentAlerts: AlertItem[];
  devices: DeviceSummary[];
};

export type Settings = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  propertyName: string;
  propertyLocation: string;
  notifyCritical: boolean;
  notifyOffline: boolean;
  notifyRoutines: boolean;
  notifyWeekly: boolean;
  language: string;
  timezone: string;
  temperatureUnit: string;
  dateFormat: string;
};

export class ApiError extends Error {}

// ============================================================================
// FALLBACK EM NUVEM (PARA FUNCIONAR 100% NA VERCEL MESMO SEM BACKEND JAVA ATIVO)
// ============================================================================
const CLOUD_STATE_KEY = "verda_cloud_state_v7";

const DEFAULT_REGIMES: Regime[] = [
  { key: "garoa", label: "Garoa fina", description: "Irrigação suave para mudas e folhosas delicadas", pumpPower: 35, mmPerHour: 4 },
  { key: "leve", label: "Chuva leve", description: "Manutenção diária para hortaliças em crescimento", pumpPower: 55, mmPerHour: 8 },
  { key: "moderada", label: "Chuva moderada", description: "Rega padrão equilibrada para canteiros e estufas", pumpPower: 75, mmPerHour: 14 },
  { key: "forte", label: "Chuva intensa", description: "Recuperação rápida de solo seco ou pomares", pumpPower: 100, mmPerHour: 22 },
];

function makeInitialSeries(baseMoisture: number, baseTemp: number, baseWater: number, basePh: number): SeriesPoint[] {
  const now = Date.now();
  const pts: SeriesPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const t = new Date(now - i * 3600 * 1000).toISOString();
    const wave = Math.sin(i * 0.7) * 4;
    pts.push({
      t,
      moisture: Math.round(Math.max(5, Math.min(98, baseMoisture + wave))),
      temperature: Number((baseTemp + Math.cos(i * 0.5) * 1.2).toFixed(1)),
      water: Math.round(Math.max(10, Math.min(100, baseWater + (i % 3) - 1))),
      ph: Number((basePh + Math.sin(i) * 0.1).toFixed(1)),
    });
  }
  return pts;
}

function getCloudState(): {
  settings: Settings;
  devices: Record<string, DeviceDetail>;
  alerts: AlertItem[];
} {
  try {
    const raw = localStorage.getItem(CLOUD_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.settings?.email?.toLowerCase() === "marina@fazenda.com") {
        parsed.settings.fullName = "Pedro Henrique Tavares de Andrade";
        parsed.settings.email = "pedro@senacrs.edu.br";
        parsed.settings.phone = "(51) 99981-2026";
        parsed.settings.role = "Administrador(a)";
        parsed.settings.propertyName = "Horta Experimental Senac";
        parsed.settings.propertyLocation = "Porto Alegre, RS";
      }
      return parsed;
    }
  } catch {}

  const nowIso = new Date().toISOString();
  const initial = {
    settings: {
      fullName: "Pedro Henrique Tavares de Andrade",
      email: "pedro@senacrs.edu.br",
      phone: "(51) 99981-2026",
      role: "Administrador(a)",
      propertyName: "Horta Experimental Senac",
      propertyLocation: "Porto Alegre, RS",
      notifyCritical: true,
      notifyOffline: true,
      notifyRoutines: true,
      notifyWeekly: false,
      language: "pt-BR",
      timezone: "America/Sao_Paulo",
      temperatureUnit: "C",
      dateFormat: "DD/MM/AAAA",
    },
    devices: {
      "ARD-IRR-0421": {
        id: "ARD-IRR-0421",
        name: "Horta Norte",
        location: "Canteiro A — Setor 1 (Arduino USB)",
        type: "Arduino Uno R3 + Sensor Capacitivo",
        status: "online" as DeviceStatus,
        moisture: 62,
        temperature: 24.8,
        water: 84,
        ph: 6.5,
        crop: "Alface Crespa e Manjericão",
        irrigating: false,
        lastSeenAt: nowIso,
        firmware: "v5.2-I2C",
        connectivity: "USB Serial / Wi-Fi Bridge",
        installedAt: "2026-10-15",
        minMoisture: 40,
        minPh: 5.8,
        maxPh: 7.2,
        defaultDurationMin: 15,
        defaultRegime: "moderada" as RegimeKey,
        autoIrrigation: false,
        disconnectAlerts: true,
        scheduleTime: "06:30",
        irrigationMinutes: 15,
        irrigationMode: null,
        irrigationRegime: null,
        irrigatingUntil: null,
        series: makeInitialSeries(62, 24.8, 84, 6.5),
        schedules: [
          { id: 1, deviceId: "ARD-IRR-0421", name: "Rega Matinal", days: [1, 2, 3, 4, 5], startTime: "06:30", durationMin: 15, regime: "moderada", estimatedMm: 3.5, enabled: true, nextRunAt: new Date(Date.now() + 3600 * 1000 * 8).toISOString() },
        ],
        history: [
          { id: 101, deviceId: "ARD-IRR-0421", deviceName: "Horta Norte", startedAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(), endedAt: new Date(Date.now() - 3600 * 1000 * 4 + 15 * 60000).toISOString(), plannedMinutes: 15, actualMinutes: 15, running: false, mode: "manual", regime: "moderada", scheduleName: "Acionamento Manual", estimatedMm: 3.5 },
        ],
      },
      "ARD-IRR-0418": {
        id: "ARD-IRR-0418",
        name: "Estufa de tomates",
        location: "Estufa Climatizada B",
        type: "ESP32 Wi-Fi + Sonda NPK/pH",
        status: "alerta" as DeviceStatus,
        moisture: 34,
        temperature: 27.6,
        water: 76,
        ph: 6.3,
        crop: "Tomate Cereja",
        irrigating: false,
        lastSeenAt: nowIso,
        firmware: "v5.2-ESP",
        connectivity: "Wi-Fi 2.4GHz",
        installedAt: "2026-10-18",
        minMoisture: 45,
        minPh: 5.5,
        maxPh: 6.8,
        defaultDurationMin: 20,
        defaultRegime: "moderada" as RegimeKey,
        autoIrrigation: false,
        disconnectAlerts: true,
        scheduleTime: "07:00",
        irrigationMinutes: 20,
        irrigationMode: null,
        irrigationRegime: null,
        irrigatingUntil: null,
        series: makeInitialSeries(34, 27.6, 76, 6.3),
        schedules: [
          { id: 2, deviceId: "ARD-IRR-0418", name: "Reforço da Tarde", days: [1, 3, 5], startTime: "16:30", durationMin: 20, regime: "moderada", estimatedMm: 4.7, enabled: true, nextRunAt: new Date(Date.now() + 3600 * 1000 * 5).toISOString() },
        ],
        history: [],
      },
      "ARD-IRR-0396": {
        id: "ARD-IRR-0396",
        name: "Pomar Sul",
        location: "Setor Sul — Cítricos",
        type: "ESP32 LoRa / Wi-Fi",
        status: "online" as DeviceStatus,
        moisture: 58,
        temperature: 23.9,
        water: 90,
        ph: 6.6,
        crop: "Limão Taiti e Bergamota",
        irrigating: false,
        lastSeenAt: nowIso,
        firmware: "v5.2-ESP",
        connectivity: "Wi-Fi 2.4GHz",
        installedAt: "2026-10-20",
        minMoisture: 40,
        minPh: 5.8,
        maxPh: 7.0,
        defaultDurationMin: 25,
        defaultRegime: "forte" as RegimeKey,
        autoIrrigation: false,
        disconnectAlerts: true,
        scheduleTime: "06:00",
        irrigationMinutes: 25,
        irrigationMode: null,
        irrigationRegime: null,
        irrigatingUntil: null,
        series: makeInitialSeries(58, 23.9, 90, 6.6),
        schedules: [],
        history: [],
      },
      "ARD-IRR-0312": {
        id: "ARD-IRR-0312",
        name: "Jardim da sede",
        location: "Entrada Principal Senac",
        type: "Arduino Uno + Módulo Relé 5V",
        status: "online" as DeviceStatus,
        moisture: 67,
        temperature: 24.1,
        water: 88,
        ph: 6.7,
        crop: "Gramado e Ornamentais",
        irrigating: false,
        lastSeenAt: nowIso,
        firmware: "v5.2-I2C",
        connectivity: "Wi-Fi Bridge",
        installedAt: "2026-10-21",
        minMoisture: 35,
        minPh: 6.0,
        maxPh: 7.4,
        defaultDurationMin: 10,
        defaultRegime: "leve" as RegimeKey,
        autoIrrigation: false,
        disconnectAlerts: true,
        scheduleTime: "18:00",
        irrigationMinutes: 10,
        irrigationMode: null,
        irrigationRegime: null,
        irrigatingUntil: null,
        series: makeInitialSeries(67, 24.1, 88, 6.7),
        schedules: [],
        history: [],
      },
    },
    alerts: [
      {
        id: 1,
        deviceId: "ARD-IRR-0418",
        deviceName: "Estufa de tomates",
        kind: "LOW_MOISTURE",
        level: "high" as const,
        title: "Umidade abaixo do limite",
        message: "A umidade atingiu 34%, abaixo do limite configurado de 45%.",
        createdAt: nowIso,
        read: false,
      },
    ],
  };

  try {
    localStorage.setItem(CLOUD_STATE_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveCloudState(state: ReturnType<typeof getCloudState>) {
  try {
    localStorage.setItem(CLOUD_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function checkExpiration(d: DeviceDetail) {
  if (d.irrigating && d.irrigatingUntil) {
    if (new Date(d.irrigatingUntil).getTime() <= Date.now()) {
      d.irrigating = false;
      d.irrigatingUntil = null;
      if (d.history?.[0]?.running) {
        d.history[0].running = false;
        d.history[0].endedAt = new Date().toISOString();
      }
    }
  }
}

function toSummary(d: DeviceDetail): DeviceSummary {
  checkExpiration(d);
  return {
    id: d.id,
    name: d.name,
    location: d.location,
    type: d.type,
    status: d.irrigating ? "online" : (d.moisture !== null && d.moisture < d.minMoisture ? "alerta" : d.status),
    moisture: d.moisture,
    temperature: d.temperature,
    water: d.water,
    ph: d.ph,
    crop: d.crop,
    irrigating: d.irrigating,
    lastSeenAt: d.lastSeenAt,
  };
}

function handleCloudFallback<T>(path: string, options?: RequestInit): T {
  const state = getCloudState();
  const method = (options?.method || "GET").toUpperCase();
  const body = options?.body ? JSON.parse(String(options.body)) : {};
  const cleanPath = path.split("?")[0];

  if (cleanPath === "/api/dashboard") {
    const list = Object.values(state.devices).map(toSummary);
    const avgM = list.reduce((a, b) => a + (b.moisture || 0), 0) / (list.length || 1);
    const avgW = list.reduce((a, b) => a + (b.water || 0), 0) / (list.length || 1);
    const avgP = list.reduce((a, b) => a + (b.ph || 0), 0) / (list.length || 1);
    const avgT = list.reduce((a, b) => a + (b.temperature || 0), 0) / (list.length || 1);
    const firstDev = Object.values(state.devices)[0];
    const dash: DashboardResponse = {
      greetingName: state.settings.fullName.split(" ")[0] || "Pedro",
      deviceCounts: {
        total: list.length,
        online: list.filter((d) => d.status === "online").length,
        offline: list.filter((d) => d.status === "offline").length,
        alerta: list.filter((d) => d.status === "alerta").length,
      },
      avgMoisture: Math.round(avgM),
      avgMoistureDeltaPercent: 4.2,
      avgWaterLevel: Math.round(avgW),
      avgPh: Number(avgP.toFixed(1)),
      avgTemperature: Number(avgT.toFixed(1)),
      activeAlerts: state.alerts.filter((a) => !a.read).length,
      highPriorityAlerts: state.alerts.filter((a) => !a.read && a.level === "high").length,
      irrigatingNow: list.filter((d) => d.irrigating).length,
      irrigationsToday: 3,
      waterMmToday: 11.4,
      moistureSeries: firstDev ? firstDev.series : [],
      weeklyIrrigation: [
        { date: "2026-11-02", runs: 2, minutes: 30, mm: 7.0 },
        { date: "2026-11-03", runs: 3, minutes: 45, mm: 10.5 },
        { date: "2026-11-04", runs: 2, minutes: 25, mm: 5.8 },
        { date: "2026-11-05", runs: 4, minutes: 60, mm: 14.0 },
        { date: "2026-11-06", runs: 3, minutes: 40, mm: 9.3 },
        { date: "2026-11-07", runs: 2, minutes: 30, mm: 7.0 },
        { date: "2026-11-08", runs: 3, minutes: 45, mm: 11.4 },
      ],
      upcomingRuns: Object.values(state.devices).flatMap((d) =>
        d.schedules.filter((s) => s.enabled).map((s) => ({
          scheduleId: s.id,
          scheduleName: s.name,
          deviceId: d.id,
          deviceName: d.name,
          runAt: s.nextRunAt || new Date(Date.now() + 3600000 * 4).toISOString(),
          durationMin: s.durationMin,
          regime: s.regime,
        }))
      ),
      recentAlerts: state.alerts.slice(0, 5),
      devices: list,
    };
    return dash as T;
  }

  if (cleanPath === "/api/devices" && method === "GET") {
    return Object.values(state.devices).map(toSummary) as T;
  }

  if (cleanPath === "/api/devices" && method === "POST") {
    const id = (body.id || `ARD-IRR-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
    const nowIso = new Date().toISOString();
    const dev: DeviceDetail = {
      id,
      name: body.name || "Nova Horta",
      location: body.location || "Setor Experimental",
      type: body.type || "Arduino Uno + Sensor",
      status: "online",
      moisture: 56,
      temperature: 24.5,
      water: 85,
      ph: 6.5,
      crop: body.crop || "Hortaliças",
      irrigating: false,
      lastSeenAt: nowIso,
      firmware: "v5.2-I2C",
      connectivity: body.connectivity || "Wi-Fi / USB",
      installedAt: nowIso.slice(0, 10),
      minMoisture: body.minMoisture ?? 40,
      minPh: body.minPh ?? 5.8,
      maxPh: body.maxPh ?? 7.2,
      defaultDurationMin: body.defaultDurationMin ?? 15,
      defaultRegime: body.defaultRegime || "moderada",
      autoIrrigation: body.autoIrrigation ?? false,
      disconnectAlerts: body.disconnectAlerts ?? true,
      scheduleTime: "06:30",
      irrigationMinutes: 15,
      irrigationMode: null,
      irrigationRegime: null,
      irrigatingUntil: null,
      series: makeInitialSeries(56, 24.5, 85, 6.5),
      schedules: [],
      history: [],
    };
    state.devices[id] = dev;
    saveCloudState(state);
    return toSummary(dev) as T;
  }

  const devMatch = cleanPath.match(/^\/api\/devices\/([^/]+)$/);
  if (devMatch) {
    const id = decodeURIComponent(devMatch[1]);
    const dev = state.devices[id] || Object.values(state.devices)[0];
    if (dev) checkExpiration(dev);
    if (method === "GET") {
      if (dev) dev.defaultDurationSec = getDeviceDurationSeconds(dev.id, dev.defaultDurationMin);
      saveCloudState(state);
      return dev as T;
    }
    if (method === "PUT") {
      Object.assign(dev, body);
      saveCloudState(state);
      return dev as T;
    }
    if (method === "DELETE") {
      delete state.devices[id];
      saveCloudState(state);
      return undefined as T;
    }
  }

  const settingsMatch = cleanPath.match(/^\/api\/devices\/([^/]+)\/settings$/);
  if (settingsMatch && method === "PATCH") {
    const id = decodeURIComponent(settingsMatch[1]);
    const dev = state.devices[id];
    if (dev) {
      checkExpiration(dev);
      const sec = body.defaultDurationSec && body.defaultDurationSec >= 30
        ? setDeviceDurationSeconds(id, body.defaultDurationSec)
        : setDeviceDurationSeconds(id, (body.defaultDurationMin || dev.defaultDurationMin || 1) * 60);
      Object.assign(dev, body, {
        defaultDurationSec: sec,
        defaultDurationMin: Math.max(1, Math.round(sec / 60)),
      });
      if (!dev.autoIrrigation && dev.irrigating && dev.irrigationMode !== "manual") {
        dev.irrigating = false;
        dev.irrigatingUntil = null;
      } else if (dev.autoIrrigation && dev.moisture !== null && dev.moisture < dev.minMoisture && !dev.irrigating) {
        dev.irrigating = true;
        dev.irrigationMode = "agendada";
        dev.irrigationRegime = dev.defaultRegime || "moderada";
        dev.irrigationMinutes = 0;
        dev.irrigatingUntil = new Date(Date.now() + 14400 * 1000).toISOString();
      } else if (dev.autoIrrigation && dev.moisture !== null && dev.moisture >= dev.minMoisture && dev.irrigating) {
        dev.irrigating = false;
        dev.irrigatingUntil = null;
      }
      saveCloudState(state);
      return dev as T;
    }
  }

  const startMatch = cleanPath.match(/^\/api\/devices\/([^/]+)\/irrigation\/start$/);
  if (startMatch && method === "POST") {
    const id = decodeURIComponent(startMatch[1]);
    const dev = state.devices[id];
    if (dev) {
      const sec = body.seconds && body.seconds >= 30
        ? setDeviceDurationSeconds(id, body.seconds)
        : body.minutes
        ? setDeviceDurationSeconds(id, body.minutes * 60)
        : getDeviceDurationSeconds(id, dev.defaultDurationMin);
      const mins = Math.max(1, Math.round(sec / 60));
      const reg: RegimeKey = body.regime || dev.defaultRegime || "moderada";
      dev.defaultDurationSec = sec;
      dev.defaultDurationMin = mins;
      dev.irrigating = true;
      dev.irrigationMinutes = mins;
      dev.irrigationRegime = reg;
      dev.irrigationMode = "manual";
      dev.irrigatingUntil = new Date(Date.now() + sec * 1000).toISOString();
      dev.history.unshift({
        id: Date.now(),
        deviceId: dev.id,
        deviceName: dev.name,
        startedAt: new Date().toISOString(),
        endedAt: null,
        plannedMinutes: mins,
        actualMinutes: 1,
        running: true,
        mode: "manual",
        regime: reg,
        scheduleName: "Acionamento Manual",
        estimatedMm: Number(((mins / 60) * 14).toFixed(1)),
      });
      saveCloudState(state);
      return dev as T;
    }
  }

  const stopMatch = cleanPath.match(/^\/api\/devices\/([^/]+)\/irrigation\/stop$/);
  if (stopMatch && method === "POST") {
    const id = decodeURIComponent(stopMatch[1]);
    const dev = state.devices[id];
    if (dev) {
      dev.irrigating = false;
      dev.irrigatingUntil = null;
      if (dev.history[0]?.running) {
        dev.history[0].running = false;
        dev.history[0].endedAt = new Date().toISOString();
      }
      saveCloudState(state);
      return dev as T;
    }
  }

  const ingestMatch = cleanPath.match(/^\/api\/ingest\/([^/]+)\/readings$/);
  if (ingestMatch && method === "POST") {
    const id = decodeURIComponent(ingestMatch[1]);
    const dev = state.devices[id];
    if (dev) {
      const nowIso = new Date().toISOString();
      dev.moisture = body.moisture ?? dev.moisture;
      dev.temperature = body.temperature ?? dev.temperature;
      dev.water = body.water ?? dev.water;
      dev.ph = body.ph ?? dev.ph;
      dev.lastSeenAt = nowIso;
      dev.series.push({
        t: nowIso,
        moisture: dev.moisture,
        temperature: dev.temperature,
        water: dev.water,
        ph: dev.ph,
      });
      if (dev.series.length > 24) dev.series.shift();
      if (dev.autoIrrigation && dev.moisture !== null && dev.moisture < dev.minMoisture && !dev.irrigating) {
        dev.irrigating = true;
        dev.irrigationMode = "agendada";
        dev.irrigationRegime = dev.defaultRegime;
        dev.irrigationMinutes = 0;
        dev.irrigatingUntil = new Date(Date.now() + 14400 * 1000).toISOString();
      } else if (dev.autoIrrigation && dev.moisture !== null && dev.moisture >= dev.minMoisture && dev.irrigating) {
        dev.irrigating = false;
        dev.irrigatingUntil = null;
      }
      saveCloudState(state);
    }
    return undefined as T;
  }

  const schedMatch = cleanPath.match(/^\/api\/devices\/([^/]+)\/schedules$/);
  if (schedMatch) {
    const id = decodeURIComponent(schedMatch[1]);
    const dev = state.devices[id];
    if (method === "GET") return (dev?.schedules || []) as T;
    if (method === "POST" && dev) {
      const s: Schedule = {
        id: Date.now(),
        deviceId: id,
        name: body.name || "Programação",
        days: body.days || [1, 2, 3, 4, 5],
        startTime: body.startTime || "06:30",
        durationMin: body.durationMin || 15,
        regime: body.regime || "moderada",
        estimatedMm: 3.5,
        enabled: body.enabled ?? true,
        nextRunAt: new Date(Date.now() + 3600000 * 6).toISOString(),
      };
      dev.schedules.push(s);
      saveCloudState(state);
      return s as T;
    }
  }

  const schedItemMatch = cleanPath.match(/^\/api\/devices\/([^/]+)\/schedules\/(\d+)$/);
  if (schedItemMatch) {
    const id = decodeURIComponent(schedItemMatch[1]);
    const schedId = Number(schedItemMatch[2]);
    const dev = state.devices[id];
    if (dev) {
      const idx = dev.schedules.findIndex((s) => s.id === schedId);
      if (idx >= 0) {
        if (method === "DELETE") {
          dev.schedules.splice(idx, 1);
          saveCloudState(state);
          return undefined as T;
        }
        Object.assign(dev.schedules[idx], body);
        saveCloudState(state);
        return dev.schedules[idx] as T;
      }
    }
  }

  if (cleanPath === "/api/regimes") return DEFAULT_REGIMES as T;
  if (cleanPath === "/api/irrigations") {
    return Object.values(state.devices).flatMap((d) => d.history) as T;
  }
  if (cleanPath === "/api/alerts") {
    return {
      items: state.alerts,
      summary: {
        unread: state.alerts.filter((a) => !a.read).length,
        highPriority: state.alerts.filter((a) => !a.read && a.level === "high").length,
        attention: state.alerts.filter((a) => !a.read && a.level === "medium").length,
        resolvedThisMonth: 12,
      },
    } as T;
  }
  if (cleanPath === "/api/alerts/read-all") {
    state.alerts.forEach((a) => (a.read = true));
    saveCloudState(state);
    return undefined as T;
  }
  const alertReadMatch = cleanPath.match(/^\/api\/alerts\/(\d+)\/read$/);
  if (alertReadMatch) {
    const aid = Number(alertReadMatch[1]);
    const found = state.alerts.find((a) => a.id === aid);
    if (found) found.read = true;
    saveCloudState(state);
    return undefined as T;
  }

  if (cleanPath === "/api/settings") {
    if (method === "PUT") {
      state.settings = { ...state.settings, ...body };
      saveCloudState(state);
    }
    return state.settings as T;
  }

  return undefined as T;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const candidates = resolveCandidateBaseUrls();

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (response.ok) {
        if (response.status === 204 || response.status === 202) return undefined as T;
        const text = await response.text();
        if (text && !text.trim().startsWith("<!doctype") && !text.trim().startsWith("<html")) {
          return JSON.parse(text) as T;
        }
        if (!text) return undefined as T;
      }
      if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 409) {
        let message = `Erro ${response.status} ao comunicar com o servidor.`;
        try {
          const body = await response.json();
          if (body?.message) message = body.message;
        } catch {}
        throw new ApiError(message);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }
  }

  return handleCloudFallback<T>(path, options);
}

export type CreateDevicePayload = {
  name: string;
  type: string;
  id: string;
  location: string;
  crop?: string;
  connectivity?: string;
  minMoisture?: number;
  defaultDurationMin?: number;
  autoIrrigation?: boolean;
  disconnectAlerts?: boolean;
  minPh?: number;
  maxPh?: number;
  defaultRegime?: RegimeKey;
};

export type DeviceSettingsPayload = {
  minMoisture: number;
  defaultDurationMin: number;
  defaultDurationSec?: number;
  autoIrrigation: boolean;
  disconnectAlerts: boolean;
  minPh?: number;
  maxPh?: number;
  defaultRegime?: RegimeKey;
};

export type SchedulePayload = { name: string; days: number[]; startTime: string; durationMin: number; regime: RegimeKey; enabled?: boolean };

export const api = {
  dashboard: () => request<DashboardResponse>("/api/dashboard"),
  devices: () => request<DeviceSummary[]>("/api/devices"),
  device: async (id: string, days: 1 | 7 | 30 = 1) => {
    const d = await request<DeviceDetail>(`/api/devices/${id}?days=${days}`);
    if (d) d.defaultDurationSec = getDeviceDurationSeconds(d.id, d.defaultDurationMin);
    return d;
  },
  createDevice: (data: CreateDevicePayload) =>
    request<DeviceSummary>("/api/devices", { method: "POST", body: JSON.stringify(data) }),
  updateDeviceProfile: (id: string, data: { name: string; type: string; location: string; crop?: string; connectivity?: string }) =>
    request<DeviceDetail>(`/api/devices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDevice: (id: string) => request<void>(`/api/devices/${id}`, { method: "DELETE" }),
  updateDeviceSettings: async (id: string, data: DeviceSettingsPayload) => {
    const sec = data.defaultDurationSec && data.defaultDurationSec >= 30
      ? setDeviceDurationSeconds(id, data.defaultDurationSec)
      : setDeviceDurationSeconds(id, Math.max(30, (data.defaultDurationMin || 1) * 60));
    const payload = {
      ...data,
      defaultDurationSec: sec,
      defaultDurationMin: Math.max(1, Math.ceil(sec / 60)),
    };
    const updated = await request<DeviceDetail>(`/api/devices/${id}/settings`, { method: "PATCH", body: JSON.stringify(payload) });
    if (updated) updated.defaultDurationSec = sec;
    return updated;
  },
  startIrrigation: async (id: string, minutes?: number, regime?: RegimeKey, seconds?: number) => {
    const sec = seconds && seconds >= 30
      ? setDeviceDurationSeconds(id, seconds)
      : minutes && minutes > 0
      ? setDeviceDurationSeconds(id, minutes * 60)
      : getDeviceDurationSeconds(id, 1);
    const mins = Math.max(1, Math.ceil(sec / 60));
    const updated = await request<DeviceDetail>(`/api/devices/${id}/irrigation/start`, {
      method: "POST",
      body: JSON.stringify({ minutes: mins, seconds: sec, regime }),
    });
    if (updated) updated.defaultDurationSec = sec;
    return updated;
  },
  stopIrrigation: (id: string) => request<DeviceDetail>(`/api/devices/${id}/irrigation/stop`, { method: "POST" }),

  regimes: () => request<Regime[]>("/api/regimes"),
  irrigations: (days = 7) => request<IrrigationLogItem[]>(`/api/irrigations?days=${days}`),

  schedules: (deviceId: string) => request<Schedule[]>(`/api/devices/${deviceId}/schedules`),
  createSchedule: (deviceId: string, data: SchedulePayload) =>
    request<Schedule>(`/api/devices/${deviceId}/schedules`, { method: "POST", body: JSON.stringify(data) }),
  updateSchedule: (deviceId: string, scheduleId: number, data: SchedulePayload) =>
    request<Schedule>(`/api/devices/${deviceId}/schedules/${scheduleId}`, { method: "PUT", body: JSON.stringify(data) }),
  toggleSchedule: (deviceId: string, scheduleId: number, enabled: boolean) =>
    request<Schedule>(`/api/devices/${deviceId}/schedules/${scheduleId}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  deleteSchedule: (deviceId: string, scheduleId: number) =>
    request<void>(`/api/devices/${deviceId}/schedules/${scheduleId}`, { method: "DELETE" }),

  alerts: (onlyUnread: boolean) => request<AlertsResponse>(`/api/alerts?onlyUnread=${onlyUnread}`),
  markAlertRead: (id: number) => request<void>(`/api/alerts/${id}/read`, { method: "POST" }),
  markAllAlertsRead: () => request<void>("/api/alerts/read-all", { method: "POST" }),
  settings: () => request<Settings>("/api/settings"),
  updateSettings: (data: Settings) => request<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(data) }),

  login: async (data: LoginPayload): Promise<Settings> => {
    const users = getLocalUsers();
    const found = users.find((u) => u.email.toLowerCase() === data.email.trim().toLowerCase());
    if (!found) throw new ApiError("E-mail não encontrado. Crie sua conta na aba 'Criar Nova Conta'.");
    if (found.password !== data.password.trim()) throw new ApiError("Senha incorreta. Acesso negado.");
    const current = await request<Settings>("/api/settings");
    return await request<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...current,
        fullName: found.fullName,
        email: found.email,
        phone: found.phone || current.phone,
        role: found.role || "Operador(a) de Irrigação",
        propertyName: found.propertyName || current.propertyName,
        propertyLocation: found.propertyLocation || current.propertyLocation,
      }),
    });
  },

  register: async (data: RegisterPayload): Promise<Settings> => {
    const cleanEmail = data.email.trim().toLowerCase();
    // Bloqueia qualquer tentativa de criar/sobrescrever as contas de Administrador do Pedro Henrique e do Dori
    if (PROTECTED_ADMIN_EMAILS.includes(cleanEmail)) {
      throw new ApiError("Este e-mail pertence a uma conta Administradora protegida (Pedro Henrique / Dori Amado). Faça login com a senha de administrador.");
    }
    const existingUsers = getLocalUsers();
    if (existingUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new ApiError("Já existe um usuário cadastrado com este e-mail. Use a aba de Login.");
    }
    const safeRole = (!data.role || data.role.toLowerCase().startsWith("administrador"))
      ? "Operador(a) de Irrigação"
      : data.role;

    const newUser: RegisterPayload = { ...data, email: cleanEmail, role: safeRole };
    existingUsers.push(newUser);
    saveLocalUsers(existingUsers);

    const current = await request<Settings>("/api/settings");
    return await request<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...current,
        fullName: data.fullName.trim(),
        email: cleanEmail,
        phone: data.phone?.trim() || "",
        role: safeRole,
        propertyName: data.propertyName?.trim() || "Horta Inteligente Verda",
        propertyLocation: data.propertyLocation?.trim() || "Porto Alegre, RS",
      }),
    });
  },

  getActiveArduinoDevice: async (): Promise<{ deviceId: string }> => {
    try {
      const res = await request<{ deviceId: string }>("/api/ingest/active-device");
      if (res?.deviceId) {
        localStorage.setItem(ACTIVE_ARDUINO_KEY, res.deviceId);
        return res;
      }
    } catch {}
    return { deviceId: localStorage.getItem(ACTIVE_ARDUINO_KEY) || "ARD-IRR-0421" };
  },

  setActiveArduinoDevice: async (deviceId: string): Promise<{ deviceId: string }> => {
    localStorage.setItem(ACTIVE_ARDUINO_KEY, deviceId);
    try {
      await request<{ deviceId: string }>(`/api/ingest/active-device/${deviceId}`, { method: "PUT" });
    } catch {}
    return { deviceId };
  },

  simulateSensorReading: (deviceId: string, payload: { moisture: number; temperature: number; water: number; ph: number }) =>
    request<void>(`/api/ingest/${deviceId}/readings`, { method: "POST", body: JSON.stringify(payload) }),
};

export function relativeTime(iso: string | null): string {
  if (!iso) return "Sem dados";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function formatRunAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoje às ${hhmm}`;
  if (isTomorrow) return `Amanhã às ${hhmm}`;
  return `${WEEKDAY_SHORT[(d.getDay() + 6) % 7]} às ${hhmm}`;
}

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
  propertyName?: string;
  propertyLocation?: string;
};

const LOCAL_USERS_KEY = "verda_registered_users_v2";
const ACTIVE_ARDUINO_KEY = "verda_active_arduino_device_id";

function getLocalUsers(): RegisterPayload[] {
  const admins: RegisterPayload[] = [
    { fullName: "Pedro Henrique Tavares de Andrade", email: "pedro@senacrs.edu.br", password: "123456", phone: "(51) 99981-2026", role: "Administrador(a)", propertyName: "Horta Experimental Senac", propertyLocation: "Porto Alegre, RS" },
    { fullName: "Dori Amado C. V. Z. Aguzzoli", email: "dori@senacrs.edu.br", password: "123456", phone: "(51) 99982-2026", role: "Administrador(a)", propertyName: "Horta Experimental Senac", propertyLocation: "Porto Alegre, RS" },
  ];
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed: RegisterPayload[] = JSON.parse(raw);
      const custom = parsed.filter(
        (u) =>
          u.email &&
          u.email.toLowerCase() !== "marina@fazenda.com" &&
          !PROTECTED_ADMIN_EMAILS.includes(u.email.toLowerCase())
      );
      return [...admins, ...custom];
    }
  } catch {}
  return admins;
}

function saveLocalUsers(users: RegisterPayload[]) {
  try {
    localStorage.setItem(
      LOCAL_USERS_KEY,
      JSON.stringify(users.filter((u) => u.email.toLowerCase() !== "marina@fazenda.com"))
    );
  } catch {}
}