// FBref guarda la nacionalidad como "ar ARG" (código ISO-3166-1 alpha-2 en
// minúscula + código de 3 letras) -- convertimos las primeras 2 letras a un
// emoji de bandera via Regional Indicator Symbols, sin depender de datos
// externos.
export function flagEmoji(nationality: string | null | undefined): string | null {
  if (!nationality) return null;
  const code = nationality.trim().slice(0, 2).toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return null;
  const base = 0x1f1e6;
  const a = "a".charCodeAt(0);
  return String.fromCodePoint(base + (code.charCodeAt(0) - a), base + (code.charCodeAt(1) - a));
}
