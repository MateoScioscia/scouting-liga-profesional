import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDMY, formatDMY, maskDate, ageOn, categoryForAge, validateBirth, validateEmission, certExpiry,
  certStatus, validateName, validateDniFormat, validatePhone, validateEmail, validatePhoto, isPlausibleDni,
  cleanName, MSG,
} from '../js/rules.js';

const TODAY = new Date(2026, 0, 15); // 15/01/2026
const code = (r) => (r ? r.code : null);

test('fechas: parseo estricto dd/mm/aaaa', () => {
  assert.equal(formatDMY(parseDMY('15/05/2010')), '15/05/2010');
  for (const bad of ['', '1/5/2010', '31/02/2024', '00/01/2020', '15/13/2020', '15-05-2010', '15/05/1899', 'ab/cd/efgh']) {
    assert.equal(parseDMY(bad), null, bad);
  }
  assert.ok(parseDMY('29/02/2024')); // bisiesto
  assert.equal(parseDMY('29/02/2025'), null);
});

test('máscara de fecha', () => {
  assert.equal(maskDate('15052010'), '15/05/2010');
  assert.equal(maskDate('1505'), '15/05');
  assert.equal(maskDate('15'), '15');
  assert.equal(maskDate('15/05/20101234'), '15/05/2010');
  assert.equal(maskDate('ab1c5'), '15');
});

test('edad y categoría del diseño (Menor 4-12, Cadete 13-17, Mayor 18-128)', () => {
  assert.equal(ageOn(new Date(2010, 4, 15), TODAY), 15); // cumple en mayo: aún 15 en enero
  assert.equal(ageOn(new Date(2010, 0, 15), TODAY), 16); // cumple hoy
  assert.equal(ageOn(new Date(2010, 0, 16), TODAY), 15); // cumple mañana
  const cases = [[3, null], [4, 'MENOR'], [12, 'MENOR'], [13, 'CADETE'], [17, 'CADETE'], [18, 'MAYOR'], [128, 'MAYOR'], [129, null]];
  for (const [age, key] of cases) assert.equal(categoryForAge(age)?.key ?? null, key, `edad ${age}`);
});

test('fecha de nacimiento: obligatoria, no futura, edad > 3 y < 129', () => {
  assert.equal(code(validateBirth('', TODAY).error), 'required');
  assert.equal(validateBirth('15/05/2010', TODAY).category.label, 'Cadete');
  assert.equal(validateBirth('15/05/2010', TODAY).age, 15);
  assert.equal(validateBirth('16/01/2026', TODAY).error.message, MSG.birthFuture);
  assert.equal(validateBirth('31/02/2010', TODAY).error.message, MSG.birthFormat);
  assert.equal(validateBirth('15/01/2023', TODAY).error.message, MSG.ageRange);   // 3 años exactos
  assert.equal(validateBirth('15/01/2022', TODAY).error, null);                    // 4 años exactos
  assert.equal(validateBirth('16/01/1897', TODAY).error.message, MSG.birthFormat); // < 1900
  assert.equal(validateBirth('15/01/1900', TODAY).age, 126);                       // 126 años: dentro del rango (< 129)
});

test('certificado: emisión no futura y vencimiento = +1 año', () => {
  assert.equal(code(validateEmission('', TODAY).error), 'required');
  assert.equal(validateEmission('16/01/2026', TODAY).error.message, MSG.emissionFuture);
  const ok = validateEmission('10/03/2025', TODAY);
  assert.equal(ok.error, null);
  assert.equal(formatDMY(ok.expiry), '10/03/2026'); // ejemplo del diseño
  assert.equal(formatDMY(certExpiry(new Date(2024, 1, 29))), '28/02/2025'); // 29/02 -> 28/02
});

test('estado del certificado: alerta a 30 días', () => {
  const st = (d) => certStatus(new Date(2026, 0, 15 + d), TODAY);
  assert.equal(st(31).key, 'vigente');
  assert.equal(st(30).key, 'por_vencer');
  assert.equal(st(0).key, 'por_vencer');
  assert.equal(st(-1).key, 'vencido');
});

test('nombres: solo letras y espacios, hasta 50', () => {
  assert.equal(validateName('García', 'Apellido'), null);
  assert.equal(validateName('María José', 'Nombre'), null);
  assert.equal(validateName('Ñandú Üñez', 'Nombre'), null);
  assert.equal(validateName('  ', 'Apellido').message, 'El campo Apellido es obligatorio.');
  assert.equal(code(validateName('Juan3', 'Nombre')), 'invalid');
  assert.equal(code(validateName("O'Brien", 'Apellido')), 'invalid');
  assert.equal(validateName('a'.repeat(50), 'Nombre'), null);
  assert.equal(code(validateName('a'.repeat(51), 'Nombre')), 'invalid');
  assert.equal(cleanName('  Juan   Pablo '), 'Juan Pablo');
});

test('DNI: 7 u 8 dígitos numéricos', () => {
  assert.equal(validateDniFormat('30123456'), null);
  assert.equal(validateDniFormat('3012345'), null);
  assert.equal(validateDniFormat('').code, 'required');
  for (const bad of ['301234', '301234567', '3012345a', '30.123.456', ' 3012 345']) {
    assert.equal(validateDniFormat(bad).message, MSG.dniFormat, bad);
  }
});

test('DNI: heurística de persona real (simulada)', () => {
  assert.equal(isPlausibleDni('30123456'), true);
  assert.equal(isPlausibleDni('11111111'), false);
  assert.equal(isPlausibleDni('0000000'), false);
  assert.equal(isPlausibleDni('0999999'), false);
});

test('teléfono: 8-15 dígitos, permite espacios y guiones', () => {
  assert.equal(validatePhone('11 2345-6789'), null);
  assert.equal(validatePhone('12345678'), null);
  assert.equal(validatePhone('1'.repeat(15)), null);
  assert.equal(validatePhone('').code, 'required');
  for (const bad of ['1234567', '1'.repeat(16), '11 2345 678a', '+54 11 2345 6789']) {
    assert.equal(validatePhone(bad).message, MSG.phoneFormat, bad);
  }
});

test('email: opcional para el socio, obligatorio para el tutor, máx 100', () => {
  assert.equal(validateEmail('', { required: false }), null);
  assert.equal(validateEmail('', { required: true }).code, 'required');
  assert.equal(validateEmail('juan@gmail.com'), null);
  for (const bad of ['juan', 'juan@', 'juan@gmail', 'juan@@gmail.com', 'ju an@gmail.com']) {
    assert.equal(validateEmail(bad).message, MSG.emailFormat, bad);
  }
  assert.equal(validateEmail(`${'a'.repeat(91)}@gmail.com`).message, MSG.emailFormat); // 101 > 100
  assert.equal(validateEmail(`${'a'.repeat(90)}@gmail.com`), null); // exactamente 100
});

test('foto: JPG/PNG hasta 5 MB', () => {
  assert.equal(validatePhoto(null), null);
  assert.equal(validatePhoto({ type: 'image/png', size: 1000 }), null);
  assert.equal(validatePhoto({ type: 'image/jpeg', size: 5 * 1024 * 1024 }), null);
  assert.equal(validatePhoto({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }).message, MSG.photoSize);
  assert.equal(validatePhoto({ type: 'image/gif', size: 10 }).message, MSG.photoType);
});
