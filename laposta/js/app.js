// UI layer for La Posta. All business rules live in logic.js.
//
// Persistence: the requirements say records must not be kept in any database. State therefore lives
// only in this device's browser (localStorage) so a page reload does not wipe the cars inside the lot,
// and exited records are purged 24 h after the exit. Nothing is ever sent to a server.

import {
  CATEGORY_LABEL, PAYMENT_LABEL, TARIFFS,
  emptyState, activeVehicles, exitedVehicles, findActive,
  parseAmount, computeChange, quoteExit, registerEntry, registerExit, purgeExpired,
  formatClock, formatDuration, formatMoney,
} from './logic.js';

const STORAGE_KEY = 'laposta.v1';

// ---------- State ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.vehicles)) return purgeExpired(parsed, Date.now());
  } catch { /* storage blocked or corrupt: start empty */ }
  return emptyState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

let state = loadState();
/** Charge in progress: { vehicle, minutes, due, exitAt } | null */
let current = null;

// ---------- DOM helpers ----------

const $ = (id) => document.getElementById(id);

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function show(el, text) {
  el.textContent = text;
  el.hidden = false;
}
const hide = (el) => { el.hidden = true; el.textContent = ''; };

function setInvalid(input, message, errorEl) {
  input.setAttribute('aria-invalid', 'true');
  show(errorEl, message);
}
function clearInvalid(input, errorEl) {
  input.removeAttribute('aria-invalid');
  hide(errorEl);
}

/** Uppercases as the user types without losing the caret position. */
function bindPlateInput(input, errorEl) {
  input.addEventListener('input', () => {
    const start = input.selectionStart;
    const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9 -]/g, '');
    if (cleaned !== input.value) {
      input.value = cleaned;
      input.setSelectionRange(start, start);
    }
    clearInvalid(input, errorEl);
  });
}

// ---------- Elements ----------

const el = {
  clock: $('clock'),
  badge: $('badge-active'),
  tabs: { ingreso: $('tab-ingreso'), cobro: $('tab-cobro') },
  views: { ingreso: $('view-ingreso'), cobro: $('view-cobro') },

  formIn: $('form-ingreso'), inPlate: $('in-plate'), inError: $('in-plate-error'), inFeedback: $('in-feedback'),
  activeBody: $('active-body'), activeEmpty: $('active-empty'),

  formFind: $('form-buscar'), coPlate: $('co-plate'), coError: $('co-plate-error'),
  formPay: $('form-pay'),
  dPlate: $('d-plate'), dCategory: $('d-category'), dEntry: $('d-entry'),
  dExit: $('d-exit'), dStay: $('d-stay'), dDue: $('d-due'),
  paid: $('co-paid'), change: $('co-change'), payError: $('co-pay-error'), notice: $('co-notice'),
  btnConfirm: $('btn-confirm'), btnCancel: $('btn-cancel'),
  exitsBody: $('exits-body'), exitsEmpty: $('exits-empty'), tariffBody: $('tariff-body'),

  dlgDiscard: $('dlg-discard'), dlgTicket: $('dlg-ticket'), ticketRows: $('ticket-rows'),
};

const selectedRadio = (form, name) => form.querySelector(`input[name="${name}"]:checked`)?.value ?? null;

// ---------- Navigation ----------

function showView(name, { focus = false } = {}) {
  for (const key of Object.keys(el.views)) {
    const active = key === name;
    el.views[key].hidden = !active;
    el.tabs[key].setAttribute('aria-selected', String(active));
    el.tabs[key].tabIndex = active ? 0 : -1;
  }
  if (focus) (name === 'ingreso' ? el.inPlate : el.coPlate).focus();
}

const viewFromHash = () => (location.hash === '#cobro' ? 'cobro' : 'ingreso');

for (const [name, tab] of Object.entries(el.tabs)) {
  tab.addEventListener('click', () => {
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    showView(name, { focus: true });
  });
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const other = name === 'ingreso' ? 'cobro' : 'ingreso';
      el.tabs[other].click();
      el.tabs[other].focus();
    }
  });
}
window.addEventListener('hashchange', () => showView(viewFromHash()));

// ---------- Rendering ----------

function renderActive() {
  const rows = activeVehicles(state).sort((a, b) => a.entryAt - b.entryAt);
  el.badge.textContent = String(rows.length);
  el.activeEmpty.hidden = rows.length > 0;
  el.activeBody.replaceChildren(
    ...rows.map((v) =>
      h('tr', {},
        h('td', {}, v.plate),
        h('td', {}, CATEGORY_LABEL[v.category] ?? v.category),
        h('td', {}, formatClock(v.entryAt)),
        h('td', { class: 'col-action' },
          h('button', {
            type: 'button', class: 'btn btn-secondary btn-sm',
            'aria-label': `Cobrar ${v.plate}`,
            onclick: () => startChargeFor(v.plate),
          }, 'Cobrar'),
        ),
      ),
    ),
  );
}

function renderExits() {
  const rows = exitedVehicles(state).sort((a, b) => b.exitAt - a.exitAt);
  el.exitsEmpty.hidden = rows.length > 0;
  el.exitsBody.replaceChildren(
    ...rows.map((v) =>
      h('tr', {},
        h('td', {}, v.plate),
        h('td', {}, formatClock(v.exitAt)),
        h('td', {}, PAYMENT_LABEL[v.payment?.method] ?? '—'),
        h('td', { class: 'num' }, formatMoney(v.payment?.amount ?? 0)),
      ),
    ),
  );
}

function renderTariffs() {
  el.tariffBody.replaceChildren(
    ...Object.entries(TARIFFS).map(([cat, t]) =>
      h('tr', {},
        h('td', {}, CATEGORY_LABEL[cat]),
        h('td', {}, formatMoney(t.h1)),
        h('td', {}, formatMoney(t.h12)),
        h('td', {}, formatMoney(t.h24)),
      ),
    ),
  );
}

function renderAll() {
  renderActive();
  renderExits();
}

// ---------- Pantalla 1 — Registrar ingreso ----------

el.formIn.addEventListener('submit', (e) => {
  e.preventDefault();
  hide(el.inFeedback);

  const result = registerEntry(state, el.inPlate.value, selectedRadio(el.formIn, 'categoria'), Date.now());
  if (!result.ok) {
    setInvalid(el.inPlate, result.message, el.inError);
    el.inPlate.focus();
    return;
  }

  state = result.state;
  saveState();
  clearInvalid(el.inPlate, el.inError);
  show(el.inFeedback, `Vehículo ${result.vehicle.plate} ingresado a las ${formatClock(result.vehicle.entryAt)}.`);
  el.formIn.reset();
  el.inPlate.focus();
  renderAll();
});

bindPlateInput(el.inPlate, el.inError);

// ---------- Pantalla 2 — Cobrar salida ----------

bindPlateInput(el.coPlate, el.coError);

function startChargeFor(plate) {
  el.coPlate.value = plate;
  location.hash = '#cobro';
  showView('cobro');
  searchVehicle();
  el.formPay.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function searchVehicle() {
  clearCharge({ keepPlate: true });
  const quote = quoteExit(state, el.coPlate.value, Date.now());
  if (!quote.ok) {
    setInvalid(el.coPlate, quote.message, el.coError);
    return;
  }
  clearInvalid(el.coPlate, el.coError);
  el.coPlate.value = quote.vehicle.plate;
  current = { vehicle: quote.vehicle, minutes: quote.minutes, due: quote.due, exitAt: Date.now() };
  el.formPay.reset();          // method back to Efectivo, paid amount cleared
  hide(el.notice);
  renderCharge();
  el.formPay.hidden = false;
  if (selectedRadio(el.formPay, 'metodo') === 'EFECTIVO') el.paid.focus({ preventScroll: true });
}

el.formFind.addEventListener('submit', (e) => {
  e.preventDefault();
  searchVehicle();
});

function renderCharge() {
  const { vehicle, minutes, due, exitAt } = current;
  el.dPlate.textContent = vehicle.plate;
  el.dCategory.textContent = CATEGORY_LABEL[vehicle.category];
  el.dEntry.textContent = formatClock(vehicle.entryAt);
  el.dExit.textContent = formatClock(exitAt);
  el.dStay.textContent = formatDuration(minutes);
  el.dDue.textContent = formatMoney(due);
  updatePaymentUi();
}

function updatePaymentUi() {
  if (!current) return;
  const method = selectedRadio(el.formPay, 'metodo');
  const cash = method === 'EFECTIVO';
  let canConfirm = true;
  hide(el.payError);
  el.paid.removeAttribute('aria-invalid');

  el.paid.disabled = !cash;
  if (cash) {
    const typed = el.paid.value.trim();
    const paid = parseAmount(typed);
    if (typed === '' || paid === null) {
      canConfirm = false;
      el.change.textContent = formatMoney(0);
      el.change.classList.remove('has-value');
    } else {
      const change = computeChange(paid, current.due);
      if (change < 0) {
        canConfirm = false;
        el.change.textContent = formatMoney(0);
        el.change.classList.remove('has-value');
        el.paid.setAttribute('aria-invalid', 'true');
        show(el.payError, `El monto abonado es menor al monto a pagar (faltan ${formatMoney(-change)}).`);
      } else {
        el.change.textContent = formatMoney(change);
        el.change.classList.add('has-value');
      }
    }
  } else {
    el.paid.value = String(current.due);
    el.change.textContent = formatMoney(0);
    el.change.classList.remove('has-value');
  }
  el.btnConfirm.disabled = !canConfirm;
}

el.paid.addEventListener('input', () => {
  const digits = el.paid.value.replace(/\D/g, '').slice(0, 9);
  if (digits !== el.paid.value) el.paid.value = digits;
  updatePaymentUi();
});
el.formPay.addEventListener('change', (e) => {
  if (e.target.name === 'metodo') {
    if (selectedRadio(el.formPay, 'metodo') === 'EFECTIVO') {
      el.paid.value = '';
      el.paid.focus({ preventScroll: true });
    }
    updatePaymentUi();
  }
});

el.formPay.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!current) return;
  const now = Date.now();

  // The clock kept running while the screen was open: if the stay crossed a price tier, re-quote
  // and make the operator confirm the new amount instead of charging a stale one.
  const fresh = quoteExit(state, current.vehicle.plate, now);
  if (!fresh.ok) {
    clearCharge();
    setInvalid(el.coPlate, fresh.message, el.coError);
    return;
  }
  if (fresh.due !== current.due) {
    current = { ...current, minutes: fresh.minutes, due: fresh.due, exitAt: now };
    renderCharge();
    show(el.notice, `El tiempo de estadía cambió el monto a cobrar a ${formatMoney(fresh.due)}. Revisá y confirmá de nuevo.`);
    return;
  }

  const method = selectedRadio(el.formPay, 'metodo');
  const result = registerExit(state, current.vehicle.plate, method, el.paid.value, now);
  if (!result.ok) {
    show(el.payError, result.message);
    return;
  }

  state = result.state;
  saveState();
  renderAll();
  showTicket(result.ticket);
});

function showTicket(t) {
  const row = (label, value, cls = 'mono') => h('div', {}, h('dt', {}, label), h('dd', { class: cls }, value));
  const cash = t.payment.method === 'EFECTIVO';
  el.ticketRows.replaceChildren(
    row('Patente', t.plate),
    row('Categoría', CATEGORY_LABEL[t.category]),
    row('Hora de ingreso', formatClock(t.entryAt)),
    row('Hora de salida', formatClock(t.exitAt)),
    row('Tiempo de estadía', formatDuration(t.minutes)),
    row('Método de pago', PAYMENT_LABEL[t.payment.method], ''),
    ...(cash ? [row('Monto abonado', formatMoney(t.payment.paid)), row('Vuelto', formatMoney(t.payment.change))] : []),
    h('div', { class: 'total' }, h('dt', {}, 'Total cobrado'), h('dd', { class: 'mono' }, formatMoney(t.payment.amount))),
  );
  el.dlgTicket.showModal();
}

el.dlgTicket.addEventListener('close', () => {
  clearCharge();
  el.coPlate.focus();
});

function clearCharge({ keepPlate = false } = {}) {
  current = null;
  el.formPay.hidden = true;
  el.formPay.reset();
  hide(el.notice);
  hide(el.payError);
  if (!keepPlate) {
    el.coPlate.value = '';
    clearInvalid(el.coPlate, el.coError);
  }
}

// Cancel: if a charge is in progress, ask before discarding (data-loss prevention pop-up).
el.btnCancel.addEventListener('click', () => {
  if (current) el.dlgDiscard.showModal();
  else clearCharge();
});
el.dlgDiscard.addEventListener('close', () => {
  if (el.dlgDiscard.returnValue === 'discard') {
    clearCharge();
    el.coPlate.focus();
  }
  el.dlgDiscard.returnValue = '';
});

// ---------- Clock, purge, multi-tab sync ----------

function tick() {
  el.clock.textContent = formatClock(Date.now(), true);
}

function purgeAndRender() {
  const next = purgeExpired(state, Date.now());
  if (next !== state) {
    state = next;
    saveState();
    renderExits();
  }
}

window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  state = loadState();
  renderAll();
  if (current && !findActive(state, current.vehicle.plate)) {
    clearCharge();
    setInvalid(el.coPlate, 'El vehículo en cobro ya fue cobrado desde otra pestaña.', el.coError);
  }
});

// ---------- Boot ----------

renderTariffs();
renderAll();
showView(viewFromHash());
tick();
setInterval(tick, 1000);
setInterval(purgeAndRender, 30 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); purgeAndRender(); } });
