const svg = (inner, size = 18, extra = '') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${inner}</svg>`;

export const icons = {
  shield: `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false"><path d="M16 2l11 4v9c0 7-5 12-11 15C10 27 5 22 5 15V6l11-4z" fill="#fff"/><path d="M16 7.5l6 2.1V15c0 3.8-2.8 6.6-6 8.5-3.2-1.9-6-4.7-6-8.5V9.6l6-2.1z" fill="#0b2a5b"/><path d="M16 11v7M12.5 14.5h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', 20),
  userCircle: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.2 18.2c1.2-2 3.2-3 5.8-3s4.6 1 5.8 3"/>', 22),
  chevron: svg('<path d="M6 9l6 6 6-6"/>', 14),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>', 18),
  calendarSm: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>', 15),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 18),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 'stroke-width="2.6"'),
  checkCircle: `<svg viewBox="0 0 24 24" width="46" height="46" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="12" fill="#1e9e5a"/><path d="M6.5 12.5l3.8 3.8 7.2-7.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warn: svg('<path d="M12 3.5l10 17.5H2L12 3.5z"/><path d="M12 10v5M12 18h.01"/>', 24),
  save: svg('<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>', 18),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', 18),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  avatar: `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="32" fill="#dfe5ee"/><circle cx="32" cy="25" r="10" fill="#9aa8bf"/><path d="M12 54c2-10 10-15 20-15s18 5 20 15a32 32 0 0 1-40 0z" fill="#9aa8bf"/></svg>`,
};
