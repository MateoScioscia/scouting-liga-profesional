"use client";

import { useState } from "react";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function Avatar({
  src,
  name,
  color,
  size = 40,
}: {
  src?: string | null;
  name: string;
  color: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="shrink-0 rounded-full flex items-center justify-center font-semibold border-2"
        style={{ width: size, height: size, borderColor: color, color, fontSize: size * 0.35 }}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fotos externas de Wikipedia, dominio variable
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full object-cover border-2"
      style={{ width: size, height: size, borderColor: color }}
    />
  );
}
