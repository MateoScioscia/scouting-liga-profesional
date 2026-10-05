// "Alta de socio" screen: wiring between the form markup (#tpl-alta) and the rules.
import { esc } from './util.js';
import { icons } from './icons.js';
import {
  VINCULOS, MSG, required, invalid, startOfDay, formatDMY, toISODate, fromISODate, maskDate,
  validateBirth, validateEmission, validateName, validateDniFormat, validatePhone, validateEmail,
  validatePhoto, cleanName, CERT_ALERT_DAYS, ADULT_AGE,
} from './rules.js';
import { ACTIVITIES, horariosOf, findHorario, addSocio, nextId, findActiveByDni } from './store.js';
import { verifyPersona } from './registry.js';

export function hydrateIcons(root) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.dataset.hydrated) {
      el.insertAdjacentHTML('afterbegin', icons[el.dataset.icon] ?? '');
      el.dataset.hydrated = '1';
    }
  });
}

const SOCIO_FIELDS = ['apellido', 'nombre', 'dni', 'nac', 'telefono', 'email'];
const TUTOR_FIELDS = ['t_apellido', 't_nombre', 't_dni', 't_vinculo', 't_email', 't_telefono'];
const OTHER_FIELDS = ['actividad', 'horario', 'emision'];

export function mountAlta(root, ctx) {
  root.replaceChildren(document.getElementById('tpl-alta').content.cloneNode(true));
  hydrateIcons(root);

  const $ = (id) => root.querySelector(`#${id}`);
  const form = $('form-alta');
  const today = startOfDay();
  const val = (name) => (form.elements[name]?.value ?? '');

  let birth = null;      // result of validateBirth when valid
  let photoData = null;  // data URL (downscaled JPEG) or null
  let saved = false;
  let saving = false;
  let dniToken = 0;

  // ---------- Field state helpers ----------

  const fieldEl = (name) => form.querySelector(`[data-field="${name}"]`);

  function setFieldState(name, err, { showValid = false } = {}) {
    const f = fieldEl(name);
    if (!f) return;
    const msg = f.querySelector('.msg');
    const main = f.querySelector('[data-main]');
    f.classList.remove('invalid', 'valid');
    main?.removeAttribute('aria-invalid');
    if (err) {
      msg.textContent = err.message;
      msg.hidden = false;
      f.classList.add('invalid');
      main?.setAttribute('aria-invalid', 'true');
    } else {
      msg.hidden = true;
      msg.textContent = '';
      if (showValid) f.classList.add('valid');
    }
  }

  const isInvalid = (name) => fieldEl(name)?.classList.contains('invalid');

  // ---------- Validators ----------

  const isMinor = () => birth !== null && birth.age < ADULT_AGE;

  const sync = {
    apellido: () => validateName(val('apellido'), 'Apellido'),
    nombre: () => validateName(val('nombre'), 'Nombre'),
    dni: () => validateDniFormat(val('dni')),
    nac: () => validateBirth(val('nac'), today).error,
    telefono: () => validatePhone(val('telefono')),
    email: () => validateEmail(val('email'), { required: false }),
    t_apellido: () => validateName(val('t_apellido'), 'Apellido'),
    t_nombre: () => validateName(val('t_nombre'), 'Nombre'),
    t_dni: () => {
      const e = validateDniFormat(val('t_dni'));
      if (e) return e;
      return val('t_dni').trim() === val('dni').trim() ? invalid(MSG.dniSameAsMember) : null;
    },
    t_vinculo: () => (VINCULOS.includes(val('t_vinculo')) ? null : required('Vínculo')),
    t_email: () => validateEmail(val('t_email'), { required: true }),
    t_telefono: () => validatePhone(val('t_telefono')),
    actividad: () => (val('actividad') ? null : required('Actividad')),
    horario: () => (val('horario') ? null : required('Horario')),
    emision: () => validateEmission(val('emision'), today).error,
  };

  /** DNI: format -> uniqueness among active members -> "real person" lookup (async, simulated). */
  async function checkDni(name) {
    const base = sync[name]();
    if (base) return base;
    if (name === 'dni') {
      if (findActiveByDni(val('dni'))) return invalid(MSG.dniDuplicate);
    }
    const { ok } = await verifyPersona(val(name));
    return ok ? null : invalid(MSG.dniNotPerson);
  }

  async function validateOne(name) {
    return name === 'dni' || name === 't_dni' ? checkDni(name) : sync[name]();
  }

  const showsValidIcon = (name) => name === 'dni' || name === 'email';

  // ---------- Derived data ----------

  function toggleTutor(show) {
    $('sec-tutor').hidden = !show;
    $('num-act').textContent = show ? '3' : '2';
    $('num-cert').textContent = show ? '4' : '3';
  }

  function applyBirth() {
    const r = validateBirth(val('nac'), today);
    birth = r.error ? null : r;
    $('edad-txt').textContent = birth ? `Edad: ${birth.age} años.` : '';
    $('f-categoria').value = birth ? birth.category.label : '';
    toggleTutor(isMinor());
  }

  function applyEmission() {
    const r = validateEmission(val('emision'), today);
    $('f-venc').value = r.error ? '' : formatDMY(r.expiry);
  }

  // ---------- Input filters & masks (prevent errors instead of reporting them) ----------

  function filterInput(name, pattern) {
    const el = $(`f-${name}`);
    el.addEventListener('input', () => {
      const cleaned = el.value.replace(pattern, '');
      if (cleaned === el.value) return;
      const caret = Math.max(0, (el.selectionStart ?? cleaned.length) - (el.value.length - cleaned.length));
      el.value = cleaned;
      el.setSelectionRange(caret, caret);
    });
  }
  ['apellido', 'nombre', 't_apellido', 't_nombre'].forEach((n) => filterInput(n, /[^\p{L} ]/gu));
  ['dni', 't_dni'].forEach((n) => filterInput(n, /\D/g));
  ['telefono', 't_telefono'].forEach((n) => filterInput(n, /[^0-9 -]/g));

  function bindDate(name, apply) {
    const text = $(`f-${name}`);
    const native = form.querySelector(`.native-date[data-for="${name}"]`);
    native.max = toISODate(today);

    text.addEventListener('input', () => {
      const masked = maskDate(text.value);
      if (masked !== text.value) text.value = masked;
      apply();
      const d = validateDateText(name);
      native.value = d ? toISODate(d) : '';
      if (isInvalid(name)) setFieldState(name, sync[name]());
    });

    native.addEventListener('change', () => {
      const d = fromISODate(native.value);
      if (!d) return;
      text.value = formatDMY(d);
      apply();
      setFieldState(name, sync[name]());
    });
  }

  function validateDateText(name) {
    const r = name === 'nac' ? validateBirth(val('nac'), today) : validateEmission(val('emision'), today);
    return r.error ? null : r.date;
  }

  bindDate('nac', applyBirth);
  bindDate('emision', applyEmission);

  // ---------- Live validation ----------

  form.addEventListener('input', (e) => {
    const f = e.target.closest('[data-field]');
    if (!f) return;
    const name = f.dataset.field;
    if (name === 'dni' || name === 't_dni') {
      dniToken++;
      f.classList.remove('valid');
      if (isInvalid(name)) setFieldState(name, sync[name]());
    } else if (name === 'email') {
      const err = sync.email();
      const hasValue = val('email').trim() !== '';
      if (isInvalid('email')) setFieldState('email', err, { showValid: !err && hasValue });
      else f.classList.toggle('valid', !err && hasValue);
    } else if (sync[name] && isInvalid(name) && name !== 'nac' && name !== 'emision') {
      setFieldState(name, sync[name]());
    }
  });

  form.addEventListener('change', (e) => {
    const f = e.target.closest('[data-field]');
    if (f && ['actividad', 't_vinculo'].includes(f.dataset.field) && isInvalid(f.dataset.field)) {
      setFieldState(f.dataset.field, sync[f.dataset.field]());
    }
  });

  form.addEventListener('focusout', async (e) => {
    const f = e.target.closest('[data-field]');
    if (!f) return;
    const name = f.dataset.field;
    if (!sync[name] || ['actividad', 'horario'].includes(name)) return;
    if (val(name).trim() === '') return; // required errors are reported on save
    const token = ++dniToken;
    const err = await validateOne(name);
    if ((name === 'dni' || name === 't_dni') && token !== dniToken) return; // user kept typing
    setFieldState(name, err, { showValid: !err && showsValidIcon(name) });
  });

  // ---------- Photo ----------

  const fileInput = $('f-foto');
  $('btn-foto').addEventListener('click', () => fileInput.click());
  $('btn-foto-rm').addEventListener('click', () => setPhoto(null));

  function setPhoto(dataUrl) {
    photoData = dataUrl;
    const box = $('photo-preview');
    box.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Foto del socio">` : icons.avatar;
    $('btn-foto-rm').hidden = !dataUrl;
    $('btn-foto').textContent = dataUrl ? 'Cambiar foto' : 'Seleccionar foto';
    fileInput.value = '';
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const err = validatePhoto(file);
    if (err) {
      setFieldState('foto', err);
      fileInput.value = '';
      return;
    }
    try {
      setPhoto(await toThumbnail(file));
      setFieldState('foto', null);
    } catch {
      setFieldState('foto', invalid(MSG.photoRead));
    }
  });

  // ---------- Activity + schedule (custom listbox to show "Completo") ----------

  const actSelect = $('f-actividad');
  actSelect.innerHTML =
    '<option value="">Seleccione una actividad</option>' +
    ACTIVITIES.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');

  const hBtn = $('f-horario');
  const hText = $('f-horario-text');
  const hList = $('horario-list');
  const hValue = $('f-horario-value');
  let hItems = [];
  let hActive = -1;

  function renderHorarios() {
    hList.innerHTML = hItems.map((h, i) => {
      const selected = h.id === hValue.value;
      const tail = h.completo ? '<span class="badge-full">Completo</span>' : selected ? icons.check : '';
      return `<li role="option" id="opt-${h.id}" data-i="${i}" aria-selected="${selected}" ${h.completo ? 'aria-disabled="true"' : ''} class="opt${h.completo ? ' full' : ''}${i === hActive ? ' active' : ''}">${icons.calendarSm}<span class="opt-t">${esc(h.label)} (Cupo: ${h.ocupados}/${h.cupo})</span>${tail}</li>`;
    }).join('');
    hList.setAttribute('aria-activedescendant', hItems[hActive] ? `opt-${hItems[hActive].id}` : '');
  }

  function refreshHorarios() {
    hItems = horariosOf(val('actividad'));
    const current = hItems.find((h) => h.id === hValue.value);
    if (!current || current.completo) setHorario(null);
    else setHorario(current);
  }

  function setHorario(h) {
    hValue.value = h ? h.id : '';
    const noActivity = !val('actividad');
    hBtn.disabled = noActivity;
    hText.className = h ? '' : 'placeholder';
    hText.textContent = h
      ? `${h.label} (Cupo: ${h.ocupados}/${h.cupo})`
      : noActivity ? 'Primero seleccione una actividad' : 'Seleccione un horario';
    if (h && isInvalid('horario')) setFieldState('horario', null);
  }

  function openList() {
    if (hBtn.disabled) return;
    hItems = horariosOf(val('actividad'));
    hActive = hItems.findIndex((h) => h.id === hValue.value);
    if (hActive < 0) hActive = hItems.findIndex((h) => !h.completo);
    hList.hidden = false;
    hBtn.setAttribute('aria-expanded', 'true');
    renderHorarios();
    hList.focus();
  }

  function closeList({ refocus = false } = {}) {
    hList.hidden = true;
    hBtn.setAttribute('aria-expanded', 'false');
    if (refocus) hBtn.focus();
  }

  function chooseHorario(i) {
    const h = hItems[i];
    if (!h || h.completo) return;
    setHorario(h);
    closeList({ refocus: true });
  }

  actSelect.addEventListener('change', () => {
    hValue.value = '';
    hItems = horariosOf(val('actividad'));
    setHorario(null);
    closeList();
  });

  hBtn.addEventListener('click', () => (hList.hidden ? openList() : closeList()));
  hBtn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openList(); }
  });
  hList.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) chooseHorario(Number(li.dataset.i));
  });
  hList.addEventListener('keydown', (e) => {
    const step = (dir) => {
      if (!hItems.length) return;
      hActive = (hActive + dir + hItems.length) % hItems.length;
      renderHorarios();
      hList.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
    };
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); hActive = 0; renderHorarios(); }
    else if (e.key === 'End') { e.preventDefault(); hActive = hItems.length - 1; renderHorarios(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseHorario(hActive); }
    else if (e.key === 'Escape') { e.preventDefault(); closeList({ refocus: true }); }
    else if (e.key === 'Tab') closeList();
  });

  const onOutside = (e) => { if (!hList.hidden && !e.target.closest('.select-wrap')) closeList(); };
  document.addEventListener('pointerdown', onOutside);
  ctx.onCleanup(() => document.removeEventListener('pointerdown', onOutside));

  // Another tab may have taken the last place: keep cupos fresh.
  const onStorage = () => { if (val('actividad')) { refreshHorarios(); if (!hList.hidden) renderHorarios(); } };
  window.addEventListener('storage', onStorage);
  ctx.onCleanup(() => window.removeEventListener('storage', onStorage));

  // ---------- Dirty tracking / leaving ----------

  function computeDirty() {
    if (photoData) return true;
    return [...form.elements].some(
      (el) => el.name && el.type !== 'file' && !el.readOnly && String(el.value).trim() !== '',
    );
  }
  const isDirty = () => !saved && computeDirty();

  ctx.setGuard({ isDirty });
  ctx.onCleanup(() => ctx.setGuard(null));

  $('btn-cancel').addEventListener('click', () => {
    if (isDirty()) ctx.confirmDiscard(() => { saved = true; ctx.go('#/socios'); });
    else ctx.go('#/socios');
  });

  // ---------- Save ----------

  const summary = $('alta-summary');
  const btnSave = $('btn-save');

  async function validateAll() {
    const names = [...SOCIO_FIELDS, ...(isMinor() ? TUTOR_FIELDS : []), ...OTHER_FIELDS];
    const errors = [];
    for (const name of names) {
      const err = await validateOne(name);
      setFieldState(name, err, { showValid: !err && showsValidIcon(name) && val(name).trim() !== '' });
      if (err) errors.push({ name, err });
    }
    return errors;
  }

  function focusField(name) {
    const main = fieldEl(name)?.querySelector('[data-main]');
    const target = main && !main.disabled ? main : form.querySelector('[data-field="actividad"] [data-main]');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (saving) return;
    saving = true;
    btnSave.disabled = true;
    summary.hidden = true;
    try {
      const errors = await validateAll();
      if (errors.length) {
        summary.textContent = errors.some((x) => x.err.code === 'required') ? MSG.requiredSummary : MSG.invalidSummary;
        summary.hidden = false;
        focusField(errors[0].name);
        return;
      }

      // Places may have been taken since the list was rendered.
      const slot = findHorario(val('horario'));
      if (!slot || slot.completo) {
        refreshHorarios();
        setFieldState('horario', invalid(MSG.scheduleFull));
        focusField('horario');
        return;
      }

      const socio = buildSocio(slot);
      addSocio(socio);
      saved = true;
      showSuccess(socio);
    } finally {
      saving = false;
      btnSave.disabled = false;
    }
  });

  function buildSocio(slot) {
    const emission = validateEmission(val('emision'), today);
    const minor = isMinor();
    return {
      id: nextId(),
      estado: 'activo',
      apellido: cleanName(val('apellido')),
      nombre: cleanName(val('nombre')),
      dni: val('dni').trim(),
      fechaNac: toISODate(birth.date),
      telefono: val('telefono').trim(),
      email: val('email').trim() || null,
      foto: photoData,
      categoria: birth.category.key,
      tutor: minor
        ? {
            apellido: cleanName(val('t_apellido')),
            nombre: cleanName(val('t_nombre')),
            dni: val('t_dni').trim(),
            vinculo: val('t_vinculo'),
            email: val('t_email').trim(),
            telefono: val('t_telefono').trim(),
          }
        : null,
      actividadId: slot.actividadId,
      horarioId: slot.id,
      certEmision: toISODate(emission.date),
      certVenc: toISODate(emission.expiry),
      altaAt: new Date().toISOString(),
    };
  }

  function showSuccess(socio) {
    const expiry = fromISODate(socio.certVenc);
    const lines = [];
    if (socio.email) {
      lines.push(`<li>${icons.mail}<span>Se ha enviado un correo de confirmación a <strong>${esc(socio.email)}</strong>.</span></li>`);
    }
    lines.push(
      `<li>${icons.info}<span>Se enviará una alerta ${CERT_ALERT_DAYS} días antes del vencimiento del certificado médico (${formatDMY(expiry)}).</span></li>`,
    );
    ctx.openDialog({
      tone: 'ok',
      icon: icons.checkCircle,
      title: '¡Socio dado de alta!',
      body: `<p>El socio <strong>${esc(socio.nombre)} ${esc(socio.apellido)}</strong> ha sido registrado correctamente.</p><ul class="dlg-info">${lines.join('')}</ul>`,
      actions: [
        { label: 'Ver ficha del socio', cls: 'btn-outline', onClick: () => ctx.go(`#/socios/${socio.id}`) },
        { label: 'Ir al listado de socios', cls: 'btn-primary', onClick: () => ctx.go('#/socios') },
      ],
      onDismiss: () => ctx.go('#/socios'),
    });
  }

  // initial state
  setPhoto(null);
  setHorario(null);
  toggleTutor(false);
}

/** Downscale to <= 320 px JPEG so a photo fits comfortably in localStorage. */
async function toThumbnail(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image'));
      i.src = url;
    });
    const scale = Math.min(1, 320 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
