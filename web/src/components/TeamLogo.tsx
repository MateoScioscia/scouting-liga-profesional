"use client";

import { useState } from "react";

export default function TeamLogo({ src, name, size = 20 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- escudos externos de Wikipedia, dominio variable
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
