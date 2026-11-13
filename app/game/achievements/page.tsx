"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CAT_LABEL,
  CATALOG,
  MAX_LEVEL,
  TIER_LABEL,
  capBoost,
  levelOf,
  loadBadgeData,
  loadUnlocked,
  measure,
  progressOf,
  saveUnlocked,
  trainingBoost,
  xpForLevel,
  xpOf,
  type Cat,
  type Progress,
  type Tier,
} from "@/lib/football/badges";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./achievements.css";

const PAGE = 48;

export default function AchievementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Progress[]>([]);
  const [fresh, setFresh] = useState<Progress[]>([]);
  const [tier, setTier] = useState<Tier | "all">("all");
  const [cat, setCat] = useState<Cat | "all">("all");
  const [show, setShow] = useState<"all" | "open" | "done">("all");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/");
      const { data: contract } = await supabase.from("manager_contracts").select("selected_club").eq("user_id", user.id).maybeSingle();
      const club = contract?.selected_club ?? "";
      const [data, saved] = await Promise.all([loadBadgeData(supabase, user.id, club), loadUnlocked(supabase, user.id)]);
      const list = progressOf(measure(data), saved);
      const added = list.filter((b) => b.done && !saved.has(b.id));
      await saveUnlocked(supabase, user.id, added.map((b) => b.id));
      try {
        localStorage.setItem(`gsm-ach:${user.id}`, JSON.stringify({ done: list.filter((b) => b.done).length, xp: xpOf(list.filter((b) => b.done).map((b) => b.id)) }));
      } catch {
        /* a cache only */
      }
      if (cancelled) return;
      setRows(list);
      setFresh(added.slice(0, 12));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const done = useMemo(() => rows.filter((b) => b.done), [rows]);
  const xp = useMemo(() => xpOf(done.map((b) => b.id)), [done]);
  const level = levelOf(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);

  const visible = useMemo(() => {
    const list = rows.filter((b) => (tier === "all" || b.tier === tier) && (cat === "all" || b.cat === cat) && (show === "all" || (show === "done") === b.done));
    // closest to done first, finished ones last
    return list.sort((a, b) => Number(a.done) - Number(b.done) || b.ratio - a.ratio || a.xp - b.xp);
  }, [rows, tier, cat, show]);

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Counting your medals...</p>
      </main>
    );
  }

  const tiers: (Tier | "all")[] = ["all", "easy", "medium", "hard", "legend"];

  return (
    <main className="ac">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="ac-bg" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="ac-wrap">
        <header className="ac-hero">
          <div className="ac-title">
            <h1>Achievements</h1>
            <p>{done.length} of {CATALOG.length} unlocked</p>
          </div>

          <div className="ac-level" aria-label="Coach level">
            <div className="ac-badge"><small>Coach level</small><b>{level}</b></div>
            <div className="ac-xp">
              <div className="ac-bar"><i style={{ width: level >= MAX_LEVEL ? "100%" : `${((xp - from) / (to - from)) * 100}%` }} /></div>
              <span>{xp} XP {level < MAX_LEVEL && `· ${to - xp} to level ${level + 1}`}</span>
              <em>Training works {Math.round((trainingBoost(level) - 1) * 100)}% better · season cap +{Math.round((capBoost(level) - 1) * 100)}%</em>
            </div>
          </div>
        </header>

        {fresh.length > 0 && (
          <section className="ac-new" role="status" aria-label="New achievements">
            <h2>New! You unlocked {fresh.length} {fresh.length === 1 ? "achievement" : "achievements"}</h2>
            <ul>
              {fresh.map((b) => (
                <li key={b.id} className={`t-${b.tier}`}><span>{b.icon}</span><strong>{b.name}</strong><em>+{b.xp} XP</em></li>
              ))}
            </ul>
            <button type="button" onClick={() => setFresh([])}>Nice!</button>
          </section>
        )}

        <div className="ac-filters">
          <div role="tablist" aria-label="Difficulty">
            {tiers.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tier === t} className={`t-${t}`} onClick={() => { setTier(t); setLimit(PAGE); }}>
                {t === "all" ? "All" : TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="Category">
            {(["all", ...Object.keys(CAT_LABEL)] as (Cat | "all")[]).map((c) => (
              <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => { setCat(c); setLimit(PAGE); }}>
                {c === "all" ? "Everything" : CAT_LABEL[c]}
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="Status">
            {([["all", "All"], ["open", "To do"], ["done", "Unlocked"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={show === id} onClick={() => { setShow(id); setLimit(PAGE); }}>{label}</button>
            ))}
          </div>
        </div>

        <ul className="ac-grid">
          {visible.slice(0, limit).map((b, i) => (
            <li key={b.id} className={`ac-card t-${b.tier} ${b.done ? "is-done" : ""}`} style={{ animationDelay: `${(i % PAGE) * 14}ms` }}>
              <div className="ac-medal" aria-hidden="true"><span>{b.icon}</span>{b.done && <i>✓</i>}</div>
              <div className="ac-text">
                <strong>{b.name}</strong>
                <small>{b.desc}</small>
                <div className="ac-prog" aria-label={`${Math.min(b.value, b.target)} of ${b.target}`}>
                  <i style={{ width: `${b.ratio * 100}%` }} />
                  <span>{b.done ? "Done!" : `${b.value}/${b.target}`}</span>
                </div>
              </div>
              <em className="ac-tag">{TIER_LABEL[b.tier]} · +{b.xp}</em>
            </li>
          ))}
        </ul>
        {visible.length === 0 && <p className="ac-empty">Nothing here yet.</p>}
        {visible.length > limit && (
          <button type="button" className="ac-more" onClick={() => setLimit((l) => l + PAGE)}>Show more ({visible.length - limit} left)</button>
        )}
      </div>
    </main>
  );
}
