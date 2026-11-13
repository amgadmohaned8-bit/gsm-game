"use client";

import { useEffect, useMemo, useState } from "react";
import { leagueOf } from "@/lib/football/leaguesCatalog";
import "./compbackdrop.css";

/**
 * Each competition has its own world behind its dashboard: colours, the
 * competition badge as a huge watermark, light rays and floating dust.
 * The first time it opens in a session, a short intro shows the badge.
 */
const MOTIF: Record<string, "stars" | "pyramids" | "stripes" | "lights"> = {
  "caf-champions-league": "stars",
  "caf-confederation-cup": "stripes",
  "egyptian-premier-league": "pyramids",
  "premier-league": "lights",
};

const WELCOME: Record<string, string> = {
  "caf-champions-league": "The road to the star",
  "caf-confederation-cup": "Africa's second stage",
  "egyptian-premier-league": "Cairo derbies. Title races.",
  "premier-league": "No easy weekends",
};

export default function CompBackdrop({ comp, intro = true }: { comp: string | null | undefined; intro?: boolean }) {
  const id = comp || "premier-league";
  const l = leagueOf(id);
  const motif = MOTIF[id] ?? "lights";
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (!intro || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const k = `gsm-intro-${id}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* show it every time */ }
    setShowIntro(true);
    const t = setTimeout(() => setShowIntro(false), 2800);
    return () => clearTimeout(t);
  }, [id, intro]);

  const dust = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: (i * 37 + 11) % 100, d: 7 + ((i * 5) % 9), s: 2 + (i % 4), delay: -((i * 1.3) % 10) })), []);

  return (
    <>
      <div className={`cb cb-${motif}`} style={{ "--c1": l.color, "--c2": l.color2 } as React.CSSProperties} aria-hidden="true">
        <div className="cb-aura" />
        <div className="cb-rays" />
        {l.logo && <img className="cb-mark" src={l.logo} alt="" />}
        {motif === "pyramids" && (
          <svg className="cb-pyr" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice">
            <polygon points="120,260 330,60 540,260" />
            <polygon points="420,260 680,10 940,260" />
            <polygon points="800,260 950,120 1100,260" />
          </svg>
        )}
        <div className="cb-dust">{dust.map((p, i) => <i key={i} style={{ left: `${p.x}%`, width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }} />)}</div>
      </div>
      {showIntro && (
        <div className="cb-intro" style={{ "--c1": l.color, "--c2": l.color2 } as React.CSSProperties} role="presentation">
          <div className="cb-intro-rays" />
          {l.logo && <img src={l.logo} alt="" />}
          <small>Welcome to</small>
          <h2>{l.name}</h2>
          <p>{WELCOME[id] ?? ""}</p>
        </div>
      )}
    </>
  );
}
