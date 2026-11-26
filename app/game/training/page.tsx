"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { kitOf } from "@/lib/football/kits";
import { nowMs } from "@/lib/serverTime";
import "./training.css";

type Filter = "ALL" | "YOUNG";

const TYPES: {
  pos: Position;
  title: string;
  short: string;
  tone: string;
}[] = [
  { pos: "GK", title: "Goalkeepers", short: "GK", tone: "gk" },
  { pos: "DF", title: "Defenders", short: "DF", tone: "df" },
  { pos: "MF", title: "Midfielders", short: "MF", tone: "mf" },
  { pos: "FW", title: "Forwards", short: "FW", tone: "fw" },
];

export default function TrainingPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();

  const [level, setLevel] = useState(1);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pos, setPos] = useState<Position>("FW");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<{
    name: string;
    gain: number;
  } | null>(null);

  const uid = ctx?.userId;

  useEffect(() => {
    if (!uid) return;

    let active = true;

    loadUnlocked(supabase, uid).then((ids) => {
      if (active) setLevel(levelOf(xpOf(ids)));
    });

    return () => {
      active = false;
    };
  }, [uid]);

  const boost = trainingBoost(level);
  const cap = (age: number) => seasonCap(age) * capBoost(level);

  const squad: Player[] = ctx?.state.squads[ctx.clubId] ?? [];
  const training = ctx?.state.training ?? [];
  const day = ctx?.matchday ?? null;

  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(nowMs());

    const timer = setInterval(() => {
      setNow(nowMs());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const running = useMemo(() => {
    if (!now) return [];

    return training
      .filter((item) => {
        const end = finishesAt(item);
        return end !== null && end > now;
      })
      .sort(
        (a, b) =>
          (finishesAt(a) ?? 0) - (finishesAt(b) ?? 0)
      );
  }, [now, training]);

  const wasCount = useRef(0);

  useEffect(() => {
    if (running.length < wasCount.current) {
      void reload();
    }

    wasCount.current = running.length;
  }, [running.length, reload]);

  const runKey = running
    .map((item) => `${item.player_id}:${item.created_at}`)
    .join("|");

  useEffect(() => {
    running.forEach((item, index) => {
      const end = finishesAt(item);

      if (end) {
        void alertAt(
          40 + index,
          end,
          "Training finished",
          "A player finished training."
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const byId = useMemo(
    () => new Map(squad.map((player) => [player.id, player])),
    [squad]
  );

  const runningByPosition = useMemo(() => {
    const map: Partial<Record<Position, (typeof running)[number]>> = {};

    running.forEach((item) => {
      const player = byId.get(item.player_id);
      if (player) map[player.position] = item;
    });

    return map;
  }, [running, byId]);

  const seasonGain = useMemo(() => {
    const out: Record<string, number> = {};

    if (!ctx) return out;

    for (const item of training) {
      if (item.season === ctx.season) {
        out[item.player_id] =
          (out[item.player_id] ?? 0) + Number(item.gain);
      }
    }

    return out;
  }, [ctx, training]);

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

  const trainingIds = useMemo(
    () => new Set(running.map((item) => item.player_id)),
    [running]
  );

  const rows = useMemo(() => {
    return squad
      .filter(
        (player) =>
          player.position === pos &&
          (filter === "ALL" || player.age <= 23)
      )
      .sort(
        (a, b) =>
          a.age - b.age || b.rating - a.rating
      );
  }, [squad, filter, pos]);

  const kit = kitOf(ctx?.clubId ?? "")[0];

  function runningFor(position: Position) {
    return runningByPosition[position];
  }

  function playerFor(position: Position) {
    const item = runningFor(position);
    return item ? byId.get(item.player_id) : undefined;
  }

  function clock(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":");
  }

  function previewGain(player: Player) {
    const spent = seasonGain[player.id] ?? 0;
    const remaining = Math.max(0, cap(player.age) - spent);

    return Math.max(
      0,
      Math.min(
        sessionGain(player.age) * boost,
        remaining
      )
    );
  }

  function selectPosition(position: Position) {
    setPos(position);
    setFilter("ALL");
    setProblem("");
    setResult(null);
  }

  async function train(player: Player) {
    if (!ctx || day === null || busyIds.includes(player.id)) return;

    if (trainingIds.has(player.id)) {
      setProblem("This player is already training.");
      return;
    }

    if (runningFor(player.position)) {
      setProblem(
        `The ${player.position} training place is already occupied.`
      );
      return;
    }

    if (running.length >= SLOTS) {
      setProblem("All four training places are currently occupied.");
      return;
    }

    const gain = previewGain(player);

    if (gain <= 0) {
      setProblem(
        "This player has reached his season development limit."
      );
      return;
    }

    setBusyIds((previous) => [...previous, player.id]);
    setProblem("");
    setResult(null);

    try {
      const row = {
        user_id: ctx.userId,
        league_id: ctx.leagueId,
        season: ctx.season,
        matchday: day,
        player_id: player.id,
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
        `${player.name} finished training.`
      );

      setResult({
        name: player.name,
        gain: row.gain,
      });

      await reload();
    } catch (err) {
      console.error("Training error:", err);

      setProblem(
        "The session did not save. Make sure supabase/010_training.sql and 015_training_cooldown.sql have been run."
      );
    } finally {
      setBusyIds((previous) =>
        previous.filter((id) => id !== player.id)
      );
    }
  }

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Loading the training ground..."}</p>
      </main>
    );
  }

  const selectedRunning = runningFor(pos);
  const selectedPlayer = playerFor(pos);

  const chips: [Filter, string][] = [
    ["ALL", "All players"],
    ["YOUNG", "Under 24"],
  ];

  const posIcon = (position: Position) => {
    if (position === "GK") {
      return (
        <path
          d="M8 21v-7l-2-4 2-1 1 2V5l2 0v6l1-7 2 0v7l1-5 2 1-1 7 2 4v8z"
          fill="currentColor"
        />
      );
    }

    if (position === "DF") {
      return (
        <path
          d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"
          fill="currentColor"
        />
      );
    }

    if (position === "MF") {
      return (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7l4 3-1.5 5h-5L8 10z" />
        </g>
      );
    }

    return (
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
  };

  return (
    <main className="tc dxp">
      <DxBar
        title="Training"
        onBack={() => router.push("/game/dashboard")}
        season={seasonLabel(ctx.season)}
      />

      <div className="tc-wrap">
        <header className="tc-heading">
          <div>
            <span className="tc-eyebrow">PLAYER DEVELOPMENT</span>
            <h1>Training Ground</h1>
            <p>
              Choose one player for each position and develop your squad.
            </p>
          </div>

          <div className="tc-duration">
            <span>SESSION DURATION</span>
            <strong>{TRAIN_HOURS} HOURS</strong>
          </div>
        </header>

        <section className="tc-board">
          <div className="tc-section-heading">
            <div>
              <span className="tc-eyebrow">YOUR TRAINING SLOTS</span>
              <h2>Choose a position</h2>
            </div>

            <span className="tc-slot-count">
              {running.length}/{SLOTS} ACTIVE
            </span>
          </div>

          <div className="tc-types">
            {TYPES.map((type) => {
              const active = runningFor(type.pos);
              const player = playerFor(type.pos);
              const end = active ? finishesAt(active) : null;
              const gain = active ? Number(active.gain) : 0;

              const share =
                end && now
                  ? Math.min(
                      1,
                      Math.max(0, 1 - (end - now) / TRAIN_MS)
                    )
                  : 0;

              const selected = pos === type.pos;

              const count = squad.filter(
                (item) => item.position === type.pos
              ).length;

              return (
                <button
                  key={type.pos}
                  type="button"
                  className={`tc-type is-${type.tone} ${
                    selected ? "is-selected" : ""
                  } ${active ? "is-active" : ""}`}
                  onClick={() => selectPosition(type.pos)}
                  style={{ "--kit": kit } as CSSProperties}
                  aria-pressed={selected}
                >
                  <span className="tc-type-top">
                    <span className="tc-position-icon">
                      <svg viewBox="0 0 24 24">
                        {posIcon(type.pos)}
                      </svg>
                    </span>

                    <span className="tc-position-code">
                      {type.short}
                    </span>
                  </span>

                  <span className="tc-type-name">
                    {type.title}
                  </span>

                  {player && active ? (
                    <span className="tc-active-player">
                      <span className="tc-active-face">
                        <PlayerFace player={player} />
                      </span>

                      <span className="tc-active-info">
                        <strong>{player.name}</strong>
                        <small>
                          Rating {player.rating} · +{gain.toFixed(2)}
                        </small>
                      </span>
                    </span>
                  ) : (
                    <span className="tc-empty-slot">
                      <span className="tc-plus">+</span>
                      <span>Choose a player</span>
                    </span>
                  )}

                  {active && end ? (
                    <span className="tc-type-progress">
                      <span className="tc-type-timer">
                        {clock(end - now)}
                      </span>

                      <span className="tc-meter">
                        <i style={{ width: `${share * 100}%` }} />
                      </span>
                    </span>
                  ) : (
                    <span className="tc-type-footer">
                      {count} players available
                      <span>›</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {problem && (
          <div className="tc-message tc-error" role="alert">
            {problem}
          </div>
        )}

        {result && (
          <div className="tc-message tc-success" role="status">
            <strong>{result.name}</strong> started training.
            <span> +{result.gain.toFixed(2)} development</span>
          </div>
        )}

        <section className="tc-picker">
          <div className="tc-picker-heading">
            <div>
              <span className="tc-eyebrow">
                {TYPES.find((type) => type.pos === pos)?.short} SQUAD
              </span>

              <h2>
                {TYPES.find((type) => type.pos === pos)?.title}
              </h2>

              <p>
                {selectedRunning
                  ? "This position is currently occupied."
                  : "Select a player to start his individual training."}
              </p>
            </div>

            <div className="tc-filters">
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
          </div>

          {selectedRunning && selectedPlayer ? (
            <div className="tc-occupied">
              <div className="tc-occupied-face">
                <PlayerFace player={selectedPlayer} />
              </div>

              <div className="tc-occupied-info">
                <span className="tc-live-label">
                  <i />
                  TRAINING IN PROGRESS
                </span>

                <h3>{selectedPlayer.name}</h3>

                <p>
                  {selectedPlayer.position} · Rating {selectedPlayer.rating}
                </p>

                <div className="tc-meter">
                  {(() => {
                    const end = finishesAt(selectedRunning);

                    const share =
                      end && now
                        ? Math.min(
                            1,
                            Math.max(0, 1 - (end - now) / TRAIN_MS)
                          )
                        : 0;

                    return (
                      <i style={{ width: `${share * 100}%` }} />
                    );
                  })()}
                </div>
              </div>

              <div className="tc-occupied-timer">
                <span>TIME LEFT</span>

                <strong>
                  {clock(
                    (finishesAt(selectedRunning) ?? now) - now
                  )}
                </strong>

                <small>
                  +{Number(selectedRunning.gain).toFixed(2)} development
                </small>
              </div>
            </div>
          ) : (
            <ul className="tc-grid">
              {rows.map((player, index) => {
                const trained = trainingIds.has(player.id);
                const busy = busyIds.includes(player.id);

                const currentProgress = progressOf(
                  finished[player.id] ?? 0
                );

                const gain = previewGain(player);

                const projected = Math.min(
                  1 - currentProgress,
                  gain
                );

                const atCap = gain <= 0;
                const playerPhase = phase(player.age);

                return (
                  <li
                    key={player.id}
                    style={{
                      animationDelay: `${Math.min(index, 16) * 25}ms`,
                    }}
                  >
                    <button
                      type="button"
                      className={`tc-card ph-${playerPhase} ${
                        trained ? "is-trained" : ""
                      } ${busy ? "is-busy" : ""}`}
                      onClick={() => void train(player)}
                      disabled={
                        trained ||
                        busy ||
                        !!selectedRunning ||
                        day === null ||
                        atCap
                      }
                    >
                      <span className="tc-card-top">
                        <span className="tc-card-position">
                          {player.position}
                        </span>

                        <span className="tc-card-phase">
                          {playerPhase}
                        </span>
                      </span>

                      <span className="tc-player-visual">
                        <span className="tc-player-photo">
                          <PlayerFace player={player} />
                        </span>

                        <span className="tc-rating">
                          {player.rating}
                          <small>OVR</small>
                        </span>
                      </span>

                      <span className="tc-player-name">
                        {player.name}
                      </span>

                      <span className="tc-player-age">
                        {player.age} YEARS OLD
                      </span>

                      <span className="tc-next-session">
                        <span>NEXT SESSION</span>

                        <strong>
                          {atCap ? "MAX" : `+${gain.toFixed(2)}`}
                        </strong>
                      </span>

                      <span className="tc-development-label">
                        <span>DEVELOPMENT</span>

                        <strong>
                          {Math.round(currentProgress * 100)}%
                          {projected > 0
                            ? ` → ${Math.round(
                                (currentProgress + projected) * 100
                              )}%`
                            : ""}
                        </strong>
                      </span>

                      <span className="tc-prog">
                        <i
                          className="is-done"
                          style={{
                            width: `${currentProgress * 100}%`,
                          }}
                        />

                        <i
                          className="is-preview"
                          style={{
                            width: `${projected * 100}%`,
                          }}
                        />
                      </span>

                      <span className="tc-card-action">
                        {trained
                          ? "Training in progress"
                          : busy
                          ? "Starting..."
                          : atCap
                          ? "Season limit reached"
                          : "Select player  ›"}
                      </span>
                    </button>
                  </li>
                );
              })}

              {rows.length === 0 && (
                <li className="tc-none">
                  No players available in this position.
                </li>
              )}
            </ul>
          )}
        </section>

        <footer className="tc-footer">
          <span>Coach level {level}</span>

          <span>
            Training bonus +{Math.round((boost - 1) * 100)}%
          </span>

          <span>One player per position</span>
        </footer>
      </div>
    </main>
  );
}
