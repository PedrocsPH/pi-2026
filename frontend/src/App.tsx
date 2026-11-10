import { FOTO_1_DATA, FOTO_2_DATA, FOTO_3_DATA, DIAGRAMA_1_DATA, DIAGRAMA_2_DATA, DIAGRAMA_3_DATA, DIAGRAMA_4_DATA } from "./projectAssets";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, relativeTime, formatRunAt, WEEKDAY_SHORT, getDeviceDurationSeconds, setDeviceDurationSeconds, formatDurationLabel, type AlertItem, type DeviceDetail, type DeviceSummary, type Settings as SettingsData, type Regime, type RegimeKey, type Schedule, type IrrigationLogItem } from "./api";

/** Catálogo de regimes de chuva. Buscado uma vez da API e cacheado em memória — usado no cadastro e no detalhe do dispositivo. */
let regimesCache: Regime[] | null = null;
function useRegimes(): Regime[] {
  const [regimes, setRegimes] = useState<Regime[]>(regimesCache ?? []);
  useEffect(() => {
    if (regimesCache) return;
    api.regimes().then((r) => { regimesCache = r; setRegimes(r); }).catch(() => {});
  }, []);
  return regimes;
}

const REGIME_TONE: Record<RegimeKey, string> = { garoa: "cyan", leve: "green", moderada: "amber", forte: "blue" };

/** Perfil da conta (nome, propriedade...), compartilhado entre o cabeçalho, o menu lateral e a página de configurações. */
type Profile = { fullName: string; email: string; role: string; propertyName: string; propertyLocation: string };
const DEFAULT_PROFILE: Profile = { fullName: "Pedro Henrique Tavares de Andrade", email: "pedro@senacrs.edu.br", role: "Administrador(a)", propertyName: "Horta Experimental Senac", propertyLocation: "Porto Alegre, RS" };
const ProfileContext = createContext<{ profile: Profile; refreshProfile: () => void; navigate: (p: Page) => void; theme: "light" | "dark"; toggleTheme: () => void }>({ profile: DEFAULT_PROFILE, refreshProfile: () => {}, navigate: () => {}, theme: "light", toggleTheme: () => {} });

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]).join("").toUpperCase() || "—";
}

type Page = "dashboard" | "devices" | "device" | "add" | "alerts" | "settings" | "about" | "auth";

const navItems: { id: Page; label: string; icon: IconName; section?: string }[] = [
  { id: "dashboard", label: "Visão geral", icon: "grid", section: "OPERAÇÃO & SENSORES" },
  { id: "devices", label: "Meus dispositivos", icon: "cpu" },
  { id: "alerts", label: "Alertas", icon: "bell" },
  { id: "about", label: "Sobre o projeto (PI)", icon: "book", section: "PROJETO & CONTA" },
  { id: "settings", label: "Configurações", icon: "settings" },
  { id: "auth", label: "Login / Cadastro", icon: "user" },
];

type IconName = "grid" | "cpu" | "bell" | "settings" | "droplet" | "thermometer" | "waves" | "sprout" | "plus" | "search" | "chevron" | "arrow" | "clock" | "activity" | "map" | "more" | "wifi" | "user" | "shield" | "palette" | "logout" | "menu" | "close" | "check" | "zap" | "calendar" | "filter" | "flask" | "cloudrain" | "trash" | "edit" | "book" | "sun" | "moon";

const paths: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><rect x="9" y="9" width="6" height="6" rx="1"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3v-4h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88L4.2 6.56l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.38.6 1 .6 1h1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
  droplet: <path d="M12 2.7S5.5 10 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10 12 2.7 12 2.7Z"/>,
  thermometer: <><path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"/><path d="M12 9v7"/></>,
  waves: <><path d="M2 7c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 12c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 17c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/></>,
  sprout: <><path d="M12 22V10"/><path d="M7 14c-3.5 0-5-2-5-6 4 0 7 1.5 7 5"/><path d="M14 9c0-4 3-6 8-6 0 5-2.5 8-8 8"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  arrow: <path d="m5 12 14 0m-5-5 5 5-5 5"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  activity: <path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  palette: <><circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16" cy="9" r="1"/><path d="M15 17c-1 0-2-.7-2-1.5s.7-1.5 1.5-1.5H17c2 0 3-1 3-3"/></>,
  logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4m4-4H9"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  zap: <path d="m13 2-9 12h8l-1 8 9-12h-8Z"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8Z"/>,
  flask: <><path d="M9 2h6M10 2v6.2L4.7 18a1.8 1.8 0 0 0 1.6 2.7h11.4a1.8 1.8 0 0 0 1.6-2.7L14 8.2V2"/><path d="M7.5 14h9"/></>,
  cloudrain: <><path d="M17.5 18a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4 1.8A4 4 0 0 0 6.5 18h11Z"/><path d="M8 20v1.5M12 20v2.5M16 20v1.5"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></>,
  edit: <><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
  book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6M8 11h8"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>,
};

function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Status({ status }: { status: DeviceSummary["status"] }) {
  const labels = { online: "Online", offline: "Offline", alerta: "Requer atenção" };
  return <span className={`status status-${status}`}><i />{labels[status]}</span>;
}

function Button({ children, variant = "primary", className = "", onClick, type = "button", disabled = false }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant} ${className}`}>{children}</button>;
}

function MiniChart({ color = "#00a67e", fill = "#e7f7f1", points }: { color?: string; fill?: string; points?: string }) {
  const p = points || "0,45 30,38 60,42 90,24 120,29 150,18 180,23 210,10 240,16 270,8 300,12";
  return <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="h-full w-full overflow-visible">
    <defs><linearGradient id={`g${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={fill}/><stop offset="1" stopColor={fill} stopOpacity="0"/></linearGradient></defs>
    <polygon points={`${p} 300,60 0,60`} fill={`url(#g${color.slice(1)})`}/>
    <polyline points={p} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

/** Converte uma série de leituras em pontos "x,y" para as mini-visualizações SVG (sparkline e gráficos grandes). */
function seriesToPoints(series: { moisture: number | null }[], width: number, height: number, fallback: number): string {
  const values = series.map((p) => (p.moisture == null ? fallback : p.moisture));
  if (values.length === 0) values.push(fallback, fallback);
  if (values.length === 1) values.push(values[0]);
  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - (Math.max(0, Math.min(100, v)) / 100) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const WEEKDAYS_PT = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function formatEyebrowDate(d = new Date()) {
  return `${WEEKDAYS_PT[d.getDay()]}, ${d.getDate()} DE ${MONTHS_PT[d.getMonth()].toUpperCase()}`;
}

function formatDatePt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatScheduleLabel(scheduleTime: string | null) {
  if (!scheduleTime) return "Não programada";
  const hhmm = scheduleTime.slice(0, 5);
  const now = new Date();
  const [h, m] = scheduleTime.split(":").map(Number);
  const isFuture = h > now.getHours() || (h === now.getHours() && m > now.getMinutes());
  return `${isFuture ? "Hoje" : "Amanhã"} às ${hhmm}`;
}

/** Mensagem amigável de estado (carregando/erro/vazio), reaproveitando o cartão de "tudo em dia" já existente no CSS. */
function StateNotice({ text }: { text: string }) {
  return <div className="card empty-state"><Icon name="activity" size={26}/><b>{text}</b></div>;
}

/** Converte uma série (qualquer métrica) em pontos "x,y" para um gráfico com domínio [min,max] configurável. */
function seriesToPointsGeneric(series: (number | null)[], width: number, height: number, fallback: number, min: number, max: number): string {
  const values = series.map((v) => (v == null ? fallback : v));
  if (values.length === 0) values.push(fallback, fallback);
  if (values.length === 1) values.push(values[0]);
  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const clamped = Math.max(min, Math.min(max, v));
    const y = height - ((clamped - min) / (max - min)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function fmtPh(v: number | null | undefined) { return v == null ? "—" : v.toFixed(1); }

/** Barrinha 0–14 com a faixa ideal marcada e um ponteiro no valor atual — usada em cartões de pH. */
function PhBar({ value, min, max }: { value: number | null; min: number; max: number }) {
  const pct = (v: number) => Math.max(0, Math.min(100, (v / 14) * 100));
  const outOfRange = value != null && (value < min || value > max);
  return <div className="ph-bar">
    <div className="ph-track">
      <span className="ph-band" style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }} />
      {value != null && <i className={`ph-pointer ${outOfRange ? "out" : ""}`} style={{ left: `${pct(value)}%` }} />}
    </div>
    <div className="ph-scale"><span>0</span><span>7</span><span>14</span></div>
  </div>;
}

/** Cartão de regime de chuva selecionável (usado no controle manual e implicitamente nas programações). */
function RegimeOption({ regime, selected, onSelect }: { regime: Regime; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`regime-option ${selected ? "selected" : ""}`} onClick={onSelect}>
    <span className={`regime-icon ${REGIME_TONE[regime.key]}`}><Icon name="cloudrain" size={17}/></span>
    <div><b>{regime.label}</b><p>{regime.description}</p></div>
    <div className="regime-stats"><span>{regime.pumpPower}% bomba</span><span>{regime.mmPerHour} mm/h</span></div>
  </button>;
}

const DAY_LABELS = [{ n: 1, l: "Seg" }, { n: 2, l: "Ter" }, { n: 3, l: "Qua" }, { n: 4, l: "Qui" }, { n: 5, l: "Sex" }, { n: 6, l: "Sáb" }, { n: 7, l: "Dom" }];

function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  const toggle = (n: number) => onChange(days.includes(n) ? days.filter(d => d !== n) : [...days, n].sort());
  return <div className="day-picker">{DAY_LABELS.map(d => <button type="button" key={d.n} className={days.includes(d.n) ? "active" : ""} onClick={() => toggle(d.n)}>{d.l}</button>)}</div>;
}

function daysLabel(days: number[]) {
  if (days.length === 7) return "Todos os dias";
  const weekdays = [1, 2, 3, 4, 5];
  if (days.length === 5 && weekdays.every(d => days.includes(d))) return "Dias úteis";
  if (days.length === 2 && days.includes(6) && days.includes(7)) return "Fins de semana";
  return days.map(n => DAY_LABELS.find(d => d.n === n)?.l).join(", ");
}

function Header({ title, eyebrow }: { title: string; eyebrow?: string; onMenu?: () => void }) {
  const { profile, navigate, theme, toggleTheme } = useContext(ProfileContext);
  return <header className="page-header">
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      title={theme === "dark" ? "Mudar para Tema Claro" : "Mudar para Tema Escuro"}
      aria-label="Alternar tema claro e escuro"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
    </button>
    <div className="min-w-0">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
    </div>
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      <button className="select-btn hidden sm:flex" onClick={() => navigate("auth")} title="Entrar ou cadastrar outra conta">
        <Icon name="user" size={14}/> Conta / Login
      </button>
      <button className="icon-btn relative" aria-label="Ver alertas" onClick={() => navigate("alerts")}><Icon name="bell" size={19}/><span className="notification-dot" /></button>
      <button className="header-user" onClick={() => navigate("settings")}>
        <div className="avatar">{initials(profile.fullName)}</div>
        <div className="hidden sm:block"><strong>{profile.fullName}</strong><span>{profile.role || "—"}</span></div>
        <Icon name="chevron" size={14} className="hidden sm:block rotate-90 text-slate-400"/>
      </button>
    </div>
  </header>;
}

function Sidebar({ page, setPage, open, close, unreadAlerts }: { page: Page; setPage: (p: Page) => void; open: boolean; close: () => void; unreadAlerts: number }) {
  const { profile } = useContext(ProfileContext);
  return <>
    {open && <div className="sidebar-scrim lg:hidden" onClick={close}/>}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><Icon name="sprout" size={24}/><span /></div>
        <div><b>Verda</b><small>IoT Irrigação</small></div>
        <button onClick={close} className="ml-auto text-white/70 lg:hidden"><Icon name="close" /></button>
      </div>
      <button className="farm-chip" onClick={() => { setPage("settings"); close(); }}><span className="farm-avatar">{initials(profile.propertyName)}</span><div><small>PROPRIEDADE</small><b>{profile.propertyName}</b></div><Icon name="chevron" size={15} className="ml-auto rotate-90"/></button>
      <nav>
        {navItems.map((item) => <div key={item.id}>
          {item.section && <p className={item.id === "dashboard" ? "nav-label" : "nav-section-divider"}>{item.section}</p>}
          <button className={(page === item.id || (page === "device" && item.id === "devices") || (page === "add" && item.id === "devices")) ? "active" : ""} onClick={() => { setPage(item.id); close(); }}>
            <Icon name={item.icon} size={19}/><span>{item.label}</span>{item.id === "alerts" && unreadAlerts > 0 && <em>{unreadAlerts}</em>}
          </button>
        </div>)}
      </nav>
      <div className="sidebar-health">
        <div><Icon name="activity" size={17}/><span>Saúde do sistema</span><b>100%</b></div>
        <div className="health-bar"><span style={{ width: "100%" }} /></div>
        <p>4 hortas monitoradas • IoT Online</p>
      </div>
      <button className="sidebar-footer" onClick={() => { setPage("auth"); close(); }} title="Trocar de conta ou fazer login">
        <div className="avatar">{initials(profile.fullName)}</div><div><b>{profile.fullName}</b><span>{profile.email || "Trocar conta"}</span></div><Icon name="logout" size={15} className="ml-auto"/>
      </button>
    </aside>
  </>;
}

function MetricCard({ icon, tone, label, value, unit, detail, children }: { icon: IconName; tone: string; label: string; value: string; unit?: string; detail: string; children?: ReactNode }) {
  return <div className="card metric-card">
    <div className={`metric-icon ${tone}`}><Icon name={icon} size={20}/></div>
    <div className="metric-copy"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{detail}</p></div>
    {children && <div className="metric-visual">{children}</div>}
  </div>;
}

function Dashboard({ navigate, openDevice }: { navigate: (p: Page) => void; openDevice: (id: string) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.dashboard>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchDash = () => {
      api.dashboard().then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => { if (alive && !data) setError(e instanceof ApiError ? e.message : "Não foi possível carregar o painel."); });
    };
    fetchDash();
    const timer = window.setInterval(fetchDash, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  if (error) return <div><Header title="Visão geral" onMenu={() => {}}/><main className="page-content"><StateNotice text={error}/></main></div>;
  if (!data) return <div><Header title="Visão geral" onMenu={() => {}}/><main className="page-content"><StateNotice text="Carregando painel..."/></main></div>;

  const onlinePct = data.deviceCounts.total ? Math.round((data.deviceCounts.online / data.deviceCounts.total) * 100) : 0;
  const chartPoints = seriesToPoints(data.moistureSeries, 700, 180, data.avgMoisture ?? 55);
  const lastPoint = chartPoints.split(" ").pop()!.split(",");
  const deltaLabel = data.avgMoistureDeltaPercent == null ? "Sem histórico suficiente"
    : `${data.avgMoistureDeltaPercent >= 0 ? "+" : ""}${data.avgMoistureDeltaPercent.toFixed(0)}% nas últimas 24h`;

  return <div>
    <Header title={`Bom dia, ${data.greetingName}`} eyebrow={formatEyebrowDate()} onMenu={() => {}}/>
    <main className="page-content">
      <section className="welcome-row">
        <div><p>Acompanhe a operação da sua irrigação em tempo real.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("about")}><Icon name="book" size={17}/>Sobre o projeto (PI)</Button>
          <Button onClick={() => navigate("add")}><Icon name="plus" size={18}/>Adicionar dispositivo</Button>
        </div>
      </section>
      <section className="metrics-grid">
        <MetricCard icon="cpu" tone="green" label="Dispositivos" value={String(data.deviceCounts.total)} detail={`${data.deviceCounts.online} operando normalmente`}><div className="donut"><b>{onlinePct}%</b></div></MetricCard>
        <MetricCard icon="droplet" tone="cyan" label="Umidade média" value={data.avgMoisture == null ? "—" : data.avgMoisture.toFixed(0)} unit="%" detail={deltaLabel}><div className="spark"><MiniChart color="#159bbb" fill="#dff5f8" points={seriesToPoints(data.moistureSeries.slice(-11), 300, 55, data.avgMoisture ?? 55)}/></div></MetricCard>
        <MetricCard icon="waves" tone="blue" label="Nível dos reservatórios" value={data.avgWaterLevel == null ? "—" : data.avgWaterLevel.toFixed(0)} unit="%" detail={data.avgWaterLevel != null && data.avgWaterLevel < 40 ? "Abaixo do nível recomendado" : "Dentro do nível ideal"}><div className="tank"><span style={{ height: `${Math.round(data.avgWaterLevel ?? 0)}%` }}/><i>{data.avgWaterLevel == null ? "—" : `${data.avgWaterLevel.toFixed(0)}%`}</i></div></MetricCard>
        <MetricCard icon="bell" tone="amber" label="Alertas ativos" value={String(data.activeAlerts)} detail={`${data.highPriorityAlerts} alerta(s) de alta prioridade`}><span className="trend-badge" onClick={() => navigate("alerts")}>Ver alertas <Icon name="arrow" size={13}/></span></MetricCard>
      </section>

      <section className="metrics-grid secondary-grid">
        <MetricCard icon="flask" tone="violet" label="pH médio do solo" value={fmtPh(data.avgPh)} detail="Faixa ideal varia por cultura, veja no dispositivo"/>
        <MetricCard icon="thermometer" tone="amber" label="Temperatura média" value={data.avgTemperature == null ? "—" : data.avgTemperature.toFixed(1)} unit="°C" detail="Média entre todos os dispositivos"/>
        <MetricCard icon="cloudrain" tone="green" label="Regas hoje" value={String(data.irrigationsToday)} detail={`${data.waterMmToday.toFixed(1)} mm de água aplicada`}><span className="trend-badge" style={{ color: data.irrigatingNow ? "#0a8a68" : "#899994" }}>{data.irrigatingNow > 0 ? `${data.irrigatingNow} irrigando agora` : "Nenhuma em andamento"}</span></MetricCard>
      </section>

      <section className="dashboard-main">
        <div className="card chart-card">
          <div className="card-heading"><div><h2>Umidade do solo</h2><p>Média dos dispositivos nas últimas 24 horas</p></div><button className="select-btn" onClick={() => navigate("devices")} title="Ver histórico detalhado por dispositivo">Últimas 24h <Icon name="chevron" size={14} className="rotate-90"/></button></div>
          <div className="legend"><span><i className="bg-emerald-500"/>Umidade média</span><span><i className="bg-cyan-400"/>Faixa ideal</span></div>
          <div className="big-chart">
            <div className="y-labels"><span>80%</span><span>60%</span><span>40%</span><span>20%</span></div>
            <div className="chart-area">
              <span className="ideal-band" />
              <svg viewBox="0 0 700 180" preserveAspectRatio="none">
                <defs><linearGradient id="dashfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#13a47b" stopOpacity=".24"/><stop offset="1" stopColor="#13a47b" stopOpacity="0"/></linearGradient></defs>
                <polygon points={`${chartPoints} 700,180 0,180`} fill="url(#dashfill)"/>
                <polyline points={chartPoints} fill="none" stroke="#119b74" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx={lastPoint[0]} cy={lastPoint[1]} r="5" fill="#fff" stroke="#119b74" strokeWidth="3"/>
              </svg>
              <div className="x-labels"><span>00h</span><span>04h</span><span>08h</span><span>12h</span><span>16h</span><span>20h</span><span>Agora</span></div>
            </div>
          </div>
        </div>
        <div className="card alerts-card">
          <div className="card-heading"><div><h2>Alertas recentes</h2><p>O que precisa da sua atenção</p></div><button onClick={() => navigate("alerts")} className="link-button">Ver todos</button></div>
          <div className="alert-list">
            {data.recentAlerts.length ? data.recentAlerts.map((a) => <AlertRow key={a.id} alert={a}/>) : <p style={{ padding: "12px 2px", color: "#8c9c98", fontSize: "10px" }}>Nenhum alerta recente.</p>}
          </div>
          <button onClick={() => navigate("alerts")} className="alerts-footer">Ver central de alertas <Icon name="arrow" size={15}/></button>
        </div>
      </section>

      <section className="card devices-overview">
        <div className="card-heading"><div><h2>Seus dispositivos</h2><p>Status em tempo real da sua operação</p></div><button className="link-button" onClick={() => navigate("devices")}>Ver todos <Icon name="arrow" size={14}/></button></div>
        <div className="device-grid">{data.devices.slice(0, 3).map((d) => <DeviceCard key={d.id} device={d} onClick={() => openDevice(d.id)}/>)}</div>
      </section>

      <section className="dashboard-secondary">
        <div className="card weekly-card">
          <div className="card-heading"><div><h2>Rega aplicada na semana</h2><p>Lâmina de água estimada por dia, somando todos os dispositivos</p></div></div>
          <div className="bar-chart">{data.weeklyIrrigation.map((day) => {
            const max = Math.max(1, ...data.weeklyIrrigation.map(d => d.mm));
            const d = new Date(`${day.date}T00:00:00`);
            return <div key={day.date} className="bar-col">
              <span className="bar-value">{day.mm > 0 ? `${day.mm.toFixed(0)}mm` : ""}</span>
              <div className="bar-track"><i style={{ height: `${Math.max(3, (day.mm / max) * 100)}%` }}/></div>
              <small>{WEEKDAY_SHORT[(d.getDay() + 6) % 7]}</small>
            </div>;
          })}</div>
        </div>
        <div className="card upcoming-card">
          <div className="card-heading"><div><h2>Próximas regas</h2><p>Programações ativas</p></div></div>
          <div className="upcoming-list">{data.upcomingRuns.length ? data.upcomingRuns.map(u => <div key={u.scheduleId} className="upcoming-item" onClick={() => openDevice(u.deviceId)}>
            <span className={`regime-dot ${REGIME_TONE[u.regime]}`}/>
            <div><b>{u.scheduleName}</b><small>{u.deviceName} • {u.durationMin} min</small></div>
            <em>{formatRunAt(u.runAt)}</em>
          </div>) : <p style={{ padding: "12px 2px", color: "#8c9c98", fontSize: "10px" }}>Nenhuma programação ativa.</p>}</div>
        </div>
      </section>
    </main>
  </div>;
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const icon = alert.level === "high" ? "droplet" : alert.level === "medium" ? "wifi" : "waves";
  return <div className="alert-item">
    <div className={`alert-icon ${alert.level}`}><Icon name={icon} size={18}/></div>
    <div><strong>{alert.title}</strong><span>{alert.deviceName ?? "—"}</span></div><time>{relativeTime(alert.createdAt)}</time>
  </div>;
}

function DeviceCard({ device, onClick }: { device: DeviceSummary; onClick: () => void }) {
  return <button className="device-card" onClick={onClick}>
    <div className="device-top"><div className="device-symbol"><Icon name="cpu"/></div><Status status={device.status}/>{device.irrigating && <span className="irrigating-chip"><Icon name="droplet" size={11}/>Irrigando</span>}</div>
    <h3>{device.name}</h3><p><Icon name="map" size={14}/>{device.location}</p>
    {device.crop && <p className="crop-line"><Icon name="sprout" size={13}/>{device.crop}</p>}
    <div className="device-stats"><span><Icon name="droplet" size={15}/><b>{device.moisture == null ? "—" : `${device.moisture.toFixed(0)}%`}</b><small>Umidade</small></span><span><Icon name="thermometer" size={15}/><b>{device.temperature == null ? "—" : `${device.temperature.toFixed(1)}°`}</b><small>Temperatura</small></span><span><Icon name="waves" size={15}/><b>{device.water == null ? "—" : `${device.water.toFixed(0)}%`}</b><small>Água</small></span><span><Icon name="flask" size={15}/><b>{fmtPh(device.ph)}</b><small>pH</small></span></div>
    <div className="device-foot"><span><Icon name="clock" size={13}/>Atualizado {relativeTime(device.lastSeenAt).toLowerCase()}</span><Icon name="chevron" size={16}/></div>
  </button>;
}

function Devices({ openDevice, navigate }: { openDevice: (id: string) => void; navigate: (p: Page) => void }) {
  const [devices, setDevices] = useState<DeviceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | DeviceSummary["status"]>("todos");

  useEffect(() => {
    let alive = true;
    const fetchDevices = () => {
      api.devices().then((d) => { if (alive) { setDevices(d); setError(null); } }).catch((e) => { if (alive && !devices) setError(e instanceof ApiError ? e.message : "Não foi possível carregar os dispositivos."); });
    };
    fetchDevices();
    const timer = window.setInterval(fetchDevices, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const filtered = (devices ?? []).filter(d => (filter === "todos" || d.status === filter) && d.name.toLowerCase().includes(query.toLowerCase()));
  const counts = (devices ?? []).reduce((acc, d) => { acc[d.status]++; return acc; }, { online: 0, offline: 0, alerta: 0 } as Record<DeviceSummary["status"], number>);

  return <div><Header title="Meus dispositivos" eyebrow="GERENCIAMENTO" onMenu={() => {}}/>
    <main className="page-content">
      <section className="welcome-row"><p>Gerencie e acompanhe todos os seus dispositivos conectados.</p><Button onClick={() => navigate("add")}><Icon name="plus" size={18}/>Adicionar dispositivo</Button></section>
      {error ? <StateNotice text={error}/> : !devices ? <StateNotice text="Carregando dispositivos..."/> : <>
        <div className="summary-strip"><span><b>{devices.length}</b> dispositivos</span><span><i className="online-dot"/><b>{counts.online}</b> online</span><span><i className="alert-dot"/><b>{counts.alerta}</b> com alerta</span><span><i className="offline-dot"/><b>{counts.offline}</b> offline</span></div>
        <div className="toolbar"><label className="search-field"><Icon name="search" size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome ou localização..."/></label>
          <div className="filter-tabs">{(["todos", "online", "alerta", "offline"] as const).map(f => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f === "todos" ? "Todos" : f === "alerta" ? "Com alerta" : f[0].toUpperCase()+f.slice(1)}</button>)}</div>
        </div>
        <div className="devices-list-grid">{filtered.map(d => <DeviceCard key={d.id} device={d} onClick={() => openDevice(d.id)}/>)}
          <button className="add-device-card" onClick={() => navigate("add")}><span><Icon name="plus" size={24}/></span><b>Adicionar novo dispositivo</b><p>Conecte um Arduino à sua plataforma</p></button>
        </div>
      </>}
    </main>
  </div>;
}

const PERIOD_DAYS = { "24 horas": 1, "7 dias": 7, "30 dias": 30 } as const;
type Period = keyof typeof PERIOD_DAYS;

const CHART_METRICS = {
  moisture: { label: "Umidade", unit: "%", min: 0, max: 100, color: "#079975", fillId: "chartFillMoisture" },
  ph: { label: "pH", unit: "", min: 0, max: 14, color: "#7c5cd6", fillId: "chartFillPh" },
  temperature: { label: "Temperatura", unit: "°C", min: 0, max: 45, color: "#d68b3d", fillId: "chartFillTemp" },
} as const;
type ChartMetric = keyof typeof CHART_METRICS;

type EditDeviceForm = {
  name: string; type: string; location: string; crop: string; connectivity: string;
  minMoisture: string; defaultDurationMin: string; minPh: string; maxPh: string; defaultRegime: RegimeKey;
  autoIrrigation: boolean; disconnectAlerts: boolean;
};

function DeviceDetail({ deviceId, navigate }: { deviceId: string | null; navigate: (p: Page) => void }) {
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("24 horas");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("moisture");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedRegime, setSelectedRegime] = useState<RegimeKey>("moderada");
  const [durationUnit, setDurationUnit] = useState<"sec" | "min">("sec");
  const [durationInput, setDurationInput] = useState("30");
  const [savedDurationSec, setSavedDurationSec] = useState<number>(30);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [modeSavedMsg, setModeSavedMsg] = useState<string | null>(null);
  const regimes = useRegimes();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditDeviceForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [modeSaving, setModeSaving] = useState(false);
  const [customMinMoisture, setCustomMinMoisture] = useState<string>("40");
  const [activeArduinoId, setActiveArduinoId] = useState<string>("ARD-IRR-0421");
  const [bindingBusy, setBindingBusy] = useState(false);

  const computeTotalSeconds = (valStr = durationInput, unit = durationUnit): number => {
    const num = Number(String(valStr).replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return 30;
    const rawSec = unit === "sec" ? Math.round(num) : Math.round(num * 60);
    return Math.max(30, Math.min(14400, rawSec));
  };

  const load = () => {
    if (!deviceId) return;
    api.device(deviceId, PERIOD_DAYS[period]).then(setDetail).catch((e) => setError(e instanceof ApiError ? e.message : "Não foi possível carregar o dispositivo."));
  };

  useEffect(() => {
    if (!deviceId) return;
    let alive = true;
    setDetail(null);
    const fetchDetail = () => {
      api.device(deviceId, PERIOD_DAYS[period]).then((d) => {
        if (!alive) return;
        setDetail(d);
        setError(null);
      }).catch((e) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Não foi possível carregar o dispositivo.");
      });
    };
    fetchDetail();
    const timer = window.setInterval(fetchDetail, 4000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [deviceId, period]);

  useEffect(() => {
    if (detail) {
      setSelectedRegime(detail.defaultRegime);
      const sec = detail.defaultDurationSec ?? getDeviceDurationSeconds(detail.id, 1);
      setSavedDurationSec(sec);
      if (sec < 60 || sec % 60 !== 0) {
        setDurationUnit("sec");
        setDurationInput(String(sec));
      } else {
        setDurationUnit("min");
        setDurationInput(String(Math.round(sec / 60)));
      }
      setCustomMinMoisture(String(detail.minMoisture));
    }
    api.getActiveArduinoDevice().then((r) => r?.deviceId && setActiveArduinoId(r.deviceId)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  // Cronômetro em tempo real (1s) APENAS para o Modo Manual!
  // No Modo Automático, a rega para exclusivamente quando a umidade atingir >= minMoisture.
  useEffect(() => {
    if (!detail?.irrigating || detail.autoIrrigation || !detail.irrigatingUntil) {
      setRemainingSec(null);
      return;
    }
    let stopping = false;
    const tick = () => {
      const diff = Math.ceil((new Date(detail.irrigatingUntil!).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSec(0);
        if (!stopping) {
          stopping = true;
          api.stopIrrigation(detail.id).then(setDetail).catch(() => {});
        }
      } else {
        setRemainingSec(diff);
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [detail?.id, detail?.irrigating, detail?.autoIrrigation, detail?.irrigatingUntil]);

  if (!deviceId) return <div><Header title="Dispositivo" onMenu={() => {}}/><main className="page-content"><StateNotice text="Selecione um dispositivo na lista para ver os detalhes."/><Button variant="secondary" className="mt-3" onClick={() => navigate("devices")}>Ver meus dispositivos</Button></main></div>;
  if (error) return <div><Header title="Dispositivo" onMenu={() => {}}/><main className="page-content"><StateNotice text={error}/></main></div>;
  if (!detail) return <div><Header title="Dispositivo" onMenu={() => {}}/><main className="page-content"><StateNotice text="Carregando dispositivo..."/></main></div>;

  const selectPresetDuration = (sec: number) => {
    const valid = setDeviceDurationSeconds(detail.id, Math.max(30, sec));
    setSavedDurationSec(valid);
    setActionError(null);
    if (valid < 60 || valid % 60 !== 0) {
      setDurationUnit("sec");
      setDurationInput(String(valid));
    } else {
      setDurationUnit("min");
      setDurationInput(String(Math.round(valid / 60)));
    }
  };

  const handleManualDurationChange = (valStr: string, unit = durationUnit) => {
    setDurationInput(valStr);
    const num = Number(String(valStr).replace(",", "."));
    if (Number.isFinite(num) && num > 0) {
      const rawSec = unit === "sec" ? Math.round(num) : Math.round(num * 60);
      if (rawSec >= 30) {
        const valid = setDeviceDurationSeconds(detail.id, rawSec);
        setSavedDurationSec(valid);
        setActionError(null);
      }
    }
  };

  const startWithRegime = async () => {
    const rawNum = Number(String(durationInput).replace(",", "."));
    const requestedSec = durationUnit === "sec" ? Math.round(rawNum) : Math.round(rawNum * 60);
    if (!Number.isFinite(requestedSec) || requestedSec < 30) {
      setActionError("No modo manual, o tempo mínimo aceitável é de 30 segundos.");
      setDurationUnit("sec");
      setDurationInput("30");
      setSavedDurationSec(setDeviceDurationSeconds(detail.id, 30));
      return;
    }
    const validSec = setDeviceDurationSeconds(detail.id, requestedSec);
    setSavedDurationSec(validSec);
    setBusy(true); setActionError(null);
    try {
      setDetail(await api.startIrrigation(detail.id, Math.max(1, Math.ceil(validSec / 60)), selectedRegime, validSec));
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Não foi possível iniciar a irrigação.");
    } finally {
      setBusy(false);
    }
  };

  const toggleIrrigation = async () => {
    if (detail.irrigating) {
      setBusy(true); setActionError(null);
      try { setDetail(await api.stopIrrigation(detail.id)); }
      catch (e) { setActionError(e instanceof ApiError ? e.message : "Não foi possível interromper a irrigação."); }
      finally { setBusy(false); }
    } else {
      await startWithRegime();
    }
  };

  const setOperationMode = async (autoMode: boolean, overrideMinMoisture?: number) => {
    setModeSaving(true); setActionError(null);
    const minM = overrideMinMoisture !== undefined ? overrideMinMoisture : (Number(customMinMoisture) || detail.minMoisture);
    const clampedMinM = Math.max(5, Math.min(95, minM));
    setCustomMinMoisture(String(clampedMinM));

    try {
      let updated = await api.updateDeviceSettings(detail.id, {
        minMoisture: clampedMinM,
        defaultDurationMin: Math.max(1, Math.ceil(savedDurationSec / 60)),
        defaultDurationSec: savedDurationSec,
        autoIrrigation: autoMode,
        disconnectAlerts: detail.disconnectAlerts,
        minPh: detail.minPh,
        maxPh: detail.maxPh,
        defaultRegime: detail.defaultRegime,
      });
      if (!autoMode && updated.irrigating && updated.irrigationMode !== "manual") {
        // Saiu do modo automático: para a rega automática imediatamente
        updated = await api.stopIrrigation(detail.id);
      } else if (autoMode) {
        // No modo automático: aciona se umidade < limite e para se umidade >= limite (sem tempo fixo!)
        if (updated.moisture !== null && updated.moisture < clampedMinM && !updated.irrigating) {
          updated = await api.startIrrigation(detail.id, 240, detail.defaultRegime, 14400);
        } else if (updated.moisture !== null && updated.moisture >= clampedMinM && updated.irrigating) {
          updated = await api.stopIrrigation(detail.id);
        }
      }
      setDetail(updated);
      setModeSavedMsg(autoMode ? `Automático ativo (liga < ${clampedMinM}% e para ≥ ${clampedMinM}%)` : "Modo Manual ativado");
      setTimeout(() => setModeSavedMsg(null), 3000);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Não foi possível alterar o modo de operação.");
    } finally {
      setModeSaving(false);
    }
  };

  const bindArduinoHere = async () => {
    setBindingBusy(true);
    try {
      const res = await api.setActiveArduinoDevice(detail.id);
      setActiveArduinoId(res.deviceId);
    } finally {
      setBindingBusy(false);
    }
  };

  const triggerTestReading = async (moistureVal: number) => {
    setBusy(true); setActionError(null);
    try {
      await api.simulateSensorReading(detail.id, {
        moisture: moistureVal,
        temperature: detail.temperature ?? 25.4,
        water: detail.water ?? 80.0,
        ph: detail.ph ?? 6.5,
      });
      const refreshed = await api.device(detail.id, PERIOD_DAYS[period]);
      if (refreshed.autoIrrigation) {
        if (moistureVal < refreshed.minMoisture && !refreshed.irrigating) {
          const started = await api.startIrrigation(detail.id, 240, refreshed.defaultRegime, 14400);
          setDetail(started);
          return;
        } else if (moistureVal >= refreshed.minMoisture && refreshed.irrigating) {
          const stopped = await api.stopIrrigation(detail.id);
          setDetail(stopped);
          return;
        }
      }
      setDetail(refreshed);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Falha ao enviar leitura de teste.");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      name: detail.name, type: detail.type, location: detail.location, crop: detail.crop, connectivity: detail.connectivity,
      minMoisture: String(detail.minMoisture), defaultDurationMin: String(Math.max(1, Math.round(savedDurationSec / 60))),
      minPh: String(detail.minPh), maxPh: String(detail.maxPh), defaultRegime: detail.defaultRegime,
      autoIrrigation: detail.autoIrrigation, disconnectAlerts: detail.disconnectAlerts,
    });
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    if (!editForm.name.trim()) { setEditError("Informe um nome para o dispositivo."); return; }
    if (!editForm.location.trim()) { setEditError("Informe a localização do dispositivo."); return; }
    const minPh = Number(editForm.minPh.replace(",", "."));
    const maxPh = Number(editForm.maxPh.replace(",", "."));
    if (Number.isNaN(minPh) || Number.isNaN(maxPh) || minPh < 0 || maxPh > 14 || minPh >= maxPh) { setEditError("Faixa de pH inválida: o mínimo deve ser menor que o máximo (entre 0 e 14)."); return; }
    const minMoisture = Number(editForm.minMoisture);
    if (Number.isNaN(minMoisture) || minMoisture < 0 || minMoisture > 100) { setEditError("O limite mínimo de umidade deve ser um valor entre 0 e 100."); return; }
    const defaultDurationMin = Number(editForm.defaultDurationMin);
    if (!Number.isFinite(defaultDurationMin) || defaultDurationMin < 1 || defaultDurationMin > 240) { setEditError("A duração padrão deve ser entre 1 e 240 minutos."); return; }
    setEditSaving(true); setEditError(null);
    try {
      const sec = defaultDurationMin * 60;
      setSavedDurationSec(setDeviceDurationSeconds(detail.id, sec));
      setDurationUnit("min");
      setDurationInput(String(defaultDurationMin));
      await api.updateDeviceProfile(detail.id, { name: editForm.name.trim(), type: editForm.type, location: editForm.location.trim(), crop: editForm.crop.trim(), connectivity: editForm.connectivity.trim() });
      await api.updateDeviceSettings(detail.id, { minMoisture, defaultDurationMin, defaultDurationSec: sec, autoIrrigation: editForm.autoIrrigation, disconnectAlerts: editForm.disconnectAlerts, minPh, maxPh, defaultRegime: editForm.defaultRegime });
      setEditing(false);
      load();
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : "Não foi possível salvar as alterações.");
    } finally {
      setEditSaving(false);
    }
  };

  const removeDevice = async () => {
    if (!window.confirm(`Excluir "${detail.name}"?\n\nEssa ação é permanente e remove o histórico de leituras, programações e alertas deste dispositivo.`)) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      await api.deleteDevice(detail.id);
      navigate("devices");
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Não foi possível excluir o dispositivo.");
      setDeleteBusy(false);
    }
  };

  const tempPct = detail.temperature == null ? 0 : Math.max(0, Math.min(100, (detail.temperature / 45) * 100));
  const selectedRegimeObj = regimes.find(r => r.key === selectedRegime);
  const currentSecPreview = computeTotalSeconds();
  const estimatedMm = selectedRegimeObj ? Math.round(selectedRegimeObj.mmPerHour * (currentSecPreview / 3600) * 100) / 100 : null;

  const cfg = CHART_METRICS[chartMetric];
  const currentValue = chartMetric === "moisture" ? detail.moisture : chartMetric === "ph" ? detail.ph : detail.temperature;
  const chartPoints = seriesToPointsGeneric(detail.series.map(p => p[chartMetric]), 700, 200, currentValue ?? (cfg.min + cfg.max) / 2, cfg.min, cfg.max);
  const band: [number, number] | null = chartMetric === "moisture" ? [detail.minMoisture, Math.min(95, detail.minMoisture + 30)] : chartMetric === "ph" ? [detail.minPh, detail.maxPh] : null;
  const bandTop = band ? 100 - ((band[1] - cfg.min) / (cfg.max - cfg.min)) * 100 : 0;
  const bandHeight = band ? ((band[1] - band[0]) / (cfg.max - cfg.min)) * 100 : 0;

  const fmtCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s} segundos`;
  };

  return <div><Header title={detail.name} eyebrow="DETALHES DO DISPOSITIVO" onMenu={() => {}}/>
    <main className="page-content">
      <button className="back-link" onClick={() => navigate("devices")}><span>‹</span> Voltar aos dispositivos</button>
      <section className="device-hero card">
        <div className="hero-device-icon"><Icon name="cpu" size={30}/><i/></div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2>{detail.name}</h2>
            <Status status={detail.status}/>
            <span className="irrigating-chip" style={{ background: detail.autoIrrigation ? "#e6f5ef" : "#eaf1fb", color: detail.autoIrrigation ? "#08795c" : "#1d5fa7" }}>
              <Icon name={detail.autoIrrigation ? "activity" : "zap"} size={11}/>
              {detail.autoIrrigation ? `Modo Automático (Sensor < ${detail.minMoisture}%)` : "Modo Manual"}
            </span>
          </div>
          <p>{detail.id} <span>•</span> {detail.type} <span>•</span> {detail.location}{detail.crop && <><span>•</span> {detail.crop}</>}</p>
          <small><Icon name="clock" size={13}/> Última atualização {relativeTime(detail.lastSeenAt).toLowerCase()}</small>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" onClick={() => editing ? setEditing(false) : openEdit()}><Icon name={editing ? "close" : "edit"} size={16}/>{editing ? "Cancelar edição" : "Editar parâmetros"}</Button>
          <button className="icon-btn danger" title="Excluir dispositivo" aria-label="Excluir dispositivo" onClick={removeDevice} disabled={deleteBusy}><Icon name="trash" size={16}/></button>
        </div>
      </section>

      <section className={`arduino-bind-bar ${activeArduinoId === detail.id ? "active" : ""}`}>
        <div className="arduino-bind-info">
          <span className="arduino-bind-dot" style={{ background: activeArduinoId === detail.id ? "#10a579" : "#94a8a2" }} />
          <div>
            <b>{activeArduinoId === detail.id ? `Arduino Físico vinculado a esta horta (${detail.name})` : `Esta horta está ativa na plataforma (${detail.id})`}</b>
            <small>
              {activeArduinoId === detail.id
                ? "As leituras do sensor via USB/Wi-Fi e o relé da bomba estão controlando esta horta em tempo real."
                : "Clique em 'Vincular Arduino Aqui' se quiser que sua placa física envie dados e receba comandos desta horta."}
            </small>
          </div>
        </div>
        <div className="sim-quick-btns">
          {activeArduinoId !== detail.id && (
            <button type="button" className="sim-btn" disabled={bindingBusy} onClick={bindArduinoHere}>
              🔌 {bindingBusy ? "Vinculando..." : "Vincular Arduino Físico Aqui"}
            </button>
          )}
          <button type="button" className="sim-btn" disabled={busy} onClick={() => triggerTestReading(22.0)} title="Envia uma leitura de 22% (solo seco) para testar o disparo automático">
            Testar Solo Seco (22%)
          </button>
          <button type="button" className="sim-btn" disabled={busy} onClick={() => triggerTestReading(68.0)} title="Envia uma leitura de 68% (solo úmido) para testar a parada automática">
            Testar Solo Úmido (68%)
          </button>
        </div>
      </section>
      {deleteError && <p className="inline-error">{deleteError}</p>}
      {editing && editForm && <section className="card edit-card">
        <div className="card-heading"><div><h2>Editar dispositivo</h2><p>Dados do equipamento e parâmetros de irrigação</p></div><button className="icon-btn" onClick={() => setEditing(false)} aria-label="Fechar"><Icon name="close" size={16}/></button></div>
        <div className="form-grid compact">
          <label><span>Nome do dispositivo</span><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}/></label>
          <label><span>Tipo de dispositivo</span><select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}><option>Irrigador Pro</option><option>Irrigador Mini</option><option>Sensor de reservatório</option></select></label>
          <label><span>Localização</span><input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })}/></label>
          <label><span>Cultura</span><input placeholder="Ex.: Tomate, hortaliças..." value={editForm.crop} onChange={e => setEditForm({ ...editForm, crop: e.target.value })}/></label>
          <label><span>Conectividade</span><input value={editForm.connectivity} onChange={e => setEditForm({ ...editForm, connectivity: e.target.value })}/></label>
          <label><span>Limite mínimo de umidade</span><div className="unit-input"><input type="number" min={0} max={100} value={editForm.minMoisture} onChange={e => setEditForm({ ...editForm, minMoisture: e.target.value })}/><b>%</b></div></label>
          <label><span>Duração padrão</span><div className="unit-input"><input type="number" min={1} max={240} value={editForm.defaultDurationMin} onChange={e => setEditForm({ ...editForm, defaultDurationMin: e.target.value })}/><b>min</b></div></label>
          <label><span>pH mínimo ideal</span><div className="unit-input"><input type="number" step="0.1" min={0} max={14} value={editForm.minPh} onChange={e => setEditForm({ ...editForm, minPh: e.target.value })}/><b>pH</b></div></label>
          <label><span>pH máximo ideal</span><div className="unit-input"><input type="number" step="0.1" min={0} max={14} value={editForm.maxPh} onChange={e => setEditForm({ ...editForm, maxPh: e.target.value })}/><b>pH</b></div></label>
          <label className="full"><span>Regime de chuva padrão</span><div className="regime-chip-row">{regimes.map(r => <button type="button" key={r.key} className={`regime-chip ${REGIME_TONE[r.key]} ${editForm.defaultRegime === r.key ? "active" : ""}`} onClick={() => setEditForm({ ...editForm, defaultRegime: r.key })}><Icon name="cloudrain" size={13}/>{r.label}</button>)}</div></label>
          <label className="full toggle-option"><div><span>Irrigação automática</span><small>Ativar quando a umidade estiver abaixo do limite.</small></div><input type="checkbox" checked={editForm.autoIrrigation} onChange={e => setEditForm({ ...editForm, autoIrrigation: e.target.checked })}/></label>
          <label className="full toggle-option"><div><span>Alertas de desconexão</span><small>Notificar quando o dispositivo ficar offline.</small></div><input type="checkbox" checked={editForm.disconnectAlerts} onChange={e => setEditForm({ ...editForm, disconnectAlerts: e.target.checked })}/></label>
        </div>
        {editError && <p className="inline-error" style={{ margin: "0 0 12px 25px" }}>{editError}</p>}
        <div className="form-footer compact"><Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button><Button disabled={editSaving} onClick={saveEdit}>{editSaving ? "Salvando..." : "Salvar alterações"}</Button></div>
      </section>}
      <section className="detail-metrics">
        <DetailMetric icon="droplet" tone="cyan" label="Umidade do solo" value={detail.moisture == null ? "—" : `${detail.moisture.toFixed(0)}%`} state={detail.moisture != null && detail.moisture < detail.minMoisture ? `Abaixo do limite (${detail.minMoisture}%)` : `Ideal (≥ ${detail.minMoisture}%)`} progress={detail.moisture ?? 0}/>
        <DetailMetric icon="thermometer" tone="amber" label="Temperatura" value={detail.temperature == null ? "—" : `${detail.temperature.toFixed(1)}°C`} state="Normal" progress={tempPct}/>
        <DetailMetric icon="waves" tone="blue" label="Nível de água" value={detail.water == null ? "—" : `${detail.water.toFixed(0)}%`} state={detail.water != null && detail.water < 40 ? "Baixo" : "Bom"} progress={detail.water ?? 0}/>
        <DetailMetric icon="flask" tone="violet" label="pH do solo" value={fmtPh(detail.ph)} state={detail.ph != null && (detail.ph < detail.minPh || detail.ph > detail.maxPh) ? "Fora da faixa ideal" : "Dentro da faixa"} progress={detail.ph == null ? 0 : (detail.ph / 14) * 100}/>
        <DetailMetric icon="activity" tone="green" label="Irrigação" value={detail.irrigating ? "Ativa" : "Desligada"} state={detail.irrigating ? (detail.autoIrrigation ? `Automática (até atingir ${detail.minMoisture}%)` : (remainingSec !== null ? `Restam ${fmtCountdown(remainingSec)}` : "Manual")) : (detail.autoIrrigation ? `Auto (< ${detail.minMoisture}%)` : "Modo Manual")} progress={detail.irrigating ? 100 : 0}/>
      </section>
      <section className="detail-layout">
        <div className="card history-card">
          <div className="card-heading">
            <div><h2>{cfg.label === "Umidade" ? "Umidade do solo" : cfg.label} ao longo do tempo</h2><p>Leituras do sensor no período selecionado</p></div>
            <button className="select-btn" onClick={() => setPeriod(period === "24 horas" ? "7 dias" : period === "7 dias" ? "30 dias" : "24 horas")}><Icon name="calendar" size={15}/>{period}<Icon name="chevron" size={13} className="rotate-90"/></button>
          </div>
          <div className="chart-tabs">
            <button className={chartMetric === "moisture" ? "active" : ""} onClick={() => setChartMetric("moisture")}><Icon name="droplet" size={13}/>Umidade</button>
            <button className={chartMetric === "ph" ? "active" : ""} onClick={() => setChartMetric("ph")}><Icon name="flask" size={13}/>pH</button>
            <button className={chartMetric === "temperature" ? "active" : ""} onClick={() => setChartMetric("temperature")}><Icon name="thermometer" size={13}/>Temperatura</button>
          </div>
          <div className="detail-chart">
            {band && <div className="threshold-label">Limite mín. {band[0]}{cfg.unit}</div>}
            {band && <span className="ideal-band" style={{ top: `${bandTop}%`, height: `${bandHeight}%` }}/>}
            <svg viewBox="0 0 700 200" preserveAspectRatio="none"><defs><linearGradient id={cfg.fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cfg.color} stopOpacity=".23"/><stop offset="1" stopColor={cfg.color} stopOpacity="0"/></linearGradient></defs><polygon points={`${chartPoints} 700,200 0,200`} fill={`url(#${cfg.fillId})`}/><polyline points={chartPoints} fill="none" stroke={cfg.color} strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg>
            <div className="chart-hours"><span>{period === "24 horas" ? "00h" : period}</span><span>{period === "24 horas" ? "08h" : "atrás"}</span><span></span><span>{period === "24 horas" ? "16h" : ""}</span><span></span><span></span><span>Agora</span></div>
          </div>
        </div>
        <div className="card manual-card">
          <div className="mode-selector-box">
            <div className="mode-selector-title">
              <span>Modo de Operação da Rega</span>
              {modeSaving && <small style={{ color: "#098160" }}>Salvando...</small>}
              {!modeSaving && modeSavedMsg && <small style={{ color: "#098160" }}>✓ {modeSavedMsg}</small>}
            </div>
            <div className="mode-tabs">
              <button
                type="button"
                disabled={modeSaving}
                className={`mode-tab ${!detail.autoIrrigation ? "active-manual" : ""}`}
                onClick={() => setOperationMode(false)}
              >
                <Icon name="zap" size={14}/> Rega Manual
              </button>
              <button
                type="button"
                disabled={modeSaving}
                className={`mode-tab ${detail.autoIrrigation ? "active-auto" : ""}`}
                onClick={() => setOperationMode(true)}
              >
                <Icon name="activity" size={14}/> Automática (Sensor)
              </button>
            </div>
            {detail.autoIrrigation ? (
              <>
                <p className="mode-desc">
                  <strong>Automático ativo:</strong> A rega é acionada sozinha assim que o sensor identifica umidade abaixo de <b>{detail.minMoisture}%</b> e <b>para automaticamente</b> quando o solo atinge <b>{detail.minMoisture}% ou mais</b>.
                </p>
                <div className="auto-limit-inline">
                  <span>Umidade mínima:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={5}
                      max={95}
                      value={customMinMoisture}
                      onChange={(e) => setCustomMinMoisture(e.target.value)}
                    />
                    <b>%</b>
                    <button
                      type="button"
                      className="sim-btn"
                      disabled={modeSaving}
                      onClick={() => setOperationMode(true, Number(customMinMoisture) || 40)}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="mode-desc">
                <strong>Manual ativo:</strong> O sensor continua mostrando a umidade na tela, mas a bomba <b>só liga quando você clicar no botão abaixo</b> pelo tempo que você escolher.
              </p>
            )}
          </div>

          <div className={`manual-visual ${detail.irrigating ? "running" : ""}`}><span><Icon name={detail.irrigating ? "droplet" : "zap"} size={28}/></span><i/><i/><i/></div>

          {detail.autoIrrigation ? (
            <>
              <h2>{detail.irrigating ? "Rega Automática em Andamento" : "Monitoramento Automático por Sensor"}</h2>
              <p>
                {detail.irrigating
                  ? `Solo abaixo de ${detail.minMoisture}% (${detail.moisture?.toFixed(0) ?? "—"}%). A bomba desligará sozinha assim que o sensor identificar umidade ≥ ${detail.minMoisture}%.`
                  : `Solo suficientemente úmido (${detail.moisture?.toFixed(0) ?? "—"}% ≥ ${detail.minMoisture}%). A bomba permanece desligada e acionará sozinha se a umidade cair abaixo de ${detail.minMoisture}%.`}
              </p>
              {actionError && <p className="inline-error" style={{ margin: "0 0 10px" }}>{actionError}</p>}
              {detail.irrigating && (
                <Button variant="danger" className="w-full" onClick={toggleIrrigation} disabled={busy}>
                  <Icon name="close" size={17}/>{busy ? "Aguarde..." : "Voltar para Manual e Parar Bomba"}
                </Button>
              )}
            </>
          ) : (
            <>
              <h2>{detail.irrigating ? "Irrigação Manual em Andamento" : "Acionamento Manual da Bomba"}</h2>
              <p>
                {detail.irrigating
                  ? (remainingSec !== null ? `⏱️ Tempo restante: ${fmtCountdown(remainingSec)} (desliga automaticamente ao zerar).` : "A bomba está ligada agora. Você pode interromper a qualquer momento.")
                  : "Escolha a intensidade e por quantos segundos (mín. 30s) ou minutos deseja regar:"}
              </p>
              {!detail.irrigating && regimes.length > 0 && <div className="regime-chip-row">{regimes.map(r => <button type="button" key={r.key} className={`regime-chip ${REGIME_TONE[r.key]} ${selectedRegime === r.key ? "active" : ""}`} onClick={() => setSelectedRegime(r.key)}><Icon name="cloudrain" size={13}/>{r.label}</button>)}</div>}
              {!detail.irrigating && selectedRegimeObj && <p className="regime-hint">{selectedRegimeObj.description}</p>}

              <div className="manual-duration-box">
                <div className="manual-duration-header">
                  <span>Duração (mín. 30s):</span>
                  {detail.irrigating ? (
                    <b style={{ fontSize: "9px", color: "#098160" }}>{remainingSec !== null ? `Restam ${fmtCountdown(remainingSec)}` : formatDurationLabel(savedDurationSec)}</b>
                  ) : (
                    <div className="manual-duration-inputs">
                      <input
                        type="number"
                        min={durationUnit === "sec" ? 30 : 1}
                        max={durationUnit === "sec" ? 14400 : 240}
                        value={durationInput}
                        onChange={(e) => handleManualDurationChange(e.target.value, durationUnit)}
                      />
                      <select
                        value={durationUnit}
                        onChange={(e) => {
                          const nextUnit = e.target.value as "sec" | "min";
                          const curSec = computeTotalSeconds(durationInput, durationUnit);
                          setDurationUnit(nextUnit);
                          const nextVal = nextUnit === "sec" ? String(curSec) : String(Math.max(1, Math.round(curSec / 60)));
                          handleManualDurationChange(nextVal, nextUnit);
                        }}
                      >
                        <option value="sec">segundos</option>
                        <option value="min">minutos</option>
                      </select>
                    </div>
                  )}
                </div>
                {!detail.irrigating && (
                  <div className="manual-duration-presets">
                    {[
                      { label: "30s", sec: 30 },
                      { label: "45s", sec: 45 },
                      { label: "1 min", sec: 60 },
                      { label: "2 min", sec: 120 },
                      { label: "5 min", sec: 300 },
                      { label: "15 min", sec: 900 },
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.sec}
                        className={`manual-preset-btn ${savedDurationSec === preset.sec ? "active" : ""}`}
                        onClick={() => selectPresetDuration(preset.sec)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!detail.irrigating && estimatedMm != null && <p className="regime-hint" style={{ marginBottom: "10px" }}>Selecionado: <b>{formatDurationLabel(computeTotalSeconds())}</b> • ≈ {estimatedMm} mm de água</p>}
              {actionError && <p className="inline-error" style={{ margin: "0 0 10px" }}>{actionError}</p>}
              <Button variant={detail.irrigating ? "danger" : "primary"} className="w-full" onClick={toggleIrrigation} disabled={busy}><Icon name={detail.irrigating ? "close" : "droplet"} size={17}/>{busy ? "Aguarde..." : detail.irrigating ? "Interromper irrigação agora" : `Iniciar irrigação (${formatDurationLabel(computeTotalSeconds())})`}</Button>
            </>
          )}
          <small><Icon name="shield" size={13}/> Sincronizado em tempo real com o Arduino e celular</small>
        </div>
      </section>
      <section className="detail-layout">
        <ScheduleManager deviceId={detail.id} schedules={detail.schedules} regimes={regimes} onChanged={load}/>
        <IrrigationHistoryCard history={detail.history}/>
      </section>
      <section className="card info-table"><div className="card-heading"><div><h2>Informações do dispositivo</h2><p>Dados técnicos e conectividade</p></div></div><div className="info-grid"><Info label="Identificação" value={detail.id}/><Info label="Modelo" value={`Verda ${detail.type}`}/><Info label="Cultura" value={detail.crop || "Não informada"}/><Info label="Firmware" value={detail.firmware}/><Info label="Conectividade" value={detail.connectivity}/><Info label="Instalado em" value={formatDatePt(detail.installedAt)}/></div></section>
    </main>
  </div>;
}

function ScheduleManager({ deviceId, schedules, regimes, onChanged }: { deviceId: string; schedules: Schedule[]; regimes: Regime[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", days: [1, 2, 3, 4, 5, 6, 7] as number[], startTime: "06:30", durationMin: "15", regime: "moderada" as RegimeKey });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.name.trim() || form.days.length === 0) { setError("Dê um nome à programação e escolha ao menos um dia."); return; }
    setSaving(true); setError(null);
    try {
      await api.createSchedule(deviceId, { name: form.name.trim(), days: form.days, startTime: form.startTime, durationMin: Number(form.durationMin) || 15, regime: form.regime });
      setForm({ name: "", days: [1, 2, 3, 4, 5, 6, 7], startTime: "06:30", durationMin: "15", regime: "moderada" });
      setAdding(false);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível criar a programação.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s: Schedule) => { try { await api.toggleSchedule(deviceId, s.id, !s.enabled); onChanged(); } catch { /* ignora falha pontual */ } };
  const remove = async (s: Schedule) => { try { await api.deleteSchedule(deviceId, s.id); onChanged(); } catch { /* ignora falha pontual */ } };

  return <div className="card schedule-card">
    <div className="card-heading">
      <div><h2>Programações de rega</h2><p>Regas automáticas por dia da semana</p></div>
      <button className="select-btn" onClick={() => setAdding(a => !a)}><Icon name={adding ? "close" : "plus"} size={14}/>{adding ? "Cancelar" : "Nova"}</button>
    </div>
    {adding && <div className="schedule-form">
      <div className="form-grid compact">
        <label><span>Nome</span><input placeholder="Ex.: Rega da manhã" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
        <label><span>Horário</span><input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}/></label>
        <label><span>Duração</span><div className="unit-input"><input type="number" min={1} max={240} value={form.durationMin} onChange={e => setForm({ ...form, durationMin: e.target.value })}/><b>min</b></div></label>
        <label><span>Regime de chuva</span><select value={form.regime} onChange={e => setForm({ ...form, regime: e.target.value as RegimeKey })}>{regimes.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
        <label className="full"><span>Dias da semana</span><DayPicker days={form.days} onChange={d => setForm({ ...form, days: d })}/></label>
      </div>
      {error && <p className="inline-error" style={{ margin: "0 0 12px 25px" }}>{error}</p>}
      <div className="form-footer compact"><Button disabled={saving} onClick={submit}>{saving ? "Salvando..." : "Salvar programação"}</Button></div>
    </div>}
    <div className="schedule-list">
      {schedules.length ? schedules.map(s => <div key={s.id} className={`schedule-row ${!s.enabled ? "disabled" : ""}`}>
        <span className={`regime-dot ${REGIME_TONE[s.regime]}`}/>
        <div><b>{s.name}</b><small>{daysLabel(s.days)} • {s.startTime} • {s.durationMin} min • ≈{s.estimatedMm} mm</small></div>
        <span className="schedule-next">{s.enabled ? formatRunAt(s.nextRunAt) : "Pausada"}</span>
        <button className={`switch small ${s.enabled ? "on" : ""}`} onClick={() => toggle(s)}><i/></button>
        <button className="icon-btn" onClick={() => remove(s)}><Icon name="trash" size={14}/></button>
      </div>) : <p className="schedule-empty">Nenhuma programação cadastrada. Crie uma para regar este dispositivo automaticamente.</p>}
    </div>
  </div>;
}

function IrrigationHistoryCard({ history }: { history: IrrigationLogItem[] }) {
  return <div className="card history-list-card">
    <div className="card-heading"><div><h2>Histórico de irrigações</h2><p>Últimos ciclos deste dispositivo</p></div></div>
    <div className="history-log">
      {history.length ? history.map(h => <div key={h.id} className="history-row">
        <span className={`regime-dot ${REGIME_TONE[h.regime]}`}/>
        <div><b>{h.running ? "Em andamento" : "Concluída"}</b><small>{new Date(h.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} • {h.mode === "manual" ? "Manual" : h.scheduleName ?? "Agendada"}</small></div>
        <em>{h.actualMinutes} min<span>≈{h.estimatedMm} mm</span></em>
      </div>) : <p className="schedule-empty">Nenhuma irrigação registrada ainda.</p>}
    </div>
  </div>;
}

function DetailMetric({ icon, tone, label, value, state, progress }: { icon: IconName; tone: string; label: string; value: string; state: string; progress: number }) {
  return <div className="card detail-metric"><div className={`metric-icon ${tone}`}><Icon name={icon}/></div><span>{label}</span><strong>{value}</strong><div className="metric-progress"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></div><small>{state}</small></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }

type AddForm = { name: string; type: string; id: string; location: string; crop: string; minMoisture: string; defaultDurationMin: string; minPh: string; maxPh: string; defaultRegime: RegimeKey; autoIrrigation: boolean; disconnectAlerts: boolean };

const DEVICE_ID_PATTERN = /^[A-Z0-9-]{4,40}$/;

function AddDevice({ navigate }: { navigate: (p: Page) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AddForm>({ name: "", type: "Irrigador Pro", id: "", location: "", crop: "", minMoisture: "40", defaultDurationMin: "15", minPh: "5.5", maxPh: "7.0", defaultRegime: "moderada", autoIrrigation: false, disconnectAlerts: true });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const regimes = useRegimes();

  const goToStep2 = () => {
    if (!form.name.trim()) { setFormError("Informe o nome do dispositivo."); return; }
    if (!form.location.trim()) { setFormError("Informe a localização do dispositivo."); return; }
    if (!DEVICE_ID_PATTERN.test(form.id)) { setFormError("Código de identificação inválido. Use de 4 a 40 caracteres: letras maiúsculas, números e hífen (ex.: ARD-IRR-0421)."); return; }
    setFormError(null);
    setStep(2);
  };

  const submit = async () => {
    const minMoisture = Number(form.minMoisture);
    const defaultDurationMin = Number(form.defaultDurationMin);
    const minPh = Number(form.minPh.replace(",", "."));
    const maxPh = Number(form.maxPh.replace(",", "."));
    if (Number.isNaN(minMoisture) || minMoisture < 0 || minMoisture > 100) { setFormError("O limite mínimo de umidade deve ser um valor entre 0 e 100."); return; }
    if (!Number.isFinite(defaultDurationMin) || defaultDurationMin < 1 || defaultDurationMin > 240) { setFormError("A duração padrão deve ser entre 1 e 240 minutos."); return; }
    if (Number.isNaN(minPh) || Number.isNaN(maxPh) || minPh < 0 || maxPh > 14 || minPh >= maxPh) { setFormError("Faixa de pH inválida: o mínimo deve ser menor que o máximo (entre 0 e 14)."); return; }
    setSubmitting(true); setFormError(null);
    try {
      await api.createDevice({
        name: form.name.trim(), type: form.type, id: form.id, location: form.location.trim(), crop: form.crop.trim(),
        minMoisture, defaultDurationMin, autoIrrigation: form.autoIrrigation, disconnectAlerts: form.disconnectAlerts,
        minPh, maxPh, defaultRegime: form.defaultRegime,
      });
      setStep(3);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Não foi possível cadastrar o dispositivo.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div><Header title="Adicionar dispositivo" eyebrow="CONFIGURAÇÃO" onMenu={() => {}}/>
    <main className="page-content narrow-page">
      <button className="back-link" onClick={() => navigate("devices")}><span>‹</span> Cancelar e voltar</button>
      <div className="stepper"><Step n={1} label="Identificação" active={step >= 1}/><i className={step >= 2 ? "done" : ""}/><Step n={2} label="Irrigação e solo" active={step >= 2}/><i className={step >= 3 ? "done" : ""}/><Step n={3} label="Concluir" active={step >= 3}/></div>
      {step < 3 ? <section className="card form-card">
        <div className="form-heading"><div className="form-icon"><Icon name={step === 1 ? "cpu" : "settings"} size={25}/></div><div><h2>{step === 1 ? "Identifique seu dispositivo" : "Preferências de irrigação e solo"}</h2><p>{step === 1 ? "Insira os dados encontrados na etiqueta do seu Arduino." : "Defina os parâmetros iniciais. Você poderá alterá-los depois."}</p></div></div>
        {step === 1 ? <div className="form-grid">
          <label><span>Nome do dispositivo</span><input placeholder="Ex.: Horta principal" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/><small>Use um nome fácil de reconhecer.</small></label>
          <label><span>Tipo de dispositivo</span><select value={form.type} onChange={e => setForm({...form, type:e.target.value})}><option>Irrigador Pro</option><option>Irrigador Mini</option><option>Sensor de reservatório</option></select></label>
          <label className="full"><span>Código de identificação</span><div className="input-prefix"><Icon name="cpu" size={17}/><input placeholder="ARD-IRR-0000" maxLength={40} value={form.id} onChange={e => setForm({...form, id: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")})}/></div><small>4 a 40 caracteres: letras, números e hífen — está impresso na parte inferior do dispositivo.</small></label>
          <label className="full"><span>Localização</span><div className="input-prefix"><Icon name="map" size={17}/><input placeholder="Ex.: Estufa 01, Setor B" value={form.location} onChange={e => setForm({...form, location:e.target.value})}/></div></label>
          <label className="full"><span>Cultura</span><div className="input-prefix"><Icon name="sprout" size={17}/><input placeholder="Ex.: Tomate, hortaliças, citros..." value={form.crop} onChange={e => setForm({...form, crop:e.target.value})}/></div><small>Ajuda a definir a faixa ideal de pH e a leitura do painel.</small></label>
        </div> : <div className="form-grid">
          <label><span>Limite mínimo de umidade</span><div className="unit-input"><input type="number" value={form.minMoisture} onChange={e => setForm({...form, minMoisture: e.target.value})}/><b>%</b></div><small>Um alerta será enviado abaixo deste valor.</small></label>
          <label><span>Duração padrão</span><div className="unit-input"><input type="number" value={form.defaultDurationMin} onChange={e => setForm({...form, defaultDurationMin: e.target.value})}/><b>min</b></div></label>
          <label><span>pH mínimo ideal</span><div className="unit-input"><input type="number" step="0.1" min={0} max={14} value={form.minPh} onChange={e => setForm({...form, minPh: e.target.value})}/><b>pH</b></div></label>
          <label><span>pH máximo ideal</span><div className="unit-input"><input type="number" step="0.1" min={0} max={14} value={form.maxPh} onChange={e => setForm({...form, maxPh: e.target.value})}/><b>pH</b></div></label>
          <label className="full"><span>Regime de chuva padrão</span><div className="regime-chip-row">{(regimes.length ? regimes : []).map(r => <button type="button" key={r.key} className={`regime-chip ${REGIME_TONE[r.key]} ${form.defaultRegime === r.key ? "active" : ""}`} onClick={() => setForm({...form, defaultRegime: r.key})}><Icon name="cloudrain" size={13}/>{r.label}</button>)}</div><small>Usado nas irrigações manuais e programações criadas para este dispositivo.</small></label>
          <label className="full toggle-option"><div><span>Irrigação automática</span><small>Ativar quando a umidade estiver abaixo do limite.</small></div><input type="checkbox" checked={form.autoIrrigation} onChange={e => setForm({...form, autoIrrigation: e.target.checked})}/></label>
          <label className="full toggle-option"><div><span>Alertas de desconexão</span><small>Notificar quando o dispositivo ficar offline.</small></div><input type="checkbox" checked={form.disconnectAlerts} onChange={e => setForm({...form, disconnectAlerts: e.target.checked})}/></label>
        </div>}
        {formError && <p className="inline-error" style={{ margin: "0 25px" }}>{formError}</p>}
        <div className="form-footer"><Button variant="secondary" onClick={() => step === 1 ? navigate("devices") : setStep(1)}>Voltar</Button><Button disabled={submitting} onClick={() => step === 1 ? goToStep2() : submit()}>{submitting ? "Enviando..." : step === 1 ? "Continuar" : "Cadastrar dispositivo"}<Icon name={step === 1 ? "arrow" : "check"} size={17}/></Button></div>
      </section> : <section className="card success-card"><div><Icon name="check" size={34}/></div><h2>Dispositivo adicionado!</h2><p><b>{form.name}</b> foi conectado à plataforma e já está pronto para transmitir dados.</p><Button onClick={() => navigate("devices")}>Ver meus dispositivos <Icon name="arrow" size={16}/></Button></section>}
      {step < 3 && <div className="help-card"><Icon name="wifi"/><div><b>Não encontrou o código?</b><p>Certifique-se de que seu dispositivo está ligado e conectado à mesma rede Wi-Fi. <a>Consulte o guia de instalação.</a></p></div></div>}
    </main>
  </div>;
}

function Step({ n, label, active }: { n: number; label: string; active: boolean }) { return <div className={active ? "active" : ""}><span>{active ? <Icon name="check" size={14}/> : n}</span><b>{label}</b></div>; }

function Alerts({ onChanged }: { onChanged: () => void }) {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.alerts>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.alerts(onlyUnread).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "Não foi possível carregar os alertas."));
  };

  useEffect(load, [onlyUnread]);

  const markAllRead = async () => {
    setBusy(true);
    try {
      await api.markAllAlertsRead();
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível atualizar os alertas.");
    } finally {
      setBusy(false);
    }
  };

  return <div><Header title="Central de alertas" eyebrow="MONITORAMENTO" onMenu={() => {}}/>
    <main className="page-content">
      <section className="welcome-row"><p>Acompanhe ocorrências e atualizações dos seus dispositivos.</p><Button variant="secondary" disabled={busy} onClick={markAllRead}><Icon name="check" size={17}/>Marcar todos como lidos</Button></section>
      {error ? <StateNotice text={error}/> : !data ? <StateNotice text="Carregando alertas..."/> : <>
        <div className="alert-summary">
          <div className="active"><span className="alert-icon high"><Icon name="bell"/></span><div><strong>{data.summary.unread}</strong><small>Não lidos</small></div></div>
          <div><span className="alert-icon high"><Icon name="droplet"/></span><div><strong>{data.summary.highPriority}</strong><small>Alta prioridade</small></div></div>
          <div><span className="alert-icon medium"><Icon name="activity"/></span><div><strong>{data.summary.attention}</strong><small>Atenção</small></div></div>
          <div><span className="alert-icon low"><Icon name="check"/></span><div><strong>{data.summary.resolvedThisMonth}</strong><small>Resolvidos este mês</small></div></div>
        </div>
        <section className="card alerts-page-card">
          <div className="alerts-toolbar"><div className="filter-tabs"><button className={!onlyUnread ? "active" : ""} onClick={() => setOnlyUnread(false)}>Todos</button><button className={onlyUnread ? "active" : ""} onClick={() => setOnlyUnread(true)}>Não lidos</button></div><button className="select-btn" onClick={() => setOnlyUnread(u => !u)}><Icon name="filter" size={15}/>{onlyUnread ? "Apenas não lidos" : "Todas as prioridades"}</button></div>
          <div className="full-alert-list">{data.items.length ? data.items.map((a) => <div key={a.id} className={`full-alert ${!a.read ? "unread" : ""}`}>
            <span className={`alert-icon ${a.level}`}><Icon name={a.level === "high" ? "droplet" : a.level === "medium" ? "wifi" : "check"} size={19}/></span>
            <div className="full-alert-copy"><div><strong>{a.title}</strong>{!a.read && <i>Novo</i>}</div><p>{a.message}</p><small><Icon name="cpu" size={13}/>{a.deviceName ?? "—"}<span>•</span><Icon name="clock" size={13}/>{relativeTime(a.createdAt)}</small></div>
            {!a.read && <button className="icon-btn" title="Marcar este alerta como lido" onClick={() => api.markAlertRead(a.id).then(() => { load(); onChanged(); })}><Icon name="check" size={16}/></button>}
          </div>) : <div className="empty-state"><Icon name="check" size={30}/><b>Tudo em dia</b><p>Você não tem alertas não lidos.</p></div>}</div>
        </section>
      </>}
    </main>
  </div>;
}


type GalleryPhoto = { src: string; tag: string; title: string; description: string };

const PROJECT_PHOTOS: GalleryPhoto[] = [
  {
    src: FOTO_1_DATA,
    tag: "Figura 1 • Protótipo em Bancada",
    title: "Arduino em funcionamento",
    description: "Circuito montado em protoboard com Arduino, módulo display LCD 16x2 exibindo leituras de umidade e sensor inserido no vaso.",
  },
  {
    src: FOTO_2_DATA,
    tag: "Figura 2 • Conectividade IoT",
    title: "Placa Controladora Wi-Fi ESP32",
    description: "Microcontrolador com Wi-Fi integrado utilizado para enviar leituras via HTTP POST à API e receber comandos de acionamento pelo celular.",
  },
  {
    src: FOTO_3_DATA,
    tag: "Figura 3 • Sistema Completo",
    title: "Arduino, sensor e sistema de rega em funcionamento",
    description: "Integração prática entre as plantas monitoradas, sensor de umidade do solo, reservatório de água, display LCD e plataforma web.",
  },
];

const SPECIFIC_OBJECTIVES: string[] = [
  "Permitir o cadastro, visualização e gerenciamento de dispositivos de irrigação.",
  "Disponibilizar informações sobre o estado e o funcionamento dos dispositivos em tempo real.",
  "Permitir iniciar e interromper processos de irrigação por meio da plataforma (computador e celular).",
  "Registrar e apresentar alertas e eventos relacionados aos dispositivos monitorados.",
  "Criar uma estrutura de backend capaz de receber, armazenar e fornecer dados ao frontend.",
  "Estabelecer parceria com uma plataforma de mesma temática para integrar feiras e grupos de agricultura familiar ao sistema.",
  "Oferecer uma interface organizada e responsiva para facilitar a utilização do sistema.",
];

const DEV_PILLARS: { icon: IconName; tone: string; title: string; text: string }[] = [
  {
    icon: "search",
    tone: "cyan",
    title: "1. Pesquisa",
    text: "Estudo dos conceitos de Internet das Coisas (IoT), automação de irrigação, gerenciamento de sensores e desenvolvimento de aplicações web.",
  },
  {
    icon: "grid",
    tone: "green",
    title: "2. Frontend",
    text: "Interface em React e Vite estruturada em componentes para as telas de visão geral, dispositivos, detalhes, controle manual, alertas e configurações.",
  },
  {
    icon: "cpu",
    tone: "blue",
    title: "3. Backend & Banco",
    text: "API REST em Java (Spring Boot) com persistência em PostgreSQL para cadastro de dispositivos, histórico de leituras, agendamentos e alertas.",
  },
  {
    icon: "wifi",
    tone: "amber",
    title: "4. Integração IoT",
    text: "Comunicação bidirecional com dispositivos Arduino/ESP32 responsáveis pela coleta de umidade, temperatura, água e pH e acionamento da bomba.",
  },
  {
    icon: "sprout",
    tone: "violet",
    title: "5. Agricultura Familiar",
    text: "Parceria com plataforma de feiras e grupos de agricultura familiar, vinculando produtores aos dispositivos monitorados e aproximando o cultivo da origem dos alimentos.",
  },
];

function AboutProject({ navigate }: { navigate: (p: Page) => void }) {
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);

  return <div>
    <Header title="Sobre o projeto" eyebrow="PROJETO INTEGRADOR • SENAC DISTRITO CRIATIVO" onMenu={() => {}}/>
    <main className="page-content">
      <section className="about-hero">
        <span className="about-badge"><Icon name="sprout" size={14}/> Artigo de Projeto Integrador • 2026</span>
        <h2>Plataforma de Irrigação IoT: gerenciamento e monitoramento de dispositivos de rega</h2>
        <p>
          Desenvolvimento de uma plataforma web e mobile para gerenciamento e monitoramento de dispositivos de irrigação
          automatizada baseados em Arduino e ESP32, integrando sensores físicos a um ambiente virtual interativo.
        </p>
        <div className="about-hero-meta">
          <span><Icon name="map" size={15}/> Escola de Ensino Médio Senac Distrito Criativo • Porto Alegre – RS – Brasil (CEP 90560-900)</span>
        </div>
        <div className="about-hero-actions">
          <a href="/projeto/Artigo_de_PI.pdf" target="_blank" rel="noreferrer" className="about-btn-light">
            <Icon name="book" size={16}/> Ler Artigo Completo (PDF)
          </a>
          <a href="/projeto/Diagramas_Arquitetura_Plataforma_Verda.pdf" target="_blank" rel="noreferrer" className="about-btn-outline">
            <Icon name="activity" size={16}/> Baixar Caderno de Diagramas (PDF)
          </a>
          <button type="button" className="about-btn-outline" onClick={() => navigate("devices")}>
            <Icon name="cpu" size={16}/> Ver Dispositivos Conectados
          </button>
        </div>
      </section>

      <section style={{ marginBottom: "18px" }}>
        <div className="card-heading" style={{ marginBottom: "10px" }}>
          <div><h2>Autores e Orientadores</h2><p>Equipe responsável pelo desenvolvimento da pesquisa, hardware e software</p></div>
        </div>
        <div className="authors-grid">
          <div className="author-card">
            <div className="author-top">
              <div className="avatar">DA</div>
              <div>
                <span className="author-role student">Autor • Estudante</span>
                <b>Dori Amado Carvalho Vital Zugno Aguzzoli</b>
              </div>
            </div>
            <a className="author-email" href="mailto:04425810090@senacrs.edu.br">04425810090@senacrs.edu.br</a>
          </div>
          <div className="author-card">
            <div className="author-top">
              <div className="avatar">PH</div>
              <div>
                <span className="author-role student">Autor • Estudante</span>
                <b>Pedro Henrique Tavares de Andrade</b>
              </div>
            </div>
            <a className="author-email" href="mailto:60176035079@senacrs.edu.br">60176035079@senacrs.edu.br</a>
          </div>
          <div className="author-card">
            <div className="author-top">
              <div className="avatar" style={{ background: "linear-gradient(145deg,#3978ca,#245699)" }}>AS</div>
              <div>
                <span className="author-role advisor">Professor • Orientador</span>
                <b>Adalberto Pereira Soares</b>
              </div>
            </div>
            <a className="author-email" href="mailto:adpsoares@senacrs.com.br">adpsoares@senacrs.com.br</a>
          </div>
          <div className="author-card">
            <div className="author-top">
              <div className="avatar" style={{ background: "linear-gradient(145deg,#3978ca,#245699)" }}>SC</div>
              <div>
                <span className="author-role advisor">Professor • Orientador</span>
                <b>Sandro Martins da Costa</b>
              </div>
            </div>
            <a className="author-email" href="mailto:smcosta@senacrs.com.br">smcosta@senacrs.com.br</a>
          </div>
        </div>
      </section>

      <section className="about-grid-2">
        <div className="card about-card">
          <h3><Icon name="book" size={18}/> Resumo <span className="about-lang-tag">Português</span></h3>
          <p>
            Este projeto consiste no desenvolvimento de uma plataforma web para gerenciamento e monitoramento de
            dispositivos de irrigação automatizada baseados em Arduino. A solução integra os dispositivos físicos a um
            ambiente virtual, permitindo cadastrar equipamentos, acompanhar informações de funcionamento, controlar a
            irrigação e visualizar alertas e configurações. O sistema utiliza uma interface web e uma arquitetura com
            frontend e backend, preparando a plataforma para integração com dispositivos IoT reais.
          </p>
        </div>
        <div className="card about-card">
          <h3><Icon name="book" size={18}/> Abstract <span className="about-lang-tag">English</span></h3>
          <p>
            This project consists of developing a web platform for managing and monitoring automated irrigation devices
            based on Arduino. The solution connects physical devices to a virtual environment, allowing equipment
            registration, monitoring, irrigation control, alerts and settings. The architecture combines frontend and
            backend components and prepares the system for integration with real IoT devices.
          </p>
        </div>
      </section>

      <section className="card about-card" style={{ marginBottom: "18px" }}>
        <h3><Icon name="zap" size={18}/> 1. Objetivo Geral & 2. Objetivos Específicos</h3>
        <p>
          <strong>Objetivo Geral:</strong> Desenvolver uma plataforma web capaz de integrar dispositivos de irrigação
          automatizada baseados em Arduino a um ambiente virtual, permitindo o gerenciamento centralizado dos
          equipamentos e o acompanhamento de suas informações. A plataforma busca facilitar o controle da irrigação, a
          visualização do estado dos dispositivos e a identificação de situações que necessitem de atenção, criando uma
          base sólida para uma solução de Internet das Coisas (IoT).
        </p>
        <div className="objectives-list">
          {SPECIFIC_OBJECTIVES.map((obj, i) => (
            <div key={i} className="objective-item">
              <span className="objective-num">{i + 1}</span>
              <span>{obj}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card about-card" style={{ marginBottom: "18px" }}>
        <h3><Icon name="activity" size={18}/> 3. Metodologia & 4. Desenvolvimento</h3>
        <p>
          A metodologia consiste no desenvolvimento incremental de uma plataforma web para gerenciamento de dispositivos
          de irrigação IoT. Inicialmente, foi definida a estrutura visual e a navegação do frontend; em seguida, foi
          implementada a camada de backend responsável pelo processamento das informações, persistência em banco de
          dados e comunicação via API REST com a interface e com o microcontrolador Arduino/ESP32.
        </p>
        <p>
          Paralelamente, foi estabelecida uma parceria com outro projeto de mesma temática, cujo sistema reúne produtos
          de feiras e de grupos de agricultura familiar em um único site, buscando vincular esses grupos produtores aos
          dispositivos monitorados e aproximar o gerenciamento da irrigação da origem dos alimentos cultivados.
        </p>

        <div className="dev-pillars">
          {DEV_PILLARS.map((p, idx) => (
            <div key={idx} className="pillar-card">
              <div className={`metric-icon ${p.tone}`}><Icon name={p.icon} size={18}/></div>
              <b>{p.title}</b>
              <p>{p.text}</p>
            </div>
          ))}
        </div>

        <div className="arch-flow">
          <div className="arch-node">
            <Icon name="cpu" size={22}/>
            <b>1. Dispositivo Físico (Arduino / ESP32)</b>
            <small>Coleta umidade do solo, temperatura, nível de água e pH; aciona relé/bomba e exibe dados no LCD.</small>
          </div>
          <span className="arch-arrow">⇄</span>
          <div className="arch-node">
            <Icon name="activity" size={22}/>
            <b>2. Backend API & Banco (Spring Boot + PostgreSQL)</b>
            <small>Recebe leituras via HTTP POST (/api/ingest), processa limites, gera alertas e envia comandos da bomba.</small>
          </div>
          <span className="arch-arrow">⇄</span>
          <div className="arch-node">
            <Icon name="wifi" size={22}/>
            <b>3. Painel Interativo Web & Mobile (React + Vite)</b>
            <small>Atualiza gráficos em tempo real a cada 5s e permite ligar/desligar a rega direto pelo celular.</small>
          </div>
        </div>
      </section>

      <section className="card about-card" style={{ marginBottom: "18px" }}>
        <div className="card-heading" style={{ marginBottom: "14px" }}>
          <div>
            <h2>5. Diagramas de Arquitetura, Banco de Dados e Hardware</h2>
            <p>Representação técnica completa de como o Frontend, Backend, PostgreSQL e Arduino/ESP32 se conectam (clique para ampliar)</p>
          </div>
          <a href="/projeto/Diagramas_Arquitetura_Plataforma_Verda.pdf" target="_blank" rel="noreferrer" className="select-btn" style={{ textDecoration: "none" }}>
            <Icon name="book" size={14}/> Abrir PDF dos Diagramas
          </a>
        </div>
        <div className="about-grid-2" style={{ marginBottom: 0 }}>
          <button type="button" className="gallery-item" onClick={() => setSelectedPhoto({ src: DIAGRAMA_1_DATA, tag: "Diagrama 1 • Arquitetura Geral", title: "Arquitetura em 4 Camadas da Plataforma Verda", description: "Integração entre Camada Física IoT (Arduino Uno USB / ESP32 Wi-Fi), Frontend React/Vite (8443), Backend Spring Boot (8080) e PostgreSQL (5432)." })}>
            <div className="gallery-img-wrap" style={{ height: "230px", background: "#f7fbf9", padding: "8px" }}>
              <img src={DIAGRAMA_1_DATA} alt="Diagrama 1 - Arquitetura em 4 Camadas" style={{ objectFit: "contain" }} />
            </div>
            <div className="gallery-caption">
              <span>Diagrama 1 • Arquitetura em 4 Camadas</span>
              <b>Conexão Geral dos Componentes (Hardware, Web, API e Banco)</b>
              <p>Mostra as portas, protocolos (Serial, HTTP REST e JDBC) e módulos de cada camada do projeto.</p>
            </div>
          </button>
          <button type="button" className="gallery-item" onClick={() => setSelectedPhoto({ src: DIAGRAMA_2_DATA, tag: "Diagrama 2 • Sequência Bidirecional", title: "Fluxo de Telemetria dos Sensores e Comando pelo Celular", description: "Ciclo contínuo de envio de leituras (POST /readings), atualização dos gráficos a cada 5s e acionamento remoto da bomba (GET /command)." })}>
            <div className="gallery-img-wrap" style={{ height: "230px", background: "#f7fbf9", padding: "8px" }}>
              <img src={DIAGRAMA_2_DATA} alt="Diagrama 2 - Sequência de Comunicação" style={{ objectFit: "contain" }} />
            </div>
            <div className="gallery-caption">
              <span>Diagrama 2 • Fluxo de Comunicação</span>
              <b>Sequência Bidirecional: Sensor &harr; Site &harr; Celular &harr; Bomba</b>
              <p>Detalha o caminho das leituras até o gráfico e do botão no celular até o relé da bomba.</p>
            </div>
          </button>
          <button type="button" className="gallery-item" onClick={() => setSelectedPhoto({ src: DIAGRAMA_3_DATA, tag: "Diagrama 3 • Banco de Dados", title: "Modelo Entidade-Relacionamento (DER — Schema verda)", description: "Estrutura das 6 tabelas PostgreSQL (device, reading, irrigation_schedule, irrigation_log, alert e app_settings)." })}>
            <div className="gallery-img-wrap" style={{ height: "230px", background: "#f7fbf9", padding: "8px" }}>
              <img src={DIAGRAMA_3_DATA} alt="Diagrama 3 - DER Banco de Dados" style={{ objectFit: "contain" }} />
            </div>
            <div className="gallery-caption">
              <span>Diagrama 3 • Banco de Dados PostgreSQL</span>
              <b>Modelo Entidade-Relacionamento (Schema verda)</b>
              <p>Relacionamentos 1:N entre a tabela central device e o histórico de leituras, agendamentos e alertas.</p>
            </div>
          </button>
          <button type="button" className="gallery-item" onClick={() => setSelectedPhoto({ src: DIAGRAMA_4_DATA, tag: "Diagrama 4 • Esquema Elétrico", title: "Ligação Física: Arduino / ESP32 + Sensor + Relé 5V + Mini Bomba", description: "Pinagem de bancada ligando o sensor de umidade no pino analógico (A0/GPIO34) e o Módulo Relé 5V no pino digital (Pino 7/GPIO26)." })}>
            <div className="gallery-img-wrap" style={{ height: "230px", background: "#f7fbf9", padding: "8px" }}>
              <img src={DIAGRAMA_4_DATA} alt="Diagrama 4 - Esquema Elétrico" style={{ objectFit: "contain" }} />
            </div>
            <div className="gallery-caption">
              <span>Diagrama 4 • Hardware &amp; Hidráulica</span>
              <b>Esquema de Ligação Elétrica (Arduino, Sensor, Relé e Bomba)</b>
              <p>Mostra como o relé isola e chaveia a fonte 5V para acionar a mini bomba submersível no reservatório.</p>
            </div>
          </button>
        </div>
      </section>

      <section className="card about-card" style={{ marginBottom: "18px" }}>
        <div className="card-heading">
          <div>
            <h2>6. Registros Fotográficos do Protótipo em Funcionamento</h2>
            <p>Clique em qualquer imagem para ampliar os testes práticos de bancada e integração com as plantas</p>
          </div>
        </div>
        <div className="gallery-grid">
          {PROJECT_PHOTOS.map((photo, idx) => (
            <button type="button" key={idx} className="gallery-item" onClick={() => setSelectedPhoto(photo)}>
              <div className="gallery-img-wrap">
                <img src={photo.src} alt={photo.title} loading="lazy" />
              </div>
              <div className="gallery-caption">
                <span>{photo.tag}</span>
                <b>{photo.title}</b>
                <p>{photo.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="card about-card">
        <h3><Icon name="book" size={18}/> 7. Referências e Documentações Oficiais Utilizadas</h3>
        <div className="refs-grid">
          <a className="ref-link" href="https://docs.arduino.cc/tutorials/" target="_blank" rel="noreferrer">
            <div>
              <b>Arduino — Documentação Oficial da Plataforma</b>
              <small>https://docs.arduino.cc/tutorials/</small>
            </div>
            <Icon name="arrow" size={16}/>
          </a>
          <a className="ref-link" href="https://developer.mozilla.org/pt-BR/" target="_blank" rel="noreferrer">
            <div>
              <b>Mozilla Developer Network (MDN Web Docs)</b>
              <small>https://developer.mozilla.org/pt-BR/</small>
            </div>
            <Icon name="arrow" size={16}/>
          </a>
          <a className="ref-link" href="https://react.dev/learn" target="_blank" rel="noreferrer">
            <div>
              <b>React — Documentação Oficial da Biblioteca</b>
              <small>https://react.dev/learn</small>
            </div>
            <Icon name="arrow" size={16}/>
          </a>
          <a className="ref-link" href="https://v3.vitejs.dev/guide/" target="_blank" rel="noreferrer">
            <div>
              <b>Vite — Ferramenta de Desenvolvimento Frontend</b>
              <small>https://v3.vitejs.dev/guide/</small>
            </div>
            <Icon name="arrow" size={16}/>
          </a>
        </div>
      </section>

      {selectedPhoto && (
        <div className="lightbox-backdrop" onClick={() => setSelectedPhoto(null)}>
          <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto.src} alt={selectedPhoto.title} />
            <div className="lightbox-foot">
              <div>
                <b>{selectedPhoto.title}</b>
                <p>{selectedPhoto.description}</p>
              </div>
              <Button variant="secondary" onClick={() => setSelectedPhoto(null)}>
                <Icon name="close" size={15}/> Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  </div>;
}


function AuthPage({ navigate }: { navigate: (p: Page) => void }) {
  const { profile, refreshProfile } = useContext(ProfileContext);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regForm, setRegForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "Operador(a) de Irrigação",
    propertyName: "Horta Experimental Senac",
    propertyLocation: "Porto Alegre, RS",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectProtectedAdmin = (adminEmail: string, adminName: string) => {
    setMode("login");
    setLoginEmail(adminEmail);
    setLoginPassword("");
    setError(null);
    setSuccessMsg(`Conta Administradora de ${adminName} selecionada. Digite sua senha de administrador para entrar.`);
  };

  const handleLogin = async () => {
    const email = loginEmail.trim();
    const password = loginPassword.trim();
    if (!email || !password) {
      setError("Informe seu e-mail e sua senha para entrar.");
      return;
    }
    setBusy(true); setError(null); setSuccessMsg(null);
    try {
      const updated = await api.login({ email, password });
      refreshProfile();
      setSuccessMsg(`Bem-vindo(a), ${updated.fullName}! Redirecionando para o painel...`);
      setTimeout(() => navigate("dashboard"), 900);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível realizar o login.");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!regForm.fullName.trim()) { setError("Informe seu nome completo."); return; }
    if (!regForm.email.trim() || !regForm.email.includes("@")) { setError("Informe um e-mail válido."); return; }
    if (regForm.password.trim().length < 4) { setError("A senha deve ter pelo menos 4 caracteres."); return; }
    setBusy(true); setError(null); setSuccessMsg(null);
    try {
      const created = await api.register(regForm);
      refreshProfile();
      setSuccessMsg(`Conta de ${created.fullName} cadastrada e conectada com sucesso!`);
      setTimeout(() => navigate("dashboard"), 1000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível concluir o cadastro.");
    } finally {
      setBusy(false);
    }
  };

  return <div>
    <Header title="Acesso à Plataforma" eyebrow="AUTENTICAÇÃO • LOGIN E CADASTRO" onMenu={() => {}}/>
    <main className="page-content">
      <div className="auth-wrapper">
        <section className="card auth-card">
          <div className="auth-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); setSuccessMsg(null); }}>
              Entrar na Conta (Login)
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(null); setSuccessMsg(null); }}>
              Criar Nova Conta (Cadastro)
            </button>
          </div>

          <div className="auth-body">
            {mode === "login" ? (
              <>
                <h2>Bem-vindo(a) de volta à Plataforma Verda</h2>
                <p>Entre com seu e-mail e senha cadastrados para gerenciar as hortas e sensores IoT. As contas administradoras são protegidas por senha.</p>
                <div className="form-grid" style={{ padding: "8px 0 18px" }}>
                  <label className="full">
                    <span>E-mail de acesso</span>
                    <input
                      type="email"
                      placeholder="Ex.: pedro@senacrs.edu.br"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </label>
                  <label className="full">
                    <span>Senha</span>
                    <input
                      type="password"
                      placeholder="Digite sua senha de acesso"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                    />
                  </label>
                </div>
                {error && <p className="inline-error">{error}</p>}
                {successMsg && <p style={{ color: "#08795c", fontSize: "9.5px", fontWeight: 700, marginBottom: "12px" }}>🔒 {successMsg}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="secondary" onClick={() => { setMode("register"); setError(null); setSuccessMsg(null); }}>
                    Ainda não tenho conta
                  </Button>
                  <Button disabled={busy} onClick={handleLogin}>
                    <Icon name="check" size={16}/> {busy ? "Autenticando..." : "Entrar na Plataforma"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2>Cadastrar novo usuário na plataforma</h2>
                <p>Crie sua conta de operador ou visitante. O cargo de Administrador é exclusivo dos autores do projeto (Pedro Henrique e Dori Amado).</p>
                <div className="form-grid" style={{ padding: "8px 0 18px" }}>
                  <label className="full">
                    <span>Nome completo</span>
                    <input
                      placeholder="Digite seu nome completo"
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>E-mail</span>
                    <input
                      type="email"
                      placeholder="seuemail@exemplo.com"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Senha (mín. 4 caracteres)</span>
                    <input
                      type="password"
                      placeholder="Crie uma senha"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Telefone / WhatsApp</span>
                    <input
                      placeholder="(51) 99999-0000"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Função no projeto</span>
                    <select value={regForm.role} onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}>
                      <option>Operador(a) de Irrigação</option>
                      <option>Produtor(a) — Agricultura Familiar</option>
                      <option>Professor(a) / Avaliador(a)</option>
                    </select>
                  </label>
                  <label>
                    <span>Nome da Horta / Propriedade</span>
                    <input
                      placeholder="Ex.: Horta Experimental Senac"
                      value={regForm.propertyName}
                      onChange={(e) => setRegForm({ ...regForm, propertyName: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Cidade / Estado</span>
                    <input
                      placeholder="Ex.: Porto Alegre, RS"
                      value={regForm.propertyLocation}
                      onChange={(e) => setRegForm({ ...regForm, propertyLocation: e.target.value })}
                    />
                  </label>
                </div>
                {error && <p className="inline-error">{error}</p>}
                {successMsg && <p style={{ color: "#08795c", fontSize: "9.5px", fontWeight: 700, marginBottom: "12px" }}>✓ {successMsg}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="secondary" onClick={() => { setMode("login"); setError(null); }}>
                    Já tenho uma conta
                  </Button>
                  <Button disabled={busy} onClick={handleRegister}>
                    <Icon name="plus" size={16}/> {busy ? "Cadastrando..." : "Concluir Cadastro e Entrar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="auth-side-card">
          <span className="about-badge"><Icon name="shield" size={13}/> Administradores Oficiais • Acesso Protegido</span>
          <h3>Conectado como: {profile.fullName}</h3>
          <p>
            Propriedade atual: <strong>{profile.propertyName}</strong> ({profile.propertyLocation || "Porto Alegre, RS"}).
            As contas administradoras dos autores do projeto são protegidas por senha e não podem ser acessadas ou alteradas por outros usuários:
          </p>
          <div className="quick-accounts">
            <button type="button" className="quick-acc-btn" onClick={() => selectProtectedAdmin("pedro@senacrs.edu.br", "Pedro Henrique")}>
              <div className="avatar">PH</div>
              <div>
                <b>Pedro Henrique Tavares de Andrade</b>
                <small>pedro@senacrs.edu.br • Administrador Oficial</small>
              </div>
              <span className="quick-acc-tag">🔒 Requer Senha</span>
            </button>
            <button type="button" className="quick-acc-btn" onClick={() => selectProtectedAdmin("dori@senacrs.edu.br", "Dori Amado")}>
              <div className="avatar">DA</div>
              <div>
                <b>Dori Amado C. V. Z. Aguzzoli</b>
                <small>dori@senacrs.edu.br • Administrador Oficial</small>
              </div>
              <span className="quick-acc-tag">🔒 Requer Senha</span>
            </button>
          </div>
        </aside>
      </div>
    </main>
  </div>;
}

function Settings() {
  const { refreshProfile, navigate, theme, toggleTheme } = useContext(ProfileContext);
  const [tab, setTab] = useState<"profile" | "notifications" | "appearance" | "security">("profile");
  const [form, setForm] = useState<SettingsData | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then(setForm).catch((e) => setError(e instanceof ApiError ? e.message : "Não foi possível carregar as configurações."));
  }, []);

  const save = async () => {
    if (!form) return;
    if (!form.fullName.trim()) { setError("Informe seu nome completo."); return; }
    setSaving(true); setError(null);
    try {
      const updated = await api.updateSettings(form);
      setForm(updated);
      refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  };

  return <div><Header title="Configurações" eyebrow="SUA CONTA" onMenu={() => {}}/>
    <main className="page-content">
      <section className="settings-layout">
        <aside className="settings-nav card">
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><Icon name="user"/>Perfil e conta<Icon name="chevron" size={15}/></button>
          <button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}><Icon name="bell"/>Notificações<Icon name="chevron" size={15}/></button>
          <button className={tab === "appearance" ? "active" : ""} onClick={() => setTab("appearance")}><Icon name="palette"/>Tema e Preferências<Icon name="chevron" size={15}/></button>
          <button className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}><Icon name="shield"/>Segurança<Icon name="chevron" size={15}/></button>
          <hr/><button className="logout" onClick={() => navigate("auth")}><Icon name="logout"/>Sair / Trocar conta</button>
        </aside>
        <section className="card settings-panel">
          {!form ? <StateNotice text={error ?? "Carregando configurações..."}/> : <>
          {tab === "profile" && <><div className="panel-heading"><h2>Perfil e conta</h2><p>Gerencie suas informações pessoais e da propriedade.</p></div>
            <div className="profile-photo">
              <div className="avatar large">{form.fullName.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()}</div>
              <div>
                <Button variant="secondary" onClick={toggleTheme}>
                  <Icon name={theme === "dark" ? "sun" : "moon"} size={15}/>
                  {theme === "dark" ? "Mudar para Tema Claro" : "Mudar para Tema Escuro"}
                </Button>
                <p>Conectado como {form.role} ({form.email})</p>
              </div>
            </div>
            <div className="form-grid settings-form"><label><span>Nome completo</span><input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})}/></label><label><span>E-mail</span><input value={form.email} readOnly title="O e-mail da conta é protegido"/></label><label><span>Telefone</span><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></label><label><span>Função</span><input value={form.role} readOnly title="Cargo definido pela autenticação"/></label><label className="full"><span>Nome da propriedade</span><input value={form.propertyName} onChange={e => setForm({...form, propertyName: e.target.value})}/></label><label className="full"><span>Localização</span><input value={form.propertyLocation} onChange={e => setForm({...form, propertyLocation: e.target.value})}/></label></div>
          </>}
          {tab === "notifications" && <><div className="panel-heading"><h2>Notificações</h2><p>Escolha como e quando você deseja receber alertas.</p></div><div className="preference-list">
            <Toggle title="Alertas críticos" text="Baixa umidade, reservatório vazio e falha do dispositivo" checked={form.notifyCritical} onChange={v => setForm({...form, notifyCritical: v})}/>
            <Toggle title="Dispositivo offline" text="Quando um equipamento ficar desconectado por mais de 30 minutos" checked={form.notifyOffline} onChange={v => setForm({...form, notifyOffline: v})}/>
            <Toggle title="Rotinas concluídas" text="Confirmação após cada ciclo automático de irrigação" checked={form.notifyRoutines} onChange={v => setForm({...form, notifyRoutines: v})}/>
            <Toggle title="Resumo semanal" text="Relatório de consumo e desempenho enviado por e-mail" checked={form.notifyWeekly} onChange={v => setForm({...form, notifyWeekly: v})}/>
          </div></>}
          {tab === "appearance" && <><div className="panel-heading"><h2>Tema e Preferências da Plataforma</h2><p>Alterne entre o Tema Claro e o Tema Escuro e personalize os formatos.</p></div>
            <div className="preference-list">
              <Toggle title="Tema Escuro (Modo Noturno)" text="Ativa cores escuras para maior conforto visual" checked={theme === "dark"} onChange={() => toggleTheme()}/>
            </div>
            <div className="form-grid settings-form"><label><span>Idioma</span><select value={form.language} onChange={e => setForm({...form, language: e.target.value})}><option value="pt-BR">Português (Brasil)</option></select></label><label><span>Fuso horário</span><select value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}><option value="America/Sao_Paulo">Brasília (GMT-3)</option></select></label><label><span>Unidade de temperatura</span><select value={form.temperatureUnit} onChange={e => setForm({...form, temperatureUnit: e.target.value})}><option value="C">Celsius (°C)</option><option value="F">Fahrenheit (°F)</option></select></label><label><span>Formato de data</span><select value={form.dateFormat} onChange={e => setForm({...form, dateFormat: e.target.value})}><option value="DD/MM/AAAA">DD/MM/AAAA</option></select></label></div></>}
          {tab === "security" && <><div className="panel-heading"><h2>Segurança e Proteção de Contas</h2><p>Controle de acesso às contas administradoras do projeto.</p></div>
            <div className="preference-list" style={{ paddingBottom: "24px" }}>
              <div className="toggle-row">
                <div>
                  <b>Contas Administradoras Protegidas (Pedro Henrique &amp; Dori Amado)</b>
                  <p>O login nas contas pedro@senacrs.edu.br e dori@senacrs.edu.br exige senha obrigatória e não pode ser sobrescrito por terceiros.</p>
                </div>
                <span className="status status-online"><i/>Ativo</span>
              </div>
              <div className="toggle-row">
                <div>
                  <b>Bloqueio de Escalonamento de Privilégio no Cadastro</b>
                  <p>Novos cadastros recebem perfil de Operador(a), Produtor(a) ou Avaliador(a), mantendo a administração exclusiva dos autores.</p>
                </div>
                <span className="status status-online"><i/>Ativo</span>
              </div>
            </div>
          </>}
          {error && <p className="inline-error" style={{ margin: "0 25px" }}>{error}</p>}
          <div className="settings-footer"><span className={saved ? "save-confirm show" : "save-confirm"}><Icon name="check" size={15}/>Alterações salvas</span><Button disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar alterações"}</Button></div>
          </>}
        </section>
      </section>
    </main>
  </div>;
}

function Toggle({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="toggle-row"><div><b>{title}</b><p>{text}</p></div><button className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i/></button></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("verda_theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
    try { localStorage.setItem("verda_theme", theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  useMemo(() => navItems.find(n => n.id === page)?.label || "", [page]);

  const navigate = (p: Page) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openDevice = (id: string) => { setSelectedDeviceId(id); navigate("device"); };

  const refreshProfile = () => {
    api.settings().then((s) => setProfile({ fullName: s.fullName, email: s.email, role: s.role, propertyName: s.propertyName, propertyLocation: s.propertyLocation })).catch(() => {});
  };
  useEffect(() => {
    refreshProfile();
    // Ao entrar no site inicialmente na sessão, garante que todos os dispositivos comecem no Modo Manual
    if (!sessionStorage.getItem("verda_manual_init_done")) {
      sessionStorage.setItem("verda_manual_init_done", "1");
      api.devices().then((list) => {
        list.forEach((d) => {
          api.device(d.id, 1).then((det) => {
            if (det.autoIrrigation) {
              api.updateDeviceSettings(d.id, {
                minMoisture: det.minMoisture,
                defaultDurationMin: det.defaultDurationMin,
                autoIrrigation: false,
                disconnectAlerts: det.disconnectAlerts,
                minPh: det.minPh,
                maxPh: det.maxPh,
                defaultRegime: det.defaultRegime,
              }).catch(() => {});
            }
          }).catch(() => {});
        });
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api.alerts(true).then((r) => alive && setUnreadAlerts(r.summary.unread)).catch(() => {});
    return () => { alive = false; };
  }, [page]);

  const pageNode = page === "dashboard" ? <Dashboard navigate={navigate} openDevice={openDevice}/> :
    page === "devices" ? <Devices openDevice={openDevice} navigate={navigate}/> :
    page === "device" ? <DeviceDetail deviceId={selectedDeviceId} navigate={navigate}/> :
    page === "add" ? <AddDevice navigate={navigate}/> :
    page === "alerts" ? <Alerts onChanged={() => api.alerts(true).then(r => setUnreadAlerts(r.summary.unread)).catch(() => {})}/> :
    page === "about" ? <AboutProject navigate={navigate}/> :
    page === "auth" ? <AuthPage navigate={navigate}/> :
    <Settings/>;

  return <ProfileContext.Provider value={{ profile, refreshProfile, navigate, theme, toggleTheme }}>
    <div className="app-shell">
      <Sidebar page={page} setPage={navigate} open={sidebarOpen} close={() => setSidebarOpen(false)} unreadAlerts={unreadAlerts}/>
      <div className="main-shell">{pageNode}</div>
      <button className="mobile-menu-trigger lg:hidden" onClick={() => setSidebarOpen(true)}><Icon name="menu" size={22}/></button>
    </div>
  </ProfileContext.Provider>;
}
