import test from 'node:test';
import assert from 'node:assert/strict';
import { activitySummary, altasPorMes, addSocio, ALTAS_BASE, ACTIVITIES } from '../js/store.js';

test('ocupación por actividad: Fútbol reproduce el diseño (12+20+5 de 60, 1 horario completo)', () => {
  const f = activitySummary().find((a) => a.id === 'futbol');
  assert.deepEqual([f.ocupados, f.cupo, f.pct, f.completos, f.horarios], [37, 60, 62, 1, 3]);
  assert.equal(activitySummary().length, ACTIVITIES.length);
});

test('altas por mes: 6 meses, el último es el actual, y suma las altas reales', () => {
  const today = new Date(2026, 4, 20); // mayo 2026
  const before = altasPorMes(today);
  assert.equal(before.months.length, 6);
  assert.deepEqual(before.months.map((m) => m.label), ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May']);
  const fut = before.rows.find((r) => r.id === 'futbol');
  assert.deepEqual(fut.values, ALTAS_BASE.futbol);
  assert.equal(fut.total, ALTAS_BASE.futbol.reduce((a, b) => a + b, 0));

  addSocio({ id: 'S-0001', estado: 'activo', actividadId: 'futbol', horarioId: 'futbol-lun', altaAt: new Date(2026, 4, 10).toISOString() });
  addSocio({ id: 'S-0002', estado: 'activo', actividadId: 'futbol', horarioId: 'futbol-lun', altaAt: new Date(2026, 3, 10).toISOString() });
  const after = altasPorMes(today).rows.find((r) => r.id === 'futbol');
  assert.equal(after.values[5], ALTAS_BASE.futbol[5] + 1); // mayo
  assert.equal(after.values[4], ALTAS_BASE.futbol[4] + 1); // abril
  assert.equal(activitySummary().find((a) => a.id === 'futbol').ocupados, 39);
});
