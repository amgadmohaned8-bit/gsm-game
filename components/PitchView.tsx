"use client";

import { useMemo } from "react";
import { pick } from "@/lib/football/commentary";

export type PitchEvent = {
  id: number;
  kind: "goal" | "chance" | "save" | "foul";
  team: "home" | "away";
  stage: "build" | "result";
  pen?: boolean;
  card?: "yellow" | "red";
};

/** the VAR is looking at a goal or a red card */
export type VarCheck = { kind: "goal" | "card"; pen?: boolean };
type Props = { homeColor: string; awayColor: string; ev: PitchEvent | null; seed: string; check?: VarCheck | null };

// 4-3-3, attacking to the right. x 0-105, y 0-68
const HOME: [number, number][] = [[24, 10], [24, 25], [24, 43], [24, 58], [45, 17], [45, 34], [45, 51], [68, 12], [68, 34], [68, 56]];
const mirror = (p: [number, number]): [number, number] => [105 - p[0], p[1]];

export default function PitchView({ homeColor, awayColor, ev, seed, check }: Props) {
  const away = useMemo(() => HOME.map(mirror), []);
  const atk = ev?.team ?? null; // attacking side
  const dir = atk === "home" ? 1 : -1;
  const goalX = atk === "home" ? 105 : 0;
  const res = ev?.stage === "result";
  const key = `${seed}|${ev?.id ?? 0}`;

  // where the shot goes, always the same for the same moment
  const off = pick([-3, -1.6, 1.6, 3], key + "o");
  const missWay = pick(["wide", "over", "post"], key + "m");
  const wide = pick([-1, 1], key + "w");

  let bx = 52.5, by = 34, bs = 1, bo = 1;
  let gkDive = 0;
  if (ev && ev.kind !== "foul") {
    const spotX = atk === "home" ? 94 : 11;
    if (!res) { bx = ev.pen ? spotX : goalX === 105 ? 80 : 25; by = ev.pen ? 34 : 34 + off * 3; }
    else if (ev.kind === "goal") { bx = goalX === 105 ? 104 : 1; by = 34 + off; gkDive = -Math.sign(off) * 4.5; }
    else if (ev.kind === "save") { bx = goalX === 105 ? 99 : 6; by = 34 + off; gkDive = Math.sign(off) * 4.5; }
    else if (missWay === "over") { bx = goalX === 105 ? 104 : 1; by = 34 + off; bs = 2.4; bo = 0; }
    else { bx = goalX === 105 ? (missWay === "post" ? 105 : 109) : missWay === "post" ? 0 : -4; by = missWay === "post" ? 30.3 : 34 + wide * 9; bo = missWay === "post" ? 1 : 0.15; }
  } else if (ev && ev.kind === "foul") {
    bx = atk === "home" ? 76 : 29; by = 40;
  }

  // the shot as the goal sees it: the frame is 100 wide, the posts at 14 and 86, the bar at 8, the grass at 38
  const hi = pick([15, 21, 28], key + "h");
  const shotKind: "goal" | "save" | "over" | "post" | "wide" | null = ev && ev.kind !== "foul" ? (ev.kind === "goal" ? "goal" : ev.kind === "save" ? "save" : (missWay as "over" | "post" | "wide")) : null;
  let tx = 50, ty = 24;
  if (shotKind === "goal") { tx = 50 + off * 9; ty = hi; }
  else if (shotKind === "save") { tx = 50 + off * 7; ty = 24; }
  else if (shotKind === "over") { tx = 50 + off * 8; ty = -6; }
  else if (shotKind === "post") { tx = wide > 0 ? 86 : 14; ty = 22; }
  else if (shotKind === "wide") { tx = wide > 0 ? 97 : 3; ty = 20; }
  const keeperX = shotKind === "save" ? tx : shotKind === "goal" ? 50 - Math.sign(off) * 22 : 50;
  const start = { x: goalX === 105 ? 80 : 25, y: 34 + off * 3 };

  const shift = (side: "home" | "away") => {
    if (!ev) return 0;
    const attacking = side === ev.team;
    return (attacking ? 9 : -3) * (side === "home" ? 1 : -1);
  };

  const label = !ev || !res ? null : ev.kind === "goal" ? (ev.pen ? "PENALTY GOAL!" : "GOAL!") : ev.kind === "save" ? "SAVED!" : ev.kind === "foul" ? "FOUL" : ev.pen ? "PENALTY MISSED" : missWay === "over" ? "OVER THE BAR" : "OFF TARGET";
  const buildLabel = ev && !res ? (ev.kind === "foul" ? "CONTACT…" : ev.pen ? "PENALTY!" : "ATTACK") : null;
  const color = atk === "home" ? homeColor : awayColor;

  return (
    <div className="pv" style={{ "--pc": color } as React.CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 105 68" className="pv-svg" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 10 }).map((_, i) => <rect key={i} x={i * 10.5} y="0" width="10.5" height="68" fill={i % 2 ? "#1f6a3a" : "#237a42"} />)}
        <g fill="none" stroke="rgba(255,255,255,.75)" strokeWidth=".35">
          <rect x=".3" y=".3" width="104.4" height="67.4" />
          <line x1="52.5" y1=".3" x2="52.5" y2="67.7" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x=".3" y="13.85" width="16.5" height="40.3" />
          <rect x="88.2" y="13.85" width="16.5" height="40.3" />
          <rect x=".3" y="24.85" width="5.5" height="18.3" />
          <rect x="99.2" y="24.85" width="5.5" height="18.3" />
        </g>
        <circle cx="52.5" cy="34" r=".6" fill="rgba(255,255,255,.8)" />
        {/* goals */}
        <rect x="-2.2" y="30.3" width="2.5" height="7.4" className={`pv-net ${res && ev?.kind === "goal" && atk === "away" ? "is-on" : ""}`} />
        <rect x="104.7" y="30.3" width="2.5" height="7.4" className={`pv-net ${res && ev?.kind === "goal" && atk === "home" ? "is-on" : ""}`} />

        {/* teams */}
        <g style={{ transform: `translateX(${shift("home")}px)` }} className="pv-team">
          {HOME.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.7" fill={homeColor} className="pv-p" style={{ animationDelay: `${i * -0.37}s` }} />)}
        </g>
        <g style={{ transform: `translateX(${shift("away")}px)` }} className="pv-team">
          {away.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.7" fill={awayColor} className="pv-p" style={{ animationDelay: `${i * -0.29}s` }} />)}
        </g>
        {/* keepers: a different shade so they stand out */}
        <circle cx={5} cy={34} r="1.8" fill={homeColor} className="pv-gk" style={{ transform: `translateY(${atk === "away" ? gkDive : 0}px)` }} />
        <circle cx={100} cy={34} r="1.8" fill={awayColor} className="pv-gk" style={{ transform: `translateY(${atk === "home" ? gkDive : 0}px)` }} />

        {/* foul: the player on the ground and the card */}
        {ev?.kind === "foul" && (
          <g style={{ transform: `translate(${bx}px, ${by - 3}px)` }} className="pv-foul">
            <ellipse cx="0" cy="0" rx="2.6" ry="1.4" fill={color} stroke="#fff" strokeWidth=".4" />
            {res && ev.card && <rect key="card" x="-1.2" y="-9" width="2.4" height="3.4" rx=".3" fill={ev.card === "red" ? "#e11d2e" : "#ffd23f"} stroke="#fff" strokeWidth=".25" className="pv-card" />}
          </g>
        )}

        {/* the line of the shot: gold into the goal, red when it is lost */}
        {res && shotKind && (
          <line key={`t${ev?.id}`} x1={start.x} y1={start.y} x2={bx} y2={by} className={`pv-trail ${shotKind === "goal" ? "is-goal" : shotKind === "save" ? "is-save" : "is-miss"}`} pathLength={1} />
        )}

        {/* the ball */}
        <g key={ev ? `${ev.id}${ev.stage}` : "idle"} className={`pv-ball ${ev ? "" : "is-idle"} ${res ? "is-shot" : ""}`} style={{ transform: `translate(${bx}px, ${by}px) scale(${bs})`, opacity: bo, ["--bc" as string]: color }}>
          <circle r="2.6" className="pv-glow" />
          <circle r="1.15" fill="#fff" stroke="#111" strokeWidth=".3" />
        </g>
      </svg>
      {ev && ev.kind !== "foul" && (
        <div className={`pv-cam ${res && shotKind ? (shotKind === "goal" ? "is-goal" : shotKind === "save" ? "is-save" : "is-miss") : ""}`}>
          <svg viewBox="0 0 100 44">
            <defs><pattern id="pv-mesh" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth=".4" /></pattern></defs>
            <rect x="0" y="0" width="100" height="44" fill="#0c2415" />
            <rect x="14" y="8" width="72" height="30" fill="url(#pv-mesh)" className={res && shotKind === "goal" ? "pv-mesh-hit" : ""} />
            <line x1="0" y1="38" x2="100" y2="38" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
            <circle cx={keeperX} cy="31" r="3.4" fill={atk === "home" ? awayColor : homeColor} stroke="#ffd23f" strokeWidth=".9" style={{ transition: "cx .45s cubic-bezier(.2,.8,.2,1)" }} />
            <path d="M14 38V8H86V38" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            <g key={`${ev.id}${ev.stage}`} className="pv-cam-ball" style={{ transform: res && shotKind ? `translate(${tx}px, ${ty}px) scale(${shotKind === "over" ? 1.4 : 1})` : "translate(50px, 52px) scale(.35)", opacity: res && shotKind === "over" ? 0.2 : 1 }}>
              <circle r="2.6" fill="#fff" stroke="#111" strokeWidth=".5" />
            </g>
          </svg>
        </div>
      )}
      {check && (
        <div className="pv-var" role="status" key={`var${ev?.id ?? 0}`}>
          <i className="pv-var-scan" />
          <b className="pv-var-logo">VAR</b>
          <span className="pv-var-wait">CHECKING<em>.</em><em>.</em><em>.</em></span>
          <span className="pv-var-ok">{check.kind === "goal" ? (check.pen ? "PENALTY CONFIRMED" : "GOAL CONFIRMED") : "RED CARD CONFIRMED"}</span>
        </div>
      )}
      {(label || buildLabel) && (
        <span className={`pv-tag ${label ? "is-result" : ""} ${ev?.kind === "goal" && res ? "is-goal" : ""}`} key={`${ev?.id}${ev?.stage}`} style={{ [dir > 0 ? "right" : "left"]: 10 } as React.CSSProperties}>{label ?? buildLabel}</span>
      )}
    </div>
  );
}
