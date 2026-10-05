export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const initials = (nombre, apellido) =>
  `${(nombre ?? '').trim()[0] ?? ''}${(apellido ?? '').trim()[0] ?? ''}`.toUpperCase();
