// Validation and business rules for "Alta de socio". Pure functions: no DOM, no storage.
// Validators return null when valid, or { code: 'required' | 'invalid', message }.

export const CATEGORIES = Object.freeze([
  { key: 'MENOR', label: 'Menor', min: 4, max: 12 },
  { key: 'CADETE', label: 'Cadete', min: 13, max: 17 },
  { key: 'MAYOR', label: 'Mayor', min: 18, max: 128 },
]);

export const VINCULOS = Object.freeze(['Padre', 'Madre', 'Tutor Legal']);
export const ADULT_AGE = 18;
export const CERT_ALERT_DAYS = 30;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const MSG = Object.freeze({
  requiredSummary: 'Complete todos los campos obligatorios indicados con *.',
  invalidSummary: 'Revise los campos marcados en rojo.',
  dniFormat: 'El DNI ingresado no es válido. Debe tener 7 u 8 dígitos numéricos.',
  dniDuplicate: 'Ya existe un socio activo con este DNI.',
  dniNotPerson: 'El DNI ingresado no corresponde a una persona registrada.',
  dniSameAsMember: 'El DNI del tutor no puede coincidir con el del socio.',
  emailFormat: 'El email ingresado no tiene un formato válido.',
  phoneFormat: 'El teléfono ingresado no es válido. Debe tener entre 8 y 15 dígitos (se permiten espacios y guiones).',
  birthFormat: 'La fecha de nacimiento no es válida. Use el formato dd/mm/aaaa.',
  birthFuture: 'La fecha de nacimiento no puede ser posterior a la fecha actual.',
  ageRange: 'La edad debe ser mayor a 3 y menor a 129 años.',
  emissionFormat: 'La fecha de emisión no es válida. Use el formato dd/mm/aaaa.',
  emissionFuture: 'La fecha de emisión no puede ser posterior a la fecha actual.',
  scheduleFull: 'El horario seleccionado está completo. Por favor, elija otro horario.',
  photoType: 'La foto debe ser un archivo JPG o PNG.',
  photoSize: 'La foto no puede superar los 5 MB.',
  photoRead: 'No se pudo leer la imagen seleccionada.',
});

export const required = (label) => ({ code: 'required', message: `El campo ${label} es obligatorio.` });
export const invalid = (message) => ({ code: 'invalid', message });

// ---------- Dates (local time, no timezone surprises) ----------

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const p2 = (n) => String(n).padStart(2, '0');
export const formatDMY = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const toISODate = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export function fromISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "dd/mm/aaaa" -> Date, or null when malformed or not a real calendar date (31/02, year < 1900). */
export function parseDMY(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900) return null;
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/** Live input mask: "15052010" -> "15/05/2010". */
export function maskDate(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export const daysBetween = (from, to) => Math.round((to - from) / 86400000);

export function ageOn(birth, today) {
  const years = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  return hadBirthday ? years : years - 1;
}

export const categoryForAge = (age) => CATEGORIES.find((c) => age >= c.min && age <= c.max) ?? null;
export const categoryByKey = (key) => CATEGORIES.find((c) => c.key === key) ?? null;

/** Birth date text -> { error, date, age, category }. Valid ages are > 3 and < 129. */
export function validateBirth(text, today = startOfDay()) {
  const t = String(text ?? '').trim();
  if (!t) return { error: required('Fecha de nacimiento') };
  const date = parseDMY(t);
  if (!date) return { error: invalid(MSG.birthFormat) };
  if (date > today) return { error: invalid(MSG.birthFuture) };
  const age = ageOn(date, today);
  if (age <= 3 || age >= 129) return { error: invalid(MSG.ageRange), date, age };
  return { error: null, date, age, category: categoryForAge(age) };
}

/** Medical certificate issue date: mandatory, not in the future. */
export function validateEmission(text, today = startOfDay()) {
  const t = String(text ?? '').trim();
  if (!t) return { error: required('Fecha de emisión') };
  const date = parseDMY(t);
  if (!date) return { error: invalid(MSG.emissionFormat) };
  if (date > today) return { error: invalid(MSG.emissionFuture) };
  return { error: null, date, expiry: certExpiry(date) };
}

/** The certificate is valid for one year from the issue date (29/02 -> last day of February). */
export function certExpiry(emission) {
  const y = emission.getFullYear() + 1;
  const m = emission.getMonth();
  const candidate = new Date(y, m, emission.getDate());
  return candidate.getMonth() === m ? candidate : new Date(y, m + 1, 0);
}

export const certAlertDate = (expiry) => addDays(expiry, -CERT_ALERT_DAYS);

/** 'vigente' | 'por_vencer' (<= 30 days left) | 'vencido' */
export function certStatus(expiry, today = startOfDay()) {
  const days = daysBetween(today, expiry);
  if (days < 0) return { key: 'vencido', days };
  if (days <= CERT_ALERT_DAYS) return { key: 'por_vencer', days };
  return { key: 'vigente', days };
}

// ---------- Text fields ----------

export const cleanName = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

/** Text | 50 | mandatory | letters and spaces only. */
export function validateName(value, label) {
  const v = cleanName(value);
  if (!v) return required(label);
  if (v.length > 50) return invalid(`El campo ${label} no puede superar los 50 caracteres.`);
  if (!/^\p{L}+(?: \p{L}+)*$/u.test(v)) return invalid(`El campo ${label} solo admite letras y espacios.`);
  return null;
}

/** Numeric | 7-8 | mandatory | digits only. */
export function validateDniFormat(value, label = 'DNI') {
  const v = String(value ?? '').trim();
  if (!v) return required(label);
  return /^\d{7,8}$/.test(v) ? null : invalid(MSG.dniFormat);
}

/** Phone | 8-15 | mandatory | digits, may include spaces or hyphens. */
export function validatePhone(value) {
  const v = String(value ?? '').trim();
  if (!v) return required('Teléfono');
  if (!/^[0-9 -]+$/.test(v)) return invalid(MSG.phoneFormat);
  const digits = v.replace(/\D/g, '').length;
  return digits >= 8 && digits <= 15 ? null : invalid(MSG.phoneFormat);
}

/** Email | 100 | optional for the member, mandatory for the guardian. */
export function validateEmail(value, { required: isRequired = false } = {}) {
  const v = String(value ?? '').trim();
  if (!v) return isRequired ? required('Email') : null;
  const ok = v.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  return ok ? null : invalid(MSG.emailFormat);
}

/** Photo | optional | JPG or PNG | max 5 MB. Takes anything with { type, size }. */
export function validatePhoto(file) {
  if (!file) return null;
  if (!['image/jpeg', 'image/png'].includes(file.type)) return invalid(MSG.photoType);
  if (file.size > PHOTO_MAX_BYTES) return invalid(MSG.photoSize);
  return null;
}

/**
 * Stand-in for the external "is this a real person?" check (assumption #4 of the design).
 * Replace the body with a real registry call; the contract is { ok: boolean }.
 */
export function isPlausibleDni(dni) {
  const d = String(dni ?? '');
  return !/^(\d)\1+$/.test(d) && Number(d) >= 1_000_000;
}
