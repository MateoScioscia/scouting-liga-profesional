// Persistence layer. Everything lives in this browser's localStorage (no backend).
// Swap these functions for API calls to move to a shared database (e.g. Supabase).

const KEY = 'clubvecinal.socios.v1';
let memory = []; // fallback when localStorage is blocked (private mode, etc.)

// Seeded activities. `base` = places already taken before this app (so cupos look realistic).
// The first activity reproduces the schedules shown in the design (12/20, 20/20 "Completo", 5/20).
export const ACTIVITIES = Object.freeze([
  { id: 'futbol', nombre: 'Fútbol', horarios: [
    { id: 'futbol-lun', dia: 'Lun', desde: '18:00', hasta: '19:00', cupo: 20, base: 12 },
    { id: 'futbol-mie', dia: 'Mié', desde: '18:00', hasta: '19:00', cupo: 20, base: 20 },
    { id: 'futbol-vie', dia: 'Vie', desde: '18:00', hasta: '19:00', cupo: 20, base: 5 },
  ] },
  { id: 'basquet', nombre: 'Básquet', horarios: [
    { id: 'basquet-mar', dia: 'Mar', desde: '19:00', hasta: '20:30', cupo: 16, base: 8 },
    { id: 'basquet-jue', dia: 'Jue', desde: '19:00', hasta: '20:30', cupo: 16, base: 16 },
    { id: 'basquet-sab', dia: 'Sáb', desde: '10:00', hasta: '11:30', cupo: 16, base: 3 },
  ] },
  { id: 'natacion', nombre: 'Natación', horarios: [
    { id: 'natacion-lun', dia: 'Lun', desde: '17:00', hasta: '18:00', cupo: 12, base: 10 },
    { id: 'natacion-mie', dia: 'Mié', desde: '17:00', hasta: '18:00', cupo: 12, base: 4 },
    { id: 'natacion-vie', dia: 'Vie', desde: '17:00', hasta: '18:00', cupo: 12, base: 12 },
  ] },
  { id: 'voley', nombre: 'Vóley', horarios: [
    { id: 'voley-mar', dia: 'Mar', desde: '20:00', hasta: '21:30', cupo: 14, base: 6 },
    { id: 'voley-jue', dia: 'Jue', desde: '20:00', hasta: '21:30', cupo: 14, base: 14 },
  ] },
  { id: 'tenis', nombre: 'Tenis', horarios: [
    { id: 'tenis-sab-9', dia: 'Sáb', desde: '09:00', hasta: '10:00', cupo: 8, base: 2 },
    { id: 'tenis-sab-10', dia: 'Sáb', desde: '10:00', hasta: '11:00', cupo: 8, base: 8 },
    { id: 'tenis-dom', dia: 'Dom', desde: '09:00', hasta: '10:00', cupo: 8, base: 5 },
  ] },
  { id: 'gimnasia', nombre: 'Gimnasia', horarios: [
    { id: 'gimnasia-lun', dia: 'Lun', desde: '08:00', hasta: '09:00', cupo: 25, base: 9 },
    { id: 'gimnasia-mie', dia: 'Mié', desde: '08:00', hasta: '09:00', cupo: 25, base: 14 },
    { id: 'gimnasia-vie', dia: 'Vie', desde: '08:00', hasta: '09:00', cupo: 25, base: 25 },
  ] },
]);

export function loadSocios() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      memory = parsed;
      return parsed;
    }
  } catch { /* fall through to memory */ }
  return memory;
}

function saveSocios(list) {
  memory = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota or blocked: memory only */ }
}

export const activeSocios = () => loadSocios().filter((s) => s.estado === 'activo');
export const getSocio = (id) => loadSocios().find((s) => s.id === id) ?? null;
export const findActiveByDni = (dni) => activeSocios().find((s) => s.dni === String(dni).trim()) ?? null;

export function nextId() {
  const max = loadSocios().reduce((m, s) => Math.max(m, Number(String(s.id).replace(/\D/g, '')) || 0), 0);
  return `S-${String(max + 1).padStart(4, '0')}`;
}

export function addSocio(socio) {
  saveSocios([...loadSocios(), socio]);
  return socio;
}

export function bajaSocio(id) {
  saveSocios(loadSocios().map((s) => (s.id === id ? { ...s, estado: 'baja', bajaAt: new Date().toISOString() } : s)));
}

export const getActivity = (id) => ACTIVITIES.find((a) => a.id === id) ?? null;

function decorate(h) {
  const taken = activeSocios().filter((s) => s.horarioId === h.id).length;
  const ocupados = h.base + taken;
  return { ...h, label: `${h.dia} ${h.desde} - ${h.hasta}`, ocupados, completo: ocupados >= h.cupo };
}

/** Schedules of an activity with live occupancy; `completo` means no places left. */
export function horariosOf(activityId) {
  return (getActivity(activityId)?.horarios ?? []).map(decorate);
}

export function findHorario(horarioId) {
  for (const a of ACTIVITIES) {
    const h = a.horarios.find((x) => x.id === horarioId);
    if (h) return { ...decorate(h), actividadId: a.id, actividad: a.nombre };
  }
  return null;
}
