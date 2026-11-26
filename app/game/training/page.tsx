
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  levelOf,
  loadUnlocked,
  xpOf,
  trainingBoost,
  capBoost,
} from "@/lib/football/badges";
import {
  finishesAt,
  gainsAt,
  phase,
  progressOf,
  seasonCap,
  sessionGain,
  SLOTS,
  TRAIN_HOURS,
  TRAIN_MS,
} from "@/lib/football/development";
import { alertAt } from "@/lib/notify";
import { useTransfers } from "@/lib/football/useTransfers";
import type { Player, Position } from "@/lib/football/squads";
import GsmMark from "@/components/GsmMark";
import DxBar from "@/components/DxBar";
import { seasonLabel } from "@/lib/football/season";
import PlayerFace from "@/components/PlayerFace";
import "./training.css";

import { nowMs } from "@/lib/serverTime";

type Filter = "ALL" | "YOUNG";

export default function TrainingPage() {
  const router = useRouter();

  const { ctx, loading, error, reload } = useTransfers();

  const [level, setLevel] = useState(1);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sel, setSel] = useState<Position | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<{
    name: string;
    gain: number;
  } | null>(null);

  const uid = ctx?.userId;

  useEffect(() => {
    if (uid) {
      loadUnlocked(supabase, uid).then((ids) =>
        setLevel(levelOf(xpOf(ids)))
      );
    }
  }, [uid]);

  const boost = trainingBoost(level);

  const cap = (age: number) =>
    seasonCap(age) * capBoost(level);

  const squad: Player[] =
    ctx?.state.squads[ctx.clubId] ?? [];

  const training = ctx?.state.training ?? [];

  const day = ctx?.matchday ?? null;

  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(nowMs());

    const t = setInterval(() => setNow(nowMs()), 1000);

    return () => clearInterval(t);
  }, []);

  /** the session in progress: its players and when it ends */
  const doneToday = useMemo(
    () =>
      now
        ? training.filter((t) => {
            const end = finishesAt(t);
            return end !== null && end > now;
          })
        : [],
    [now, training]
  );

  const running = useMemo(
    () =>
      doneToday
        .slice()
        .sort(
          (a, b) =>
            (finishesAt(a) ?? 0) -
            (finishesAt(b) ?? 0)
        ),
    [doneToday]
  );

  const wasCount = useRef(0);

  useEffect(() => {
    // someone just finished while the page is open
    if (running.length < wasCount.current) {
      void reload();
    }

    wasCount.current = running.length;
  }, [running.length, reload]);

  const runKey = running
    .map((t) => `${t.player_id}:${t.created_at}`)
    .join("|");

  useEffect(() => {
    running.forEach((t, i) => {
      const end = finishesAt(t);

      if (end) {
        void alertAt(
          40 + i,
          end,
          "Training finished",
          "A player finished training. Start the next one."
        );
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const seasonGain = useMemo(() => {
    const out: Record<string, number> = {};

    if (!ctx) return out;

    for (const t of training) {
      if (t.season === ctx.season) {
        out[t.player_id] =
          (out[t.player_id] ?? 0) + Number(t.gain);
      }
    }

    return out;
  }, [ctx, training]);

  /** finished training per player and what the running session will add */
  const finished = useMemo(
    () =>
      ctx
        ? gainsAt(
            training,
            ctx.season,
            ctx.matchday ?? 99,
            squad
          )
        : {},
    [ctx, training, squad]
  );

  const pendingGain = useMemo(() => {
    const out: Record<string, number> = {};

    doneToday.forEach((t) => {
      out[t.player_id] =
        (out[t.player_id] ?? 0) + Number(t.gain);
    });

    return out;
  }, [doneToday]);

  const rows = useMemo(() => {
    const list = squad.filter(
      (p) =>
        p.position === sel &&
        (filter === "ALL" || p.age <= 23)
    );

    return list
      .slice()
      .sort(
        (a, b) =>
          a.age - b.age || b.rating - a.rating
      );
  }, [squad, filter, sel]);

  useEffect(() => {
    if (!result) return;

    const t = setTimeout(() => setResult(null), 5000);

    return () => clearTimeout(t);
  }, [result]);

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Loading the training ground..."}</p>
      </main>
    );
  }

  const byId = new Map(
    squad.map((p) => [p.id, p])
  );

  const posOf = (id: string) =>
    byId.get(id)?.position;

  const runningBy = (k: Position) =>
    running.filter(
      (t) => posOf(t.player_id) === k
    ).length;

  const trainingIds = new Set(
    running.map((t) => t.player_id)
  );

  /** four sessions at a time, and every position keeps a place */
  function slotProblem(k: Position): string {
    if (day === null) {
      return "The season is over.";
    }

    if (runningBy(k) > 0) {
      return "This place is busy. Wait for the player to finish.";
    }

    const others = (
      ["GK", "DF", "MF", "FW"] as Position[]
    ).filter(
      (x) => x !== k && runningBy(x) === 0
    ).length;

    const reserved =
      runningBy(k) === 0 ? 0 : others;

    if (running.length + reserved >= SLOTS) {
      return running.length >= SLOTS
        ? "All four training places are busy. Wait for a player to finish."
        : "Keep a place free for the other positions: train a goalkeeper, defender, midfielder and forward first.";
    }

    return "";
  }

  /** one tap starts that player's own countdown */
  async function train(p: Player) {
    if (
      !ctx ||
      day === null ||
      busy ||
      trainingIds.has(p.id)
    ) {
      return;
    }

    const why = slotProblem(p.position);

    if (why) {
      setProblem(why);
      setSel(null);
      return;
    }

    setBusy(true);
    setProblem("");

    try {
      const spent = seasonGain[p.id] ?? 0;

      const gain = Math.max(
        0,
        Math.min(
          sessionGain(p.age) * boost,
          cap(p.age) - spent
        )
      );

      const row = {
        user_id: ctx.userId,
        league_id: ctx.leagueId,
        season: ctx.season,
        matchday: day,
        player_id: p.id,
        gain: Math.round(gain * 100) / 100,
      };

      const { error: insertError } = await supabase
        .from("training_sessions")
        .insert(row);

      if (insertError) throw insertError;

      void alertAt(
        40 + running.length,
        nowMs() + TRAIN_MS,
        "Training finished",
        `${p.name} finished training.`
      );

      setResult({
        name: p.name,
        gain: row.gain,
      });

      setSel(null);

      await reload();
    } catch (err) {
      console.error("Training error:", err);

      setProblem(
        "The session did not save. Make sure supabase/010_training.sql and 015_training_cooldown.sql have been run."
      );
    } finally {
      setBusy(false);
    }
  }

  // Countdown helpers (single definitions)
  function left(ms: number) {
    const m = Math.max(
      0,
      Math.ceil(ms / 60000)
    );

    return m >= 60
      ? `${Math.floor(m / 60)}h ${m % 60}m left`
      : `${m}m left`;
  }

  function clock(ms: number) {
    const t = Math.max(
      0,
      Math.floor(ms / 1000)
    );

    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = t % 60;

    return `${String(h).padStart(2, "0")}:${String(
      m
    ).padStart(2, "0")}:${String(sec).padStart(
      2,
      "0"
    )}`;
  }

  const posIcon = (k: Position) =>
    k === "GK" ? (
      <path
        d="M8 21v-7l-2-4 2-1 1 2V5l2 0v6l1-7 2 0v7l1-5 2 1-1 7 2 4v8z"
        fill="currentColor"
      />
    ) : k === "DF" ? (
      <path
        d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"
        fill="currentColor"
      />
    ) : k === "MF" ? (
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7l4 3-1.5 5h-5L8 10z" />
      </g>
    ) : (
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v5M12 18v5M1 12h5M18 12h5" />
      </g>
    );

  const TYPES: {
    pos: Position;
    title: string;
    tone: string;
  }[] = [
    { pos: "GK", title: "Goalkeeper", tone: "gk" },
    { pos: "DF", title: "Defenders", tone: "df" },
    { pos: "MF", title: "Midfielders", tone: "mf" },
    { pos: "FW", title: "Forwards", tone: "fw" },
  ];

  const chips: [Filter, string][] = [
    ["ALL", "All ages"],
    ["YOUNG", "23 and under"],
  ];

  const open = TYPES.find((t) => t.pos === sel);

  return (
    <main className="tc dxp">
      <DxBar
        title="Training"
        onBack={() => router.push("/game/dashboard")}
        season={
          ctx.season
            ? seasonLabel(ctx.season)
            : undefined
        }
      />

      <div className="tc-wrap">
        <p className="tc-hint">
          Tap a place and choose a player. His{" "}
          {TRAIN_HOURS} hour countdown starts at once.
          Coach level {level}: +
          {Math.round((boost - 1) * 100)}%.
        </p>

        {problem && (
          <p
            className="tc-problem"
            role="alert"
            onClick={() => setProblem("")}
          >
            {problem}
          </p>
        )}

        {result && (
          <p className="tc-result" role="status">
            {result.name} started training (+
            {result.gain.toFixed(2)}).
          </p>
        )}

        <section
          className="tc-places"
          aria-label="Training places"
        >
          {TYPES.map((t) => {
            const run = running.find(
              (r) => posOf(r.player_id) === t.pos
            );

            const p = run
              ? byId.get(run.player_id)
              : undefined;

            const end = run
              ? finishesAt(run)
              : null;

            const share =
              end && now
                ? Math.min(
                    1,
                    Math.max(
                      0,
                      1 - (end - now) / TRAIN_MS
                    )
                  )
                : 0;

            const n = squad.filter(
              (x) => x.position === t.pos
            ).length;

            const prog = p
              ? progressOf(finished[p.id] ?? 0)
              : 0;

            const wait = p
              ? Math.min(
                  1 - prog,
                  pendingGain[p.id] ?? 0
                )
              : 0;

            return (
              <button
                key={t.pos}
                type="button"
                className={`tc-place is-${t.tone} ${
                  p ? "is-run" : ""
                }`}
                disabled={!!p || day === null}
                onClick={() => {
                  setProblem("");
                  setFilter("ALL");
                  setSel(t.pos);
                }}
                aria-label={
                  p
                    ? `${t.title}: ${p.name} is training`
                    : `Choose a ${t.title}`
                }
              >
                <span className="tc-ptitle">
                  {t.title}
                  <em>{n}</em>
                </span>

                {p ? (
                  <>
                    <span className="tc-photo">
                      <span
                        className="tc-sil"
                        aria-hidden="true"
                      />

                      <PlayerFace player={p} />

                      <b>{p.rating}</b>
                    </span>

                    <strong className="tc-pname">
                      {p.name}
                    </strong>

                    <span
                      className="tc-count"
                      role="timer"
                    >
                      {end
                        ? clock(end - now)
                        : clock(TRAIN_MS)}
                    </span>

                    <span className="tc-meter">
                      <i
                        style={{
                          width: `${share * 100}%`,
                        }}
                      />
                    </span>

                    <span
                      className="tc-prog"
                      aria-hidden="true"
                    >
                      <em
                        className="is-done"
                        style={{
                          width: `${prog * 100}%`,
                        }}
                      />

                      <em
                        className="is-wait"
                        style={{
                          width: `${wait * 100}%`,
                        }}
                      />
                    </span>

                    <small>
                      {Math.round(prog * 100)}% →{" "}
                      {Math.round(
                        (prog + wait) * 100
                      )}
                      % to {p.rating + 1}
                    </small>
                  </>
                ) : (
                  <span className="tc-empty">
                    <svg
                      width="44"
                      height="44"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      {posIcon(t.pos)}
                    </svg>

                    <b>Choose player</b>
                  </span>
                )}
              </button>
            );
          })}
        </section>
      </div>

      {open && (
        <div
          className="tc-sheet-bg"
          onClick={() => setSel(null)}
        >
          <section
            className="tc-sheet"
            role="dialog"
            aria-label={`Choose ${open.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>{open.title}</h2>

              <div
                className="tc-filters"
                role="group"
                aria-label="Filter by age"
              >
                {chips.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="tc-x"
                onClick={() => setSel(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <ul className="tc-list">
              {rows.map((p) => {
                const spent = seasonGain[p.id] ?? 0;

                const atCap =
                  spent >= cap(p.age) - 0.005;

                const prog = progressOf(
                  finished[p.id] ?? 0
                );

                const add = atCap
                  ? 0
                  : Math.max(
                      0,
                      Math.min(
                        sessionGain(p.age) * boost,
                        cap(p.age) - spent
                      )
                    );

                const done = Math.min(
                  1 - prog,
                  add
                );

                const full =
                  prog + add >= 0.995;

                const ph = phase(p.age);

                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`tc-row ph-${ph}`}
                      onClick={() => void train(p)}
                      disabled={busy || atCap}
                    >
                      <b>{p.rating}</b>

                      <span className="tc-who">
                        <strong>{p.name}</strong>

                        <small>
                          {p.age} yrs ·{" "}
                          {ph === "rising"
                            ? "Rising"
                            : ph === "prime"
                              ? "Prime"
                              : "Declining"}
                        </small>

                        <span
                          className="tc-prog"
                          aria-hidden="true"
                        >
                          <em
                            className="is-done"
                            style={{
                              width: `${prog * 100}%`,
                            }}
                          />

                          <em
                            className="is-wait"
                            style={{
                              width: `${done * 100}%`,
                            }}
                          />
                        </span>
                      </span>

                      <span className="tc-end">
                        {atCap
                          ? "Season limit"
                          : full
                            ? "+1 rating"
                            : `${Math.round(
                                prog * 100
                              )}→${Math.round(
                                (prog + add) * 100
                              )}%`}
                      </span>
                    </button>
                  </li>
                );
              })}

              {rows.length === 0 && (
                <li className="tc-none">
                  No players here
                  {filter === "YOUNG"
                    ? " aged 23 or under"
                    : ""}
                  .
                </li>
              )}
            </ul>

            <p className="tc-legend">
              <i className="d" /> his progress now{" "}
              <i className="l" /> what this session adds
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
