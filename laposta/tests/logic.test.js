import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, validatePlate, normalizePlate, computeFee, computeChange, parseAmount,
  stayMinutes, formatClock, formatDuration, formatMoney, registerEntry, quoteExit, registerExit,
  purgeExpired, activeVehicles, findActive, RETENTION_MS, TARIFFS,
} from '../js/logic.js';

const T0 = new Date(2026, 0, 10, 9, 14, 0).getTime(); // 09:14 local
const min = (n) => n * 60000;

// ---------- Plate (RF1) ----------
test('patente: acepta 6 y 7 alfanuméricos y normaliza', () => {
  assert.deepEqual(validatePlate('ab123cd'), { ok: true, value: 'AB123CD' });
  assert.deepEqual(validatePlate(' ABC-123 '), { ok: true, value: 'ABC123' });
  assert.equal(normalizePlate(null), '');
});
test('patente: rechaza vacía, corta, larga y con símbolos', () => {
  assert.equal(validatePlate('').code, 'PLATE_REQUIRED');
  assert.equal(validatePlate('   ').code, 'PLATE_REQUIRED');
  assert.equal(validatePlate('AB12C').code, 'PLATE_INVALID');
  assert.equal(validatePlate('AB123CDE').code, 'PLATE_INVALID');
  assert.equal(validatePlate('AB12$CD').code, 'PLATE_INVALID');
  assert.equal(validatePlate('AÑ123CD').code, 'PLATE_INVALID');
});

// ---------- Pricing (RF4) ----------
test('tarifa AUTO: valores del mockup y límites de tramo con tolerancia de 15 min', () => {
  const cases = [
    [0, 800], [1, 800], [51, 800], [60, 800], [75, 800],   // 1 HS (+15)
    [76, 5000], [720, 5000], [735, 5000],                  // 12 HS (+15)
    [736, 8000], [1440, 8000], [1455, 8000],               // 24 HS (+15)
    [1456, 8800], [1470, 8800],                            // 24 h + resto cobrado como 1 HS
    [2175, 13000], [2176, 16000],                          // 24 h + 12 HS / 24 h + 24 HS
    [2880, 16000], [2895, 16000], [2896, 16800],           // 48 h (+15) y luego resto
  ];
  for (const [m, expected] of cases) assert.equal(computeFee('AUTO', m), expected, `AUTO ${m} min`);
});
test('tarifa: cada categoría usa su propia tabla', () => {
  for (const cat of Object.keys(TARIFFS)) {
    assert.equal(computeFee(cat, 30), TARIFFS[cat].h1);
    assert.equal(computeFee(cat, 300), TARIFFS[cat].h12);
    assert.equal(computeFee(cat, 900), TARIFFS[cat].h24);
  }
});
test('tarifa: entradas inválidas lanzan error', () => {
  assert.throws(() => computeFee('BICI', 10), RangeError);
  assert.throws(() => computeFee('AUTO', -1), RangeError);
  assert.throws(() => computeFee('AUTO', NaN), RangeError);
});

// ---------- Time / money formatting (RF2) ----------
test('formato horario 24 HS', () => {
  assert.equal(formatClock(new Date(2026, 0, 10, 0, 5).getTime()), '00:05');
  assert.equal(formatClock(new Date(2026, 0, 10, 23, 59).getTime()), '23:59');
  assert.equal(formatClock(new Date(2026, 0, 10, 13, 7, 9).getTime(), true), '13:07:09');
  assert.equal(formatDuration(51), '00:51');
  assert.equal(formatDuration(1570), '26:10');
  assert.equal(stayMinutes(T0, T0 + min(51) + 59000), 51);
  assert.equal(stayMinutes(T0, T0 - 1), 0);
});
test('formato de dinero es-AR', () => {
  assert.equal(formatMoney(800), '$ 800');
  assert.equal(formatMoney(1500), '$ 1.500');
  assert.equal(formatMoney(1234567), '$ 1.234.567');
});
test('monto abonado: solo dígitos', () => {
  assert.equal(parseAmount('1500'), 1500);
  assert.equal(parseAmount(' 20 '), 20);
  for (const bad of ['', 'abc', '-5', '15.5', '1e3', '1234567890', null]) assert.equal(parseAmount(bad), null, String(bad));
  assert.equal(computeChange(1500, 800), 700);
  assert.equal(computeChange(500, 800), -300);
});

// ---------- Entry (RF1) ----------
test('ingreso: registra y bloquea duplicados mientras esté activo', () => {
  const a = registerEntry(emptyState(), 'ab123cd', 'AUTO', T0);
  assert.ok(a.ok);
  assert.equal(a.vehicle.plate, 'AB123CD');
  assert.equal(a.vehicle.exitAt, null);
  const dup = registerEntry(a.state, 'AB123CD', 'MOTO', T0 + 1);
  assert.equal(dup.code, 'PLATE_ACTIVE');
  assert.equal(dup.message, 'La patente AB123CD ya está registrada y activa.');
  assert.equal(activeVehicles(a.state).length, 1);
});
test('ingreso: categoría obligatoria y válida; no muta el estado original', () => {
  const s = emptyState();
  assert.equal(registerEntry(s, 'AB123CD', undefined, T0).code, 'CATEGORY_REQUIRED');
  assert.equal(registerEntry(s, 'AB123CD', 'BICI', T0).code, 'CATEGORY_REQUIRED');
  assert.equal(registerEntry(s, '', 'AUTO', T0).code, 'PLATE_REQUIRED');
  registerEntry(s, 'AB123CD', 'AUTO', T0);
  assert.equal(s.vehicles.length, 0);
});

// ---------- Exit / charge (RF3, RF5, RF6, RF7) ----------
const withCar = (cat = 'AUTO') => registerEntry(emptyState(), 'AB123CD', cat, T0).state;

test('cobro: solo si el vehículo está registrado', () => {
  const r = quoteExit(emptyState(), 'ZZ999ZZ', T0);
  assert.equal(r.code, 'NOT_FOUND');
  assert.match(r.message, /solo puede realizarse si el vehículo está registrado/);
  assert.equal(registerExit(emptyState(), 'ZZ999ZZ', 'QR', '', T0).code, 'NOT_FOUND');
});
test('cobro: caso del mockup — 51 min, Auto, efectivo $1500 => $800 y vuelto $700', () => {
  const s = withCar();
  const q = quoteExit(s, 'AB123CD', T0 + min(51));
  assert.equal(q.minutes, 51);
  assert.equal(q.due, 800);
  const r = registerExit(s, 'AB123CD', 'EFECTIVO', '1500', T0 + min(51));
  assert.ok(r.ok);
  assert.deepEqual(r.ticket.payment, { method: 'EFECTIVO', amount: 800, paid: 1500, change: 700 });
  assert.equal(r.ticket.exitAt, T0 + min(51));
  assert.equal(findActive(r.state, 'AB123CD'), null);
});
test('cobro efectivo: monto faltante o ausente se rechaza y no cierra la estadía', () => {
  const s = withCar();
  const low = registerExit(s, 'AB123CD', 'EFECTIVO', '799', T0 + min(51));
  assert.equal(low.code, 'AMOUNT_LOW');
  assert.match(low.message, /faltan \$ 1\b/);
  assert.equal(registerExit(s, 'AB123CD', 'EFECTIVO', '', T0 + min(51)).code, 'AMOUNT_REQUIRED');
  assert.equal(registerExit(s, 'AB123CD', 'EFECTIVO', 'abc', T0 + min(51)).code, 'AMOUNT_REQUIRED');
  assert.ok(findActive(s, 'AB123CD'));
  const exact = registerExit(s, 'AB123CD', 'EFECTIVO', '800', T0 + min(51));
  assert.equal(exact.ticket.payment.change, 0);
});
test('cobro: el precio no depende del método; no efectivo cobra el monto exacto', () => {
  const s = withCar('CAMIONETA');
  for (const m of ['DEBITO', 'CREDITO', 'QR']) {
    const r = registerExit(s, 'AB123CD', m, '', T0 + min(300));
    assert.ok(r.ok, m);
    assert.deepEqual(r.ticket.payment, { method: m, amount: 6500, paid: 6500, change: 0 });
  }
});
test('cobro: método inválido y doble cobro', () => {
  const s = withCar();
  assert.equal(registerExit(s, 'AB123CD', 'CHEQUE', '', T0).code, 'METHOD_REQUIRED');
  assert.equal(registerExit(s, 'AB123CD', undefined, '', T0).code, 'METHOD_REQUIRED');
  const done = registerExit(s, 'AB123CD', 'QR', '', T0 + min(10));
  const again = quoteExit(done.state, 'AB123CD', T0 + min(20));
  assert.equal(again.code, 'ALREADY_EXITED');
  assert.match(again.message, /ya registró su salida a las 09:24/);
});
test('un vehículo que ya salió puede volver a ingresar', () => {
  const done = registerExit(withCar(), 'AB123CD', 'QR', '', T0 + min(10));
  const back = registerEntry(done.state, 'AB123CD', 'AUTO', T0 + min(30));
  assert.ok(back.ok);
  assert.equal(back.state.vehicles.length, 2);
});

// ---------- Retention (RF7) ----------
test('los registros se borran 24 h después de la salida; los activos nunca', () => {
  const done = registerExit(withCar(), 'AB123CD', 'QR', '', T0 + min(10));
  const exitAt = T0 + min(10);
  const other = registerEntry(done.state, 'ZZ999ZZ', 'MOTO', T0).state;
  assert.equal(purgeExpired(other, exitAt + RETENTION_MS - 1).vehicles.length, 2);
  const purged = purgeExpired(other, exitAt + RETENTION_MS);
  assert.equal(purged.vehicles.length, 1);
  assert.equal(purged.vehicles[0].plate, 'ZZ999ZZ');
  assert.equal(purgeExpired(other, exitAt + 100 * RETENTION_MS).vehicles.length, 1); // activo sobrevive
  assert.equal(purgeExpired(other, exitAt), other); // sin cambios => misma referencia
});
