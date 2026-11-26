"use client";

import { useState } from "react";

/** Codes that differ from the usual two-letter country code on flagcdn. */
const ALIAS: Record<string, string> = { EN: "gb-eng", ENG: "gb-eng", SC: "gb-sct", SCO: "gb-sct", WA: "gb-wls", WAL: "gb-wls", NIR: "gb-nir", XK: "xk" };

export function flagCode(raw?: string | null): string | null {
  if (!raw) return null;
  const c = raw.trim().toUpperCase();
  if (!c) return null;
  if (ALIAS[c]) return ALIAS[c];
  return /^[A-Z]{2}$/.test(c) ? c.toLowerCase() : null;
}

/** A small country flag for a player's nationality. Shows nothing when the code is unknown or the picture cannot load. */
export default function Flag({ code, className = "" }: { code?: string | null; className?: string }) {
  const [bad, setBad] = useState(false);
  const c = flagCode(code);
  if (!c || bad) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      className={`flag ${className}`}
      src={`https://flagcdn.com/w40/${c}.png`}
      srcSet={`https://flagcdn.com/w80/${c}.png 2x`}
      width={20}
      height={15}
      alt=""
      title={code ?? undefined}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setBad(true)}
    />
  );
}
