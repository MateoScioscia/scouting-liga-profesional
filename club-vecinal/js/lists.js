// Destination screens for the buttons of the design: member list, member file, activities, reports.
import { esc, initials } from './util.js';
import { icons } from './icons.js';
import {
  CATEGORIES, categoryByKey, fromISODate, formatDMY, ageOn, startOfDay, certStatus, CERT_ALERT_DAYS,
} from './rules.js';
import {
  activeSocios, getSocio, bajaSocio, ACTIVITIES, findHorario, horariosOf, activitySummary, altasPorMes, resetDemo,
} from './store.js';

const fmt = (iso) => (iso ? formatDMY(fromISODate(iso)) : '—');
const fullName = (s) => `${s.apellido}, ${s.nombre}`;
const catLabel = (key) => categoryByKey(key)?.label ?? key;

const CERT_LABEL = {
  vigente: (d) => `Vigente (${d} días)`,
  por_vencer: (d) => `Vence en ${d} día${d === 1 ? '' : 's'}`,
  vencido: (d) => `Vencido hace ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'}`,
};

function certBadge(iso, today = startOfDay()) {
  const st = certStatus(fromISODate(iso), today);
  return `<span class="pill pill-${st.key}">${esc(CERT_LABEL[st.key](st.days))}</span>`;
}

// ---------- Socios ----------

export function mountSocios(root, ctx) {
  const all = activeSocios().sort((a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  const PAGE = 25;

  root.innerHTML = `
    <section class="card">
      <div class="page-head">
        <h1 class="page-title" tabindex="-1">Socios</h1>
        <div class="head-actions">
          <button type="button" class="btn btn-gray" id="btn-reset">Restablecer datos de ejemplo</button>
          <a class="btn btn-primary" href="#/alta">+ Nuevo socio</a>
        </div>
      </div>
      ${all.length === 0 ? `
        <div class="empty"><p>Todavía no hay socios registrados.</p><a class="btn btn-primary" href="#/alta">Dar de alta el primer socio</a></div>
      ` : `
        <div class="toolbar"><label class="sr-only" for="q">Buscar socio</label>
          <input id="q" type="search" placeholder="Buscar por apellido, nombre o DNI" autocomplete="off"></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>N°</th><th>Socio</th><th>DNI</th><th>Categoría</th><th>Actividad</th><th>Certificado médico</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
        <p class="empty-q" id="no-results" hidden>No se encontraron socios con ese criterio.</p>
        <div class="more"><span class="hint" id="count" aria-live="polite"></span><button type="button" class="btn btn-outline" id="btn-more" hidden>Ver más</button></div>`}
    </section>`;

  root.querySelector('#btn-reset').addEventListener('click', () => {
    ctx.openDialog({
      tone: 'warn',
      icon: icons.warn,
      title: '¿Restablecer los datos de ejemplo?',
      body: '<p>Se borrarán los socios actuales y se volverán a cargar los socios ficticios de demostración.</p>',
      actions: [
        { label: 'Cancelar', cls: 'btn-outline' },
        { label: 'Restablecer', cls: 'btn-danger', onClick: () => { resetDemo(); ctx.go('#/socios'); } },
      ],
    });
  });

  if (all.length === 0) return;
  const rows = root.querySelector('#rows');
  const today = startOfDay();
  let list = all;
  let shown = PAGE;

  const render = () => {
    rows.innerHTML = list.slice(0, shown).map((s) => {
      const h = findHorario(s.horarioId);
      return `<tr>
        <td data-label="N°">${esc(s.id)}</td>
        <td data-label="Socio"><a href="#/socios/${esc(s.id)}">${esc(fullName(s))}</a></td>
        <td data-label="DNI">${esc(s.dni)}</td>
        <td data-label="Categoría">${esc(catLabel(s.categoria))}</td>
        <td data-label="Actividad">${esc(h ? `${h.actividad} · ${h.label}` : '—')}</td>
        <td data-label="Certificado">${certBadge(s.certVenc, today)}</td></tr>`;
    }).join('');
    root.querySelector('#no-results').hidden = list.length > 0;
    root.querySelector('#count').textContent = list.length
      ? `Mostrando ${Math.min(shown, list.length)} de ${list.length} socios`
      : '';
    root.querySelector('#btn-more').hidden = shown >= list.length;
  };
  render();

  root.querySelector('#q').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    list = all.filter((s) => `${s.apellido} ${s.nombre} ${s.dni}`.toLowerCase().includes(q));
    shown = PAGE;
    render();
  });
  root.querySelector('#btn-more').addEventListener('click', () => { shown += PAGE; render(); });
}

// ---------- Ficha ----------

export function mountFicha(root, ctx, [id]) {
  const s = getSocio(id);
  if (!s || s.estado !== 'activo') {
    root.innerHTML = `<section class="card"><h1 class="page-title" tabindex="-1">Socio no encontrado</h1><p>No existe un socio activo con el código ${esc(id)}.</p><a class="btn btn-primary" href="#/socios">Volver al listado</a></section>`;
    return;
  }
  const today = startOfDay();
  const birth = fromISODate(s.fechaNac);
  const h = findHorario(s.horarioId);
  const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;

  root.innerHTML = `
    <section class="card">
      <div class="ficha-head">
        <div class="ficha-avatar">${s.foto ? `<img src="${s.foto}" alt="Foto de ${esc(s.nombre)} ${esc(s.apellido)}">` : `<span>${esc(initials(s.nombre, s.apellido))}</span>`}</div>
        <div>
          <h1 class="page-title" tabindex="-1">${esc(s.nombre)} ${esc(s.apellido)}</h1>
          <p class="muted">Socio ${esc(s.id)} · <span class="pill pill-cat">${esc(catLabel(s.categoria))}</span> · Alta ${fmt(s.altaAt)}</p>
        </div>
      </div>

      <div class="ficha-grid">
        <section class="sec"><header class="sec-head"><h2>Datos personales</h2></header>
          <dl class="kv">${row('DNI', esc(s.dni))}${row('Fecha de nacimiento', `${fmt(s.fechaNac)} (${ageOn(birth, today)} años)`)}${row('Teléfono', esc(s.telefono))}${row('Email', s.email ? esc(s.email) : '—')}</dl></section>
        ${s.tutor ? `<section class="sec"><header class="sec-head"><h2>Tutor / adulto responsable</h2></header>
          <dl class="kv">${row('Nombre', `${esc(s.tutor.nombre)} ${esc(s.tutor.apellido)}`)}${row('Vínculo', esc(s.tutor.vinculo))}${row('DNI', esc(s.tutor.dni))}${row('Email', esc(s.tutor.email))}${row('Teléfono', esc(s.tutor.telefono))}</dl></section>` : ''}
        <section class="sec"><header class="sec-head"><h2>Actividad e inscripción</h2></header>
          <dl class="kv">${row('Actividad', esc(h?.actividad ?? '—'))}${row('Horario', esc(h?.label ?? '—'))}</dl></section>
        <section class="sec"><header class="sec-head"><h2>Certificado médico</h2></header>
          <dl class="kv">${row('Emisión', fmt(s.certEmision))}${row('Vencimiento', fmt(s.certVenc))}${row('Estado', certBadge(s.certVenc, today))}</dl></section>
      </div>

      <div class="actions actions-split">
        <button type="button" class="btn btn-danger-outline" id="btn-baja">Dar de baja</button>
        <a class="btn btn-gray" href="#/socios">Volver al listado</a>
      </div>
    </section>`;

  root.querySelector('#btn-baja').addEventListener('click', () => {
    ctx.openDialog({
      tone: 'warn',
      icon: icons.warn,
      title: '¿Dar de baja al socio?',
      body: `<p>${esc(s.nombre)} ${esc(s.apellido)} dejará de figurar como socio activo y se liberará su lugar en la actividad.</p>`,
      actions: [
        { label: 'Cancelar', cls: 'btn-outline' },
        { label: 'Dar de baja', cls: 'btn-danger', onClick: () => { bajaSocio(s.id); ctx.go('#/socios'); } },
      ],
    });
  });
}

// ---------- Actividades ----------

export function mountActividades(root) {
  root.innerHTML = `
    <section class="card">
      <h1 class="page-title" tabindex="-1">Actividades</h1>
      <div class="act-grid">${ACTIVITIES.map((a) => `
        <article class="sec"><header class="sec-head"><h2>${esc(a.nombre)}</h2></header>
          <ul class="act-list">${horariosOf(a.id).map((h) => {
            const pct = Math.min(100, Math.round((h.ocupados / h.cupo) * 100));
            return `<li><div class="act-row"><span>${esc(h.label)}</span>${h.completo ? '<span class="badge-full">Completo</span>' : `<span class="muted">Cupo: ${h.ocupados}/${h.cupo}</span>`}</div>
              <div class="bar" role="img" aria-label="${pct}% ocupado"><span style="width:${pct}%" class="${h.completo ? 'full' : ''}"></span></div></li>`;
          }).join('')}</ul></article>`).join('')}
      </div>
    </section>`;
}

// ---------- Reportes ----------

export function mountReportes(root) {
  const socios = activeSocios();
  const today = startOfDay();
  const withStatus = socios.map((s) => ({ s, st: certStatus(fromISODate(s.certVenc), today) }));
  const alerts = withStatus
    .filter((x) => x.st.key !== 'vigente')
    .sort((a, b) => a.st.days - b.st.days);

  const acts = activitySummary();
  const totalOcupados = acts.reduce((n, a) => n + a.ocupados, 0);
  const totalCupo = acts.reduce((n, a) => n + a.cupo, 0);
  const ocupacionGeneral = totalCupo ? Math.round((totalOcupados / totalCupo) * 100) : 0;
  const completos = acts.reduce((n, a) => n + a.completos, 0);
  const totalHorarios = acts.reduce((n, a) => n + a.horarios, 0);

  const { months, rows: altas } = altasPorMes(today);
  const top = [...altas].sort((a, b) => b.total - a.total)[0];
  const sociosPorActividad = (id) => socios.filter((s) => s.actividadId === id).length;

  root.innerHTML = `
    <section class="card">
      <h1 class="page-title" tabindex="-1">Reportes</h1>
      <p class="note">Datos de demostración: la aplicación incluye socios ficticios y todas las cifras se calculan a partir de ellos; los socios que se den de alta se suman automáticamente.</p>
      <div class="stats">
        <div class="stat"><b>${socios.length}</b><span>Socios activos</span></div>
        <div class="stat"><b>${ocupacionGeneral}%</b><span>Ocupación general (${totalOcupados}/${totalCupo} lugares)</span></div>
        <div class="stat"><b>${completos}/${totalHorarios}</b><span>Horarios completos</span></div>
        <div class="stat"><b>${withStatus.filter((x) => x.st.key === 'por_vencer').length}</b><span>Certificados por vencer (${CERT_ALERT_DAYS} días)</span></div>
        <div class="stat"><b>${withStatus.filter((x) => x.st.key === 'vencido').length}</b><span>Certificados vencidos</span></div>
      </div>

      <section class="sec"><header class="sec-head"><h2>Ocupación por actividad</h2></header>
        <ul class="act-list">${acts.map((a) => `
          <li><div class="act-row"><span><strong>${esc(a.nombre)}</strong> <span class="muted">· ${a.completos}/${a.horarios} horarios completos · ${sociosPorActividad(a.id)} socios</span></span><span class="muted">${a.ocupados}/${a.cupo} (${a.pct}%)</span></div>
            <div class="bar" role="img" aria-label="${esc(a.nombre)}: ${a.pct}% ocupado"><span style="width:${Math.min(100, a.pct)}%" class="${a.pct >= 90 ? 'full' : ''}"></span></div></li>`).join('')}
        </ul></section>

      <section class="sec"><header class="sec-head"><h2>Altas por actividad <span class="lbl-note">(últimos 6 meses)</span></h2></header>
        <div class="tbl-wrap"><table class="tbl tbl-num">
          <thead><tr><th>Actividad</th>${months.map((m) => `<th>${esc(m.label)}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>${altas.map((r) => `<tr><td data-label="Actividad"><strong>${esc(r.nombre)}</strong></td>${r.values.map((v, i) => `<td data-label="${esc(months[i].label)}">${v}</td>`).join('')}<td data-label="Total"><strong>${r.total}</strong></td></tr>`).join('')}</tbody>
        </table></div>
        <p class="hint pad">Actividad más demandada: <strong>${esc(top.nombre)}</strong> (${top.total} altas en 6 meses).</p></section>

      <div class="ficha-grid">
        <section class="sec"><header class="sec-head"><h2>Socios por categoría</h2></header>
          <dl class="kv">${CATEGORIES.map((c) => `<div><dt>${esc(c.label)} (${c.min} a ${c.max} años)</dt><dd>${socios.filter((s) => s.categoria === c.key).length}</dd></div>`).join('')}</dl></section>
        <section class="sec"><header class="sec-head"><h2>Alertas de certificado médico</h2></header>
          ${alerts.length === 0 ? '<p class="muted pad">No hay certificados por vencer ni vencidos.</p>' : `<ul class="alert-list">${alerts.map(({ s, st }) => `
            <li><a href="#/socios/${esc(s.id)}">${esc(fullName(s))}</a><span>${fmt(s.certVenc)} · ${certBadge(s.certVenc, today)}</span></li>`).join('')}</ul>`}</section>
      </div>
    </section>`;
}
