// Business logic for La Posta. Pure functions only: no DOM, no storage, no Date.now().
// State shape: { vehicles: Vehicle[] }
// Vehicle: { plate, category, entryAt, exitAt, payment }
//   exitAt  = null while the vehicle is active, epoch ms once the exit ticket is issued
//   payment = null while active, { method, amount, paid, change } once charged

export const CATEGORIES = Object.freeze(['AUTO', 'MOTO', 'CAMIONETA']);
export const CATEGORY_LABEL = Object.freeze({ AUTO: 'Auto', MOTO: 'Moto', CAMIONETA: 'Camioneta' });

export const PAYMENT_METHODS = Object.freeze(['EFECTIVO', 'DEBITO', 'CREDITO', 'QR']);
export const PAYMENT_LABEL = Object.freeze({
  EFECTIVO: 'Efectivo',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  QR: 'QR',
});

// ASSUMPTION (hipótesis): the requirements fix three price types (1 HS / 12 HS / 24 HS) per
// vehicle type but not the amounts. Values below are consistent with the mockup (Auto, 51 min = $800).
// Edit here to change prices; nothing else in the app needs to change.
export const TARIFFS = Object.freeze({
  AUTO: Object.freeze({ h1: 800, h12: 5000, h24: 8000 }),
  MOTO: Object.freeze({ h1: 500, h12: 3000, h24: 5000 }),
  CAMIONETA: Object.freeze({ h1: 1100, h12: 6500, h24: 10000 }),
});

export const TOLERANCE_MIN = 15;
export const RETENTION_MS = 24 * 60 * 60 * 1000; // records are purged 24 h after the exit

const MIN_1H = 60;
const MIN_12H = 12 * 60;
const MIN_24H = 24 * 60;

export const MSG = Object.freeze({
  PLATE_REQUIRED: 'El campo Patente es obligatorio.',
  PLATE_INVALID: 'La patente debe tener 6 o 7 caracteres, solo letras y números.',
  CATEGORY_REQUIRED: 'Seleccioná una categoría.',
  METHOD_REQUIRED: 'Seleccioná un método de pago.',
  AMOUNT_REQUIRED: 'Ingresá el monto abonado (solo números).',
});

export const emptyState = () => ({ vehicles: [] });

// ---------- Plate ----------

/** Uppercases and strips spaces/hyphens ("ab-123 cd" -> "AB123CD"). */
export function normalizePlate(raw) {
  return String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/** Alphanumeric, 6–7 chars, mandatory. Returns { ok, value } or { ok:false, code, message }. */
export function validatePlate(raw) {
  const value = normalizePlate(raw);
  if (value === '') return { ok: false, code: 'PLATE_REQUIRED', message: MSG.PLATE_REQUIRED };
  if (!/^[A-Z0-9]{6,7}$/.test(value)) {
    return { ok: false, code: 'PLATE_INVALID', message: MSG.PLATE_INVALID };
  }
  return { ok: true, value };
}

// ---------- Time ----------

export function stayMinutes(entryAt, exitAt) {
  return Math.max(0, Math.floor((exitAt - entryAt) / 60000));
}

const pad2 = (n) => String(n).padStart(2, '0');

/** 24 h clock, local time. "HH:MM" (or "HH:MM:SS" with seconds=true). Never renders "24:xx". */
export function formatClock(ts, seconds = false) {
  const d = new Date(ts);
  const base = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return seconds ? `${base}:${pad2(d.getSeconds())}` : base;
}

/** Duration in minutes -> "HH:MM" (hours keep growing past 24: 26 h 10 min -> "26:10"). */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.floor(minutes));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

// ---------- Money ----------

/** 1500 -> "$ 1.500" (es-AR, deterministic: does not depend on the runtime's ICU data). */
export function formatMoney(n) {
  return '$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Digits only, up to 9 of them. Returns an integer or null. */
export function parseAmount(raw) {
  const s = String(raw ?? '').trim();
  return /^\d{1,9}$/.test(s) ? Number(s) : null;
}

// ---------- Pricing ----------

function tierPrice(tariff, minutes) {
  if (minutes <= MIN_1H + TOLERANCE_MIN) return tariff.h1;
  if (minutes <= MIN_12H + TOLERANCE_MIN) return tariff.h12;
  return tariff.h24;
}

/**
 * Fee for a stay. Same price regardless of payment method.
 *  - up to 1 h (+15 min tolerance)   -> 1 HS price (also the minimum charge, even for 0 min)
 *  - up to 12 h (+15 min tolerance)  -> 12 HS price
 *  - up to 24 h (+15 min tolerance)  -> 24 HS price
 *  - beyond that: a 24 HS block is charged per full day and the remainder is priced with the same rules.
 */
export function computeFee(category, minutes) {
  const tariff = TARIFFS[category];
  if (!tariff) throw new RangeError(`Categoría desconocida: ${category}`);
  if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError(`Minutos inválidos: ${minutes}`);

  let rest = Math.floor(minutes);
  let total = 0;
  while (rest > MIN_24H + TOLERANCE_MIN) {
    total += tariff.h24;
    rest -= MIN_24H;
  }
  return total + tierPrice(tariff, rest);
}

/** Change to hand back for a cash payment. Negative means the amount paid is not enough. */
export function computeChange(paid, due) {
  return paid - due;
}

// ---------- State queries ----------

export const activeVehicles = (state) => state.vehicles.filter((v) => v.exitAt === null);
export const exitedVehicles = (state) => state.vehicles.filter((v) => v.exitAt !== null);

export function findActive(state, plate) {
  const p = normalizePlate(plate);
  return state.vehicles.find((v) => v.exitAt === null && v.plate === p) ?? null;
}

/** Most recent exited record for the plate (used to explain "already charged"). */
export function findLastExit(state, plate) {
  const p = normalizePlate(plate);
  return (
    exitedVehicles(state)
      .filter((v) => v.plate === p)
      .sort((a, b) => b.exitAt - a.exitAt)[0] ?? null
  );
}

/** Drops records whose exit happened 24 h ago or more. Active vehicles are never dropped. */
export function purgeExpired(state, now) {
  const vehicles = state.vehicles.filter((v) => v.exitAt === null || now - v.exitAt < RETENTION_MS);
  return vehicles.length === state.vehicles.length ? state : { vehicles };
}

// ---------- Commands (return a new state, never mutate) ----------

export function registerEntry(state, rawPlate, category, now) {
  const plate = validatePlate(rawPlate);
  if (!plate.ok) return plate;
  if (!CATEGORIES.includes(category)) {
    return { ok: false, code: 'CATEGORY_REQUIRED', message: MSG.CATEGORY_REQUIRED };
  }
  if (findActive(state, plate.value)) {
    return {
      ok: false,
      code: 'PLATE_ACTIVE',
      message: `La patente ${plate.value} ya está registrada y activa.`,
    };
  }
  const vehicle = { plate: plate.value, category, entryAt: now, exitAt: null, payment: null };
  return { ok: true, vehicle, state: { vehicles: [...state.vehicles, vehicle] } };
}

/** Looks up an active vehicle to charge and computes stay + fee at `now`. */
export function quoteExit(state, rawPlate, now) {
  const plate = validatePlate(rawPlate);
  if (!plate.ok) return plate;
  const vehicle = findActive(state, plate.value);
  if (!vehicle) {
    const last = findLastExit(state, plate.value);
    return last
      ? {
          ok: false,
          code: 'ALREADY_EXITED',
          message: `El vehículo ${plate.value} ya registró su salida a las ${formatClock(last.exitAt)}.`,
        }
      : {
          ok: false,
          code: 'NOT_FOUND',
          message: `No hay un vehículo activo con la patente ${plate.value}. El cobro solo puede realizarse si el vehículo está registrado.`,
        };
  }
  const minutes = stayMinutes(vehicle.entryAt, now);
  return { ok: true, vehicle, minutes, due: computeFee(vehicle.category, minutes) };
}

/**
 * Charges and closes the stay (this is the "ticket de salida").
 * Cash: `paidRaw` is mandatory and must cover the fee; change is computed.
 * Other methods: the exact fee is charged, change is 0.
 */
export function registerExit(state, rawPlate, method, paidRaw, now) {
  if (!PAYMENT_METHODS.includes(method)) {
    return { ok: false, code: 'METHOD_REQUIRED', message: MSG.METHOD_REQUIRED };
  }
  const quote = quoteExit(state, rawPlate, now);
  if (!quote.ok) return quote;

  let paid = quote.due;
  if (method === 'EFECTIVO') {
    const parsed = parseAmount(paidRaw);
    if (parsed === null) return { ok: false, code: 'AMOUNT_REQUIRED', message: MSG.AMOUNT_REQUIRED };
    if (parsed < quote.due) {
      return {
        ok: false,
        code: 'AMOUNT_LOW',
        message: `El monto abonado es menor al monto a pagar (faltan ${formatMoney(quote.due - parsed)}).`,
      };
    }
    paid = parsed;
  }

  const payment = { method, amount: quote.due, paid, change: computeChange(paid, quote.due) };
  const closed = { ...quote.vehicle, exitAt: now, payment };
  const vehicles = state.vehicles.map((v) => (v === quote.vehicle ? closed : v));
  return { ok: true, state: { vehicles }, ticket: { ...closed, minutes: quote.minutes } };
}
