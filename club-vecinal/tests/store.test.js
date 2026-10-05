import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDemoSocios, DEMO_OCCUPANCY } from '../js/seed.js';
import { ACTIVITIES, activeSocios, activitySummary, altasPorMes, horariosOf, addSocio, resetDemo, findActiveByDni } from '../js/store.js';
import { ageOn, categoryForAge, certStatus, fromISODate, validateDniFormat, validatePhone, validateEmail, validateName, isPlausibleDni, startOfDay } from '../js/rules.js';

const TODAY = startOfDay(new Date());
const demo = generateDemoSocios(new Date());

test('demo: cantidad por horario = DEMO_OCCUPANCY y todos los horarios existen', () => {
  const validIds = new Set(ACTIVITIES.flatMap((a) => a.horarios.map((h) => h.id)));
  for (const id of Object.keys(DEMO_OCCUPANCY)) assert.ok(validIds.has(id), id);
  for (const id of validIds) assert.ok(id in DEMO_OCCUPANCY, `falta ${id}`);
  for (const [id, n] of Object.entries(DEMO_OCCUPANCY)) {
    assert.equal(demo.filter((s) => s.horarioId === id).length, n, id);
  }
  assert.equal(demo.length, Object.values(DEMO_OCCUPANCY).reduce((a, b) => a + b, 0));
});

test('demo: ningún horario supera su cupo y el actividadId coincide con el horario', () => {
  for (const a of ACTIVITIES) {
    for (const h of a.horarios) {
      const taken = demo.filter((s) => s.horarioId === h.id);
      assert.ok(taken.length <= h.cupo, h.id);
      assert.ok(taken.every((s) => s.actividadId === a.id), h.id);
    }
  }
});

test('demo: datos válidos según las mismas reglas del formulario', () => {
  const dnis = new Set();
  const ids = new Set();
  for (const s of demo) {
    assert.ok(!ids.has(s.id) && !dnis.has(s.dni), `duplicado ${s.id}/${s.dni}`);
    ids.add(s.id); dnis.add(s.dni);
    assert.equal(validateName(s.apellido, 'Apellido'), null, s.apellido);
    assert.equal(validateName(s.nombre, 'Nombre'), null, s.nombre);
    assert.equal(validateDniFormat(s.dni), null, s.dni);
    assert.ok(isPlausibleDni(s.dni), s.dni);
    assert.equal(validatePhone(s.telefono), null, s.telefono);
    assert.equal(validateEmail(s.email ?? '', { required: false }), null, s.email);
    const age = ageOn(fromISODate(s.fechaNac), TODAY);
    assert.equal(categoryForAge(age).key, s.categoria, `${s.id} edad ${age}`);
    assert.equal(Boolean(s.tutor), age < 18, `${s.id} tutor`);
    if (s.tutor) {
      assert.equal(validateDniFormat(s.tutor.dni), null);
      assert.equal(validateEmail(s.tutor.email, { required: true }), null);
      assert.equal(validatePhone(s.tutor.telefono), null);
    }
  }
});

test('demo: fechas coherentes (alta en los últimos 6 meses, certificado vigente al dar el alta)', () => {
  const windowStart = new Date(TODAY.getFullYear(), TODAY.getMonth() - 5, 1);
  for (const s of demo) {
    const alta = new Date(s.altaAt);
    assert.ok(alta >= windowStart && alta <= new Date(TODAY.getTime() + 86400000), `${s.id} alta`);
    const emission = fromISODate(s.certEmision);
    const venc = fromISODate(s.certVenc);
    assert.ok(emission <= startOfDay(alta), `${s.id}: certificado emitido después del alta`);
    assert.ok(venc >= startOfDay(alta), `${s.id}: certificado ya vencido al dar el alta`);
  }
  const st = demo.map((s) => certStatus(fromISODate(s.certVenc), TODAY).key);
  assert.ok(st.includes('por_vencer'), 'debe haber certificados por vencer');
  assert.ok(st.includes('vencido'), 'debe haber certificados vencidos');
  assert.ok(st.filter((k) => k === 'vigente').length > demo.length * 0.7);
});

test('demo: es determinista', () => {
  assert.deepEqual(generateDemoSocios(new Date()), demo);
});

test('el store arranca con los socios de ejemplo y los cupos salen de ellos', () => {
  assert.equal(activeSocios().length, demo.length);
  const fut = horariosOf('futbol');
  assert.deepEqual(fut.map((h) => [h.label, h.ocupados, h.cupo, h.completo]), [
    ['Lun 18:00 - 19:00', 12, 20, false],
    ['Mié 18:00 - 19:00', 20, 20, true],   // el horario "Completo" del diseño
    ['Vie 18:00 - 19:00', 5, 20, false],
  ]);
});

test('reportes: ocupación, listado y altas por mes coinciden entre sí', () => {
  const socios = activeSocios();
  const summary = activitySummary();
  for (const a of summary) {
    assert.equal(a.ocupados, socios.filter((s) => s.actividadId === a.id).length, a.id);
    assert.equal(a.completos, horariosOf(a.id).filter((h) => h.completo).length);
  }
  assert.equal(summary.reduce((n, a) => n + a.ocupados, 0), socios.length);
  assert.equal(summary.find((a) => a.id === 'futbol').completos, 1);

  const { months, rows } = altasPorMes(new Date());
  assert.equal(months.length, 6);
  for (const r of rows) assert.equal(r.total, socios.filter((s) => s.actividadId === r.id).length, r.id);
  assert.equal(rows.reduce((n, r) => n + r.total, 0), socios.length);
});

test('un alta nueva se refleja en cupos y reportes; "restablecer" vuelve al estado de ejemplo', () => {
  const before = activitySummary().find((a) => a.id === 'futbol').ocupados;
  addSocio({ id: 'S-9999', estado: 'activo', dni: '30123456', actividadId: 'futbol', horarioId: 'futbol-lun', altaAt: new Date().toISOString() });
  assert.equal(activitySummary().find((a) => a.id === 'futbol').ocupados, before + 1);
  assert.equal(horariosOf('futbol')[0].ocupados, 13);
  assert.ok(findActiveByDni('30123456'));
  const cur = altasPorMes(new Date()).rows.find((r) => r.id === 'futbol');
  assert.equal(cur.total, before + 1);

  resetDemo();
  assert.equal(activeSocios().length, demo.length);
  assert.equal(findActiveByDni('30123456'), null);
});
