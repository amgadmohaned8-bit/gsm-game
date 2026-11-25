
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
import { nowMs } from "@/lib/serverTime";
import "./training.css";

type Filter = "ALL" | "YOUNG";

const POSITIONS: {
  pos: Position;
  title: string;
  short: string;
}[] = [
  { pos: "GK", title: "Goalkeepers", short: "GK" },
  { pos: "DF", title: "Defenders", short: "DF" },
  { pos: "MF", title: "Midfielders", short: "MF" },
  { pos: "FW", title: "Forwards", short: "FW" },
];

export default function TrainingPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();

  const [level, setLevel] = useState(1);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pos, setPos] = useState<Position>("FW");

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<{
    name: string;
    gain: number;
  } | null>(null);

  // The player must be confirmed before a session is created.
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const uid = ctx?.userId;

  useEffect(() => {
    if (!uid) return;

    loadUnlocked(supabase, uid).then((ids) => {
      setLevel(levelOf(xpOf(ids)));
    });
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

  // Sessions which are still running.
  const running = useMemo(() => {
    if (!now) return [];

    return training
      .filter((session) => {
        const end = finishesAt(session);
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
    .map((session) => `${session.player_id}:${session.created_at}`)
    .join("|");

  useEffect(() => {
    running.forEach((session, index) => {
      const end = finishesAt(session);

      if (end) {
        void alertAt(
          40 + index,
          end,
          "Training finished",
          "A player finished training. Start the next one."
        );
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const byId = useMemo(
    () => new Map(squad.map((player) => [player.id, player])),
    [squad]
  );

  const trainingIds = useMemo(
    () => new Set(running.map((session) => session.player_id)),
    [running]
  );

  const seasonGain = useMemo(() => {
    const out: Record<string, number> = {};

    if (!ctx) return out;

    for (const session of training) {
      if (session.season === ctx.season) {
        out[session.player_id] =
          (out[session.player_id] ?? 0) + Number(session.gain);
      }
    }

    return out;
  }, [ctx, training]);

  // Completed progress toward the next rating.
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

  // The gain that is currently being processed.
  const pendingGain = useMemo(() => {
    const out: Record<string, number> = {};

    running.forEach((session) => {
      out[session.player_id] =
        (out[session.player_id] ?? 0) + Number(session.gain);
    });

    return out;
  }, [running]);

  const rows = useMemo(() => {
    return squad
      .filter(
        (player) =>
          player.position === pos &&
          (filter === "ALL" || player.age <= 23)
      )
      .slice()
      .sort(
        (a, b) =>
          a.age - b.age || b.rating - a.rating
      );
  }, [squad, filter, pos]);

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Loading the training ground..."}</p>
      </main>
    );
  }

  const positionOf = (id: string) => byId.get(id)?.position;

  const runningBy = (position: Position) =>
    running.filter(
      (session) =>
        positionOf(session.player_id) === position
    ).length;

  function slotProblem(position: Position): string {
    if (day === null) {
      return "The season is over.";
    }

    const otherPositions = POSITIONS
      .map((item) => item.pos)
      .filter(
        (item) =>
          item !== position && runningBy(item) === 0
      ).length;

    const reserved =
      runningBy(position) === 0 ? 0 : otherPositions;

    if (running.length + reserved >= SLOTS) {
      return running.length >= SLOTS
        ? "All four training places are busy. Wait for a player to finish."
        : "Train a goalkeeper, defender, midfielder and forward before filling the remaining places.";
    }

    return "";
  }

  async function train(player: Player) {
    if (!ctx || day === null || busy) return;
    if (trainingIds.has(player.id)) return;

    const reason = slotProblem(player.position);

    if (reason) {
      setProblem(reason);
      return;
    }

    const spent = seasonGain[player.id] ?? 0;
    const gain = Math.max(
      0,
      Math.min(
        sessionGain(player.age) * boost,
        cap(player.age) - spent
      )
    );

    if (gain <= 0) {
      setProblem("This player has reached his training limit for this season.");
      return;
    }

    setBusy(true);
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

      setSelectedPlayer(null);

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

  const slotRows = Array.from({ length: SLOTS }).map(
    (_, index) => {
      const session = running[index];
      const player = session
        ? byId.get(session.player_id)
        : undefined;

      const end = session ? finishesAt(session) : null;
      const gain = session ? Number(session.gain) : 0;

      const progress =
        end && now
          ? Math.min(
              1,
              Math.max(0, 1 - (end - now) / TRAIN_MS)
            )
          : 0;

      return {
        player,
        end,
        gain,
        progress,
      };
    }
  );

  const currentPosition = POSITIONS.find(
    (item) => item.pos === pos
  );

  const selectedSpent = selectedPlayer
    ? seasonGain[selectedPlayer.id] ?? 0
    : 0;

  const selectedGain = selectedPlayer
    ? Math.max(
        0,
        Math.min(
          sessionGain(selectedPlayer.age) * boost,
          cap(selectedPlayer.age) - selectedSpent
        )
      )
    : 0;

  const selectedProgress = selectedPlayer
    ? progressOf(finished[selectedPlayer.id] ?? 0)
    : 0;

  const selectedPreview = Math.min(
    Math.max(0, 1 - selectedProgress),
    selectedGain
  );

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
        <header className="tc-heading">
          <div className="tc-heading-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="tc-heading-copy">
            <span className="tc-eyebrow">
              CLUB DEVELOPMENT
            </span>
            <h1>Player Training</h1>
            <p>
              Choose a position and select a player to
              improve his rating.
            </p>
          </div>

          <div className="tc-coach-level">
            <span>COACH LEVEL</span>
            <strong>{level}</strong>
            <small>
              +{Math.round((boost - 1) * 100)}% boost
            </small>
          </div>
        </header>

        <section className="tc-overview">
          <div className="tc-overview-main">
            <div>
              <span className="tc-section-kicker">
                TRAINING GROUND
              </span>
              <h2>Active sessions</h2>
              <p>
                Each player trains independently for{" "}
                {TRAIN_HOURS} hours.
              </p>
            </div>

            <div className="tc-session-count">
              <strong>{running.length}</strong>
              <span>/ {SLOTS} ACTIVE</span>
            </div>
          </div>

          <div className="tc-active-grid">
            {slotRows.map((slot, index) => (
              <article
                key={index}
                className={`tc-active-card ${
                  slot.player ? "has-player" : "is-empty"
                }`}
              >
                {slot.player ? (
                  <>
                    <div className="tc-active-top">
                      <span className="tc-active-status">
                        <i />
                        TRAINING
                      </span>
                      <span className="tc-active-position">
                        {slot.player.position}
                      </span>
                    </div>

                    <div className="tc-active-player">
                      <div className="tc-active-face">
                        <PlayerFace player={slot.player} />
                        <b>{slot.player.rating}</b>
                      </div>

                      <div className="tc-active-info">
                        <strong>{slot.player.name}</strong>
                        <small>
                          {slot.player.age} years old
                        </small>
                        <span>
                          +{slot.gain.toFixed(2)} progress
                        </span>
                      </div>
                    </div>

                    <div className="tc-active-progress">
                      <div className="tc-active-progress-track">
                        <i
                          style={{
                            width: `${slot.progress * 100}%`,
                          }}
                        />
                      </div>
                      <div className="tc-active-time">
                        <span>TIME REMAINING</span>
                        <strong>
                          {slot.end
                            ? clock(slot.end - now)
                            : clock(TRAIN_MS)}
                        </strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="tc-empty-content">
                    <span className="tc-empty-number">
                      0{index + 1}
                    </span>
                    <div className="tc-empty-icon">+</div>
                    <strong>Empty slot</strong>
                    <small>
                      Select a player below
                    </small>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {problem && (
          <div className="tc-message is-error" role="alert">
            <span>!</span>
            {problem}
            <button
              type="button"
              onClick={() => setProblem("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {result && (
          <div className="tc-message is-success" role="status">
            <span>✓</span>
            <div>
              <strong>{result.name}</strong> started training.
              <small>
                +{result.gain.toFixed(2)} development progress
                · {TRAIN_HOURS} hours
              </small>
            </div>
            <button
              type="button"
              onClick={() => setResult(null)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section className="tc-selection">
          <div className="tc-selection-heading">
            <div>
              <span className="tc-section-kicker">
                SELECT YOUR PLAYER
              </span>
              <h2>Choose a position</h2>
              <p>
                Select a position to see the players available
                for training.
              </p>
            </div>

            <div className="tc-duration">
              <span>SESSION DURATION</span>
              <strong>{TRAIN_HOURS} HOURS</strong>
            </div>
          </div>

          <div className="tc-position-grid" role="tablist">
            {POSITIONS.map((item) => {
              const count = squad.filter(
                (player) => player.position === item.pos
              ).length;

              const active = pos === item.pos;

              return (
                <button
                  key={item.pos}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`tc-position ${
                    active ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    setPos(item.pos);
                    setSelectedPlayer(null);
                    setProblem("");
                  }}
                >
                  <span className="tc-position-code">
                    {item.short}
                  </span>

                  <span className="tc-position-text">
                    <strong>{item.title}</strong>
                    <small>{count} players</small>
                  </span>

                  <span className="tc-position-arrow">
                    ›
                  </span>
                </button>
              );
            })}
          </div>

          <div className="tc-players-heading">
            <div>
              <span className="tc-section-kicker">
                {currentPosition?.short} SQUAD
              </span>
              <h2>
                {currentPosition?.title ?? "Players"}
              </h2>
            </div>

            <div className="tc-filters">
              <button
                type="button"
                className={filter === "ALL" ? "is-active" : ""}
                aria-pressed={filter === "ALL"}
                onClick={() => setFilter("ALL")}
              >
                All
              </button>

              <button
                type="button"
                className={
                  filter === "YOUNG" ? "is-active" : ""
                }
                aria-pressed={filter === "YOUNG"}
                onClick={() => setFilter("YOUNG")}
              >
                U23
              </button>
            </div>
          </div>

          <div className="tc-player-grid">
            {rows.map((player, index) => {
              const isTraining = trainingIds.has(player.id);
              const spent = seasonGain[player.id] ?? 0;
              const capNow = cap(player.age);
              const progress = progressOf(
                finished[player.id] ?? 0
              );

              const activeGain = pendingGain[player.id] ?? 0;

              const nextGain = isTraining
                ? activeGain
                : Math.max(
                    0,
                    Math.min(
                      sessionGain(player.age) * boost,
                      capNow - spent
                    )
                  );

              const preview = Math.min(
                Math.max(0, 1 - progress),
                nextGain
              );

              const atCap = spent >= capNow - 0.005;
              const playerPhase = phase(player.age);
              const isSelected =
                selectedPlayer?.id === player.id;

              let phaseLabel = "PRIME";

              if (playerPhase === "rising") {
                phaseLabel = "RISING";
              } else if (playerPhase === "declining") {
                phaseLabel = "DECLINING";
              }

              return (
                <button
                  key={player.id}
                  type="button"
                  className={`tc-player-card ${
                    isSelected ? "is-selected" : ""
                  } ${isTraining ? "is-training" : ""}`}
                  style={
                    {
                      "--card-delay": `${Math.min(index, 15) * 35}ms`,
                    } as CSSProperties
                  }
                  onClick={() => {
                    if (
                      busy ||
                      isTraining ||
                      atCap ||
                      day === null
                    ) {
                      return;
                    }

                    setProblem("");
                    setSelectedPlayer(player);
                  }}
                  disabled={
                    busy ||
                    isTraining ||
                    atCap ||
                    day === null
                  }
                >
                  <div className="tc-player-card-top">
                    <span className="tc-player-position">
                      {player.position}
                    </span>

                    <span
                      className={`tc-player-phase phase-${playerPhase}`}
                    >
                      {phaseLabel}
                    </span>
                  </div>

                  <div className="tc-player-visual">
                    <div className="tc-player-face">
                      <PlayerFace player={player} />
                    </div>

                    <div className="tc-player-rating">
                      <strong>{player.rating}</strong>
                      <small>OVR</small>
                    </div>
                  </div>

                  <div className="tc-player-details">
                    <strong>{player.name}</strong>
                    <span>{player.age} YEARS OLD</span>
                  </div>

                  <div className="tc-player-gain">
                    <span>
                      {isTraining
                        ? "CURRENT SESSION"
                        : "NEXT SESSION"}
                    </span>
                    <strong>
                      +{nextGain.toFixed(2)}
                    </strong>
                  </div>

                  <div className="tc-development">
                    <div className="tc-development-track">
                      <i
                        className="tc-development-done"
                        style={{
                          width: `${Math.min(100, progress * 100)}%`,
                        }}
                      />
                      <i
                        className="tc-development-preview"
                        style={{
                          width: `${Math.min(100, preview * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="tc-development-labels">
                      <span>DEVELOPMENT</span>
                      <strong>
                        {Math.round(progress * 100)}%
                        {preview > 0
                          ? ` + ${Math.round(preview * 100)}%`
                          : ""}
                      </strong>
                    </div>
                  </div>

                  <div className="tc-player-card-footer">
                    {isTraining ? (
                      <>
                        <span className="tc-status-dot" />
                        Training in progress
                      </>
                    ) : atCap ? (
                      "Season limit reached"
                    ) : (
                      <>
                        Select player <span>›</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}

            {rows.length === 0 && (
              <div className="tc-no-players">
                <span>—</span>
                <strong>No players available</strong>
                <small>
                  {filter === "YOUNG"
                    ? "There are no players aged 23 or under in this position."
                    : "This position has no players in your squad."}
                </small>
              </div>
            )}
          </div>
        </section>

        <footer className="tc-footer-note">
          <span>GSM PLAYER DEVELOPMENT</span>
          <p>
            Young players develop faster. Each player has an
            independent training countdown.
          </p>
        </footer>
      </div>

      {selectedPlayer && (
        <div
          className="tc-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!busy) setSelectedPlayer(null);
          }}
        >
          <section
            className="tc-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tc-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="tc-modal-close"
              onClick={() => setSelectedPlayer(null)}
              disabled={busy}
              aria-label="Close"
            >
              ×
            </button>

            <span className="tc-modal-kicker">
              CONFIRM TRAINING
            </span>

            <div className="tc-modal-player">
              <div className="tc-modal-face">
                <PlayerFace player={selectedPlayer} />
                <b>{selectedPlayer.rating}</b>
              </div>

              <div>
                <h2 id="tc-confirm-title">
                  {selectedPlayer.name}
                </h2>
                <p>
                  {selectedPlayer.position} ·{" "}
                  {selectedPlayer.age} years old
                </p>
              </div>
            </div>

            <div className="tc-modal-preview">
              <div>
                <span>SESSION DURATION</span>
                <strong>{TRAIN_HOURS} hours</strong>
              </div>

              <div>
                <span>EXPECTED DEVELOPMENT</span>
                <strong className="tc-modal-gain">
                  +{selectedGain.toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="tc-modal-progress">
              <div className="tc-development-track">
                <i
                  className="tc-development-done"
                  style={{
                    width: `${Math.min(
                      100,
                      selectedProgress * 100
                    )}%`,
                  }}
                />
                <i
                  className="tc-development-preview"
                  style={{
                    width: `${Math.min(
                      100,
                      selectedPreview * 100
                    )}%`,
                  }}
                />
              </div>

              <small>
                Current progress + expected session progress
              </small>
            </div>

            <div className="tc-modal-actions">
              <button
                type="button"
                className="tc-cancel-button"
                onClick={() => setSelectedPlayer(null)}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="tc-confirm-button"
                onClick={() => void train(selectedPlayer)}
                disabled={busy || selectedGain <= 0}
              >
                {busy ? "Starting..." : "Confirm training"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
