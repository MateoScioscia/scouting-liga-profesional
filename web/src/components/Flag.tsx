"use client";

import { useState } from "react";

// FBref guarda la nacionalidad como "ar ARG" (código ISO-3166-1 alpha-2 en
// minúscula + código de 3 letras). Usamos flagcdn.com (gratis, sin API key)
// en vez de emoji de bandera porque los emoji de bandera no renderizan bien
// en todos los sistemas (Windows muestra "AR" en vez del ícono).
export default function Flag({ nationality, size = 18 }: { nationality: string | null | undefined; size?: number }) {
  const [failed, setFailed] = useState(false);
  const code = (nationality ?? "").trim().slice(0, 2).toLowerCase();
  const valid = /^[a-z]{2}$/.test(code);

  if (!valid || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- CDN externo de banderas por código ISO
    <img
      src={`https://flagcdn.com/${size <= 20 ? "h20" : "h40"}/${code}.png`}
      alt={code.toUpperCase()}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-[2px] object-cover"
      style={{ height: size, width: size * 1.33 }}
    />
  );
}
