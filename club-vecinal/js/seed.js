// Demo data: fictitious members so the client can see the app working with realistic numbers.
// Everything in the app (cupos, listado, reportes, altas por mes) is computed from these members,
// so the figures always agree. Deterministic (seeded PRNG) and relative to "today".

import { addDays, certExpiry, daysBetween, startOfDay, toISODate, categoryForAge } from './rules.js';

/** Places taken per schedule at start. Fútbol reproduces the design: 12/20, 20/20 (Completo), 5/20. */
export const DEMO_OCCUPANCY = Object.freeze({
  'futbol-lun': 12, 'futbol-mie': 20, 'futbol-vie': 5,
  'basquet-mar': 8, 'basquet-jue': 16, 'basquet-sab': 3,
  'natacion-lun': 10, 'natacion-mie': 4, 'natacion-vie': 12,
  'voley-mar': 6, 'voley-jue': 14,
  'tenis-sab-9': 2, 'tenis-sab-10': 8, 'tenis-dom': 5,
  'gimnasia-lun': 9, 'gimnasia-mie': 14, 'gimnasia-vie': 25,
});

const APELLIDOS = [
  'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
  'Romero', 'Díaz', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina',
  'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Gutiérrez', 'Castro', 'Rojas', 'Ortiz', 'Silva', 'Molina',
  'Núñez', 'Morales', 'Peralta', 'Vega', 'Ríos', 'Sosa', 'Cabrera', 'Domínguez', 'Ledesma', 'Villalba',
];
const NOMBRES = [
  'Juan', 'María', 'Carlos', 'Lucía', 'Martín', 'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila',
  'Nicolás', 'Julieta', 'Tomás', 'Agustina', 'Franco', 'Florencia', 'Lautaro', 'Micaela', 'Joaquín', 'Rocío',
  'Facundo', 'Candela', 'Bruno', 'Milagros', 'Thiago', 'Abril', 'Ezequiel', 'Paula', 'Gonzalo', 'Daniela',
  'Federico', 'Antonella', 'Emiliano', 'Carolina', 'Ignacio', 'Natalia', 'Bautista', 'Belén', 'Diego', 'Romina',
];

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

export function generateDemoSocios(todayInput = new Date()) {
  const today = startOfDay(todayInput);
  const rand = mulberry32(20260101);
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const windowStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const maxAgo = daysBetween(windowStart, today); // sign-ups spread over the last 6 months

  const usedDni = new Set();
  const dniForBirthYear = (year) => {
    for (;;) {
      const n = Math.min(99_999_999, Math.round(14_000_000 + (year - 1950) * 640_000 + rand() * 600_000));
      const dni = String(n);
      if (!usedDni.has(dni)) { usedDni.add(dni); return dni; }
    }
  };
  const phone = () => `11 ${int(2000, 7999)}-${int(1000, 9999)}`;

  const slots = Object.entries(DEMO_OCCUPANCY).flatMap(([id, n]) => Array(n).fill(id));
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const socios = slots.map((horarioId) => {
    const r = rand();
    const age = r < 0.25 ? int(5, 12) : r < 0.5 ? int(13, 17) : int(18, 62);
    const birthMax = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
    const birthMin = addDays(new Date(today.getFullYear() - age - 1, today.getMonth(), today.getDate()), 1);
    const birth = addDays(birthMin, int(0, daysBetween(birthMin, birthMax)));

    // Certificate: ~9% expiring within 30 days, ~5% expired, the rest valid. Always valid on the sign-up date.
    const u = rand();
    let sinceAlta;
    let emissionAgo;
    if (u < 0.09) {
      emissionAgo = int(336, 364);
      sinceAlta = int(0, maxAgo);
    } else if (u < 0.14) {
      emissionAgo = 366 + int(0, 30);
      const minSince = emissionAgo - 364;
      sinceAlta = int(minSince, maxAgo);
    } else {
      sinceAlta = int(0, maxAgo);
      emissionAgo = sinceAlta + int(1, 60);
    }
    const alta = addDays(today, -sinceAlta);
    alta.setHours(sinceAlta === 0 ? 0 : int(8, 20), int(0, 59), 0, 0);
    const emission = addDays(today, -emissionAgo);

    const apellido = pick(APELLIDOS);
    const nombre = pick(NOMBRES);
    const minor = age < 18;
    const tutorNombre = pick(NOMBRES);
    return {
      estado: 'activo',
      apellido,
      nombre,
      dni: dniForBirthYear(birth.getFullYear()),
      fechaNac: toISODate(birth),
      telefono: phone(),
      email: rand() < 0.6 ? `${plain(nombre)}.${plain(apellido)}${int(1, 99)}@gmail.com` : null,
      foto: null,
      categoria: categoryForAge(age).key,
      tutor: minor
        ? {
            apellido,
            nombre: tutorNombre,
            dni: dniForBirthYear(today.getFullYear() - int(30, 50)),
            vinculo: rand() < 0.45 ? 'Madre' : rand() < 0.85 ? 'Padre' : 'Tutor Legal',
            email: `${plain(tutorNombre)}.${plain(apellido)}${int(1, 99)}@gmail.com`,
            telefono: phone(),
          }
        : null,
      actividadId: horarioId.split('-')[0],
      horarioId,
      certEmision: toISODate(emission),
      certVenc: toISODate(certExpiry(emission)),
      altaAt: alta.toISOString(),
      demo: true,
    };
  });

  socios.sort((a, b) => a.altaAt.localeCompare(b.altaAt));
  return socios.map((s, i) => ({ id: `S-${String(i + 1).padStart(4, '0')}`, ...s }));
}
