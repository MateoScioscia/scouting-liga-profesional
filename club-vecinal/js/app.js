// App shell: hash router, unsaved-changes guard and the shared modal dialog.
import { icons } from './icons.js';
import { esc } from './util.js';
import { mountAlta, hydrateIcons } from './alta.js';
import { mountSocios, mountFicha, mountActividades, mountReportes } from './lists.js';

const app = document.getElementById('app');
const dlg = document.getElementById('dlg');

document.getElementById('brand').innerHTML = `${icons.shield}<span>Club Atlético Vecinal</span>`;
document.getElementById('user').innerHTML = `${icons.userCircle}<span>Usuario</span>${icons.chevron}`;

// ---------- Modal dialog ----------

let modal = null; // { actions, onDismiss, done }

function openDialog({ tone = 'info', icon, title, body = '', actions = [], onDismiss }) {
  const buttons = actions
    .map((a, i) => `<button type="button" class="btn ${a.cls}" data-i="${i}">${esc(a.label)}</button>`)
    .join('');
  dlg.innerHTML = `<div class="dlg-box">
    <button type="button" class="dlg-x" data-x aria-label="Cerrar">${icons.x}</button>
    <div class="dlg-head"><span class="dlg-ic ${tone}">${icon}</span><h2 id="dlg-title">${esc(title)}</h2></div>
    <div class="dlg-body">${body}</div>
    <div class="dlg-actions">${buttons}</div></div>`;
  modal = { actions, onDismiss, done: false };
  dlg.showModal();
}

dlg.addEventListener('click', (e) => {
  if (!modal) return;
  const btn = e.target.closest('button');
  if (btn && btn.dataset.i !== undefined) {
    const action = modal.actions[Number(btn.dataset.i)];
    modal.done = true;
    dlg.close();
    action.onClick?.();
  } else if (btn?.hasAttribute('data-x') || e.target === dlg) {
    dlg.close();
  }
});

// Esc, X and backdrop all end up here: counts as "dismissed", not as a chosen action.
dlg.addEventListener('close', () => {
  if (modal && !modal.done) {
    modal.done = true;
    modal.onDismiss?.();
  }
});

/** Data-loss prevention pop-up. */
function confirmDiscard(onDiscard) {
  openDialog({
    tone: 'warn',
    icon: icons.warn,
    title: '¿Descartar los datos ingresados?',
    body: '<p>Tienes información sin guardar. Si sales ahora, se perderán todos los datos cargados.</p>',
    actions: [
      { label: 'Cancelar', cls: 'btn-outline' },
      { label: 'Descartar y salir', cls: 'btn-danger', onClick: onDiscard },
    ],
  });
}

// ---------- Router ----------

const routes = [
  { re: /^#\/alta$/, nav: 'socios', mount: mountAlta },
  { re: /^#\/socios$/, nav: 'socios', mount: mountSocios },
  { re: /^#\/socios\/(S-\d+)$/, nav: 'socios', mount: mountFicha },
  { re: /^#\/actividades$/, nav: 'actividades', mount: mountActividades },
  { re: /^#\/reportes$/, nav: 'reportes', mount: mountReportes },
];

let guard = null;      // { isDirty() } while a screen has unsaved data
let cleanups = [];
let currentHash = null;

const ctx = {
  go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
  openDialog,
  confirmDiscard,
  setGuard(g) { guard = g; },
  onCleanup(fn) { cleanups.push(fn); },
};

function render() {
  const hash = location.hash || '#/alta';
  cleanups.forEach((fn) => fn());
  cleanups = [];
  guard = null;

  let matched = null;
  for (const r of routes) {
    const m = r.re.exec(hash);
    if (m) { matched = { r, params: m.slice(1) }; break; }
  }
  if (!matched) {
    history.replaceState(null, '', '#/alta');
    return render();
  }

  currentHash = hash;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === matched.r.nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  matched.r.mount(app, ctx, matched.params);
  hydrateIcons(app);
  window.scrollTo(0, 0);
  app.querySelector('h1')?.focus({ preventScroll: true });
}

window.addEventListener('hashchange', () => {
  const target = location.hash || '#/alta';
  if (guard?.isDirty() && target !== currentHash) {
    history.replaceState(null, '', currentHash); // stay on the form until the user decides
    confirmDiscard(() => {
      guard = null;
      ctx.go(target);
    });
    return;
  }
  render();
});

window.addEventListener('beforeunload', (e) => {
  if (guard?.isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

render();
