"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import type { MatchEvent } from "@/lib/football/matchSim";
import { buildLine, foulBuildLine, foulLine, fullTimeLine, goalLine, halfLine, kickoffLine, missLine, penBuildLine, penGoalLine, penMissLine, pick, studioScript, type Line } from "@/lib/football/commentary";
import PitchView from "@/components/PitchView";
import { matchKits } from "@/lib/football/kits";
import "@/app/game/fixtures/fixtures.css";
import PressConference from "@/components/PressConference";
import HalftimePanel, { type HalftimeChange } from "@/components/HalftimePanel";
import type { Revised } from "@/lib/football/halftime";
import type { Player } from "@/lib/football/squads";
import { supabase } from "@/lib/supabase";
import type { Quote } from "@/lib/football/press";
import { readSettings } from "@/lib/settings";
import "./broadcast.css";
import "./pitchview.css";

export type OverlayOther = {
  id: string;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  pens?: string;
};

type Props = {
  homeClub: string;
  awayClub: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  /** shoot-out score after a draw, as [home, away] */
  penalties?: [number, number] | null;
  myClub: string;
  /** the press conference before the match; left out, there is none */
  press?: { userId: string; season: string; matchday: number; kind: "league" | "cup"; roomId?: string | null; managerName?: string | null };
  /** shown on the studio screen, e.g. "Matchday 5" */
  label?: string;
  othersTitle: string;
  others: OverlayOther[];
  closeLabel: string;
  onClose: () => void;
  /** the manager can change things at half-time */
  halftime?: {
    clubId: string;
    starters: Player[];
    bench: Player[];
    apply: (change: HalftimeChange, now: Revised) => Revised | Promise<Revised>;
  };
};

function clubOf(id: string) {
  return clubs.find((club) => club.id === id);
}

type Moment = { minute: number; kind: "goal" | "chance" | "save" | "half" | "foul"; team: "home" | "away"; player?: string; assist?: string; /** a penalty (shown on the pitch only) */ pen?: boolean; card?: "yellow" | "red"; by?: string };
type Said = { id: number; text: string; tone: "plain" | "goal" | "miss" };

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** How the manager wants matches to run (see the settings page). */
const options = () => (typeof window === "undefined" ? null : readSettings());

/** The studio before the match, then the match with a commentator. */
export default function MatchOverlay(props: Props) {
  const afterPress = () => {
    const o = options();
    return reducedMotion() || (o && (!o.studio || o.speed === "instant")) ? "match" : "studio";
  };
  const [phase, setPhase] = useState<"press" | "studio" | "match">(() => {
    const o = options();
    return props.press && (o ? o.press : true) ? "press" : afterPress();
  });

  async function pressDone(quotes: Quote[]) {
    setPhase(afterPress());
    const info = props.press;
    if (!info || !quotes.length) return;
    try {
      await supabase.from("press_quotes").upsert(
        {
          user_id: info.userId,
          room_id: info.roomId ?? null,
          manager_name: info.managerName ?? null,
          club_id: props.myClub,
          opponent_id: props.myClub === props.homeClub ? props.awayClub : props.homeClub,
          season: info.season,
          kind: info.kind,
          matchday: info.matchday,
          quotes,
        },
        { onConflict: "user_id,season,kind,matchday" }
      );
    } catch {
      /* the conference still happened; it just will not reach the feed */
    }
  }

  if (phase === "press" && props.press) {
    return (
      <PressConference
        myClub={props.myClub}
        oppClub={props.myClub === props.homeClub ? props.awayClub : props.homeClub}
        cup={props.press.kind === "cup"}
        home={props.myClub === props.homeClub}
        seed={`${props.press.userId}|${props.press.season}|${props.press.kind}|${props.press.matchday}`}
        label={props.label}
        onDone={pressDone}
      />
    );
  }
  return phase === "studio" ? <Studio {...props} onDone={() => setPhase("match")} /> : <Match {...props} />;
}

/* ---------- the studio ---------- */

function Studio({ homeClub, awayClub, myClub, label = "Today's match", onDone }: Props & { onDone: () => void }) {
  const home = clubOf(homeClub);
  const away = clubOf(awayClub);
  const script = useMemo<Line[]>(
    () =>
      home && away
        ? studioScript({ home, away, myClub, label })
        : [{ who: "m", name: "كريم", text: "أهلاً بيكم في استوديو GSM! الماتش يبدأ دلوقتي." }],
    [home, away, myClub, label]
  );

  const [i, setI] = useState(0);
  const [chars, setChars] = useState(0);
  const line = script[i];
  const full = chars >= line.text.length;
  const finish = useRef(onDone);
  finish.current = onDone;

  // typewriter
  useEffect(() => {
    setChars(0);
    const t = setInterval(() => setChars((c) => c + 1), 28);
    return () => clearInterval(t);
  }, [i]);
  useEffect(() => {
    if (full) {
      const t = setTimeout(() => (i + 1 < script.length ? setI(i + 1) : finish.current()), 1700);
      return () => clearTimeout(t);
    }
  }, [full, i, script.length]);

  function next() {
    if (!full) setChars(line.text.length);
    else if (i + 1 < script.length) setI(i + 1);
    else onDone();
  }

  return (
    <div className="bc bc-studio" role="dialog" aria-modal="true" aria-label="Studio" onClick={next}>
      <div className="bc-stage">
        <img className="bc-studio-img" src="/studio/studio.jpg" alt="" />
        <div className={`bc-dim is-left ${line.who === "f" ? "" : "is-on"}`} aria-hidden="true" />
        <div className={`bc-dim is-right ${line.who === "m" ? "" : "is-on"}`} aria-hidden="true" />
        <div className="bc-tv" aria-hidden="true">
          <small>{label}</small>
          <div>
            {home && <img src={home.logo} alt="" />}
            <b>VS</b>
            {away && <img src={away.logo} alt="" />}
          </div>
          <p><span>{home?.name}</span><span>{away?.name}</span></p>
          <em>LIVE · 8:00 PM</em>
        </div>
        <div className="bc-live" aria-hidden="true"><i /> LIVE</div>
      </div>

      <div className={`bc-caption gx-cut is-${line.who}`} key={i} dir="rtl" lang="ar">
        <strong>{line.name}</strong>
        <p>{line.text.slice(0, chars)}<span className="bc-caret" aria-hidden="true" /></p>
      </div>

      <button type="button" className="bc-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>
        Skip to the match
      </button>
    </div>
  );
}

/* ---------- the match ---------- */

function Match({
  homeClub,
  awayClub,
  homeScore,
  awayScore,
  events,
  penalties,
  myClub,
  othersTitle,
  others,
  closeLabel,
  onClose,
  halftime,
}: Props) {
  const [data, setData] = useState({ events, homeScore, awayScore });
  const home = clubOf(homeClub);
  const away = clubOf(awayClub);
  const homeName = home?.name ?? homeClub;
  const awayName = away?.name ?? awayClub;
  const seedBase = `${homeClub}|${awayClub}`;
  const kits = useMemo(() => matchKits(homeClub, awayClub), [homeClub, awayClub]);

  // the moments of the match, from the saved data.events
  const moments = useMemo<Moment[]>(() => {
    const list: Moment[] = [];
    let extras = 0;
    data.events.forEach((e, idx) => {
      if (e.type === "goal" && e.team) list.push({ minute: e.minute, kind: "goal", team: e.team, player: e.player, assist: e.assist, pen: !!e.pen });
      else if (e.type === "pen_miss" && e.team) list.push({ minute: e.minute, kind: e.saved ? "save" : "chance", team: e.team, pen: true });
      else if (e.type === "foul" && e.team) list.push({ minute: e.minute + 0.2, kind: "foul", team: e.team, card: e.card, by: e.player });
      else if ((e.type === "chance" || e.type === "save") && extras < 4) {
        extras++;
        list.push({ minute: e.minute, kind: e.type, team: pick(["home", "away"] as const, `${seedBase}|${idx}`) });
      }
    });
    list.push({ minute: 45, kind: "half", team: "home" });
    return list.sort((x, y) => x.minute - y.minute);
  }, [data.events, seedBase]);

  const opts = options();
  const reduced = reducedMotion() || opts?.speed === "instant";
  const fast = opts?.speed === "fast";
  const gap = (ms: number) => (fast ? Math.round(ms * 0.45) : ms);
  const [minute, setMinute] = useState(reduced ? 90 : 0);
  const [cursor, setCursor] = useState(reduced ? moments.length : 0);
  const [stage, setStage] = useState<"kick" | "run" | "build" | "break" | "result" | "end">(reduced ? "end" : "kick");
  const [skipped, setSkipped] = useState(reduced);
  const [log, setLog] = useState<Said[]>([]);
  const [now, setNow] = useState<Said | null>(null);
  const [voice, setVoice] = useState(Boolean(opts?.voice));
  const minuteRef = useRef(minute);
  const idRef = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  const changed = useRef(false);

  const done = skipped || stage === "end";
  const current = moments[cursor];

  // goals shown so far: every goal moment already revealed
  const revealed = done ? moments.length : cursor + (stage === "result" ? 1 : 0);
  const shownMoments = moments.slice(0, revealed).filter((m) => m.kind === "goal");
  const homeGoals = done ? data.homeScore : shownMoments.filter((m) => m.team === "home").length;
  const awayGoals = done ? data.awayScore : shownMoments.filter((m) => m.team === "away").length;
  const goalCount = homeGoals + awayGoals;

  function say(text: string, tone: Said["tone"] = "plain") {
    const entry = { id: ++idRef.current, text, tone };
    setNow(entry);
    setLog((l) => [entry, ...l].slice(0, 12));
  }

  const myIsHome = homeClub === myClub;
  const mineInvolved = homeClub === myClub || awayClub === myClub;

  useEffect(() => {
    if (done) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let ticker: ReturnType<typeof setInterval> | undefined;

    if (stage === "kick") {
      say(kickoffLine(homeName, awayName, seedBase));
      timers.push(setTimeout(() => setStage("run"), gap(2600)));
    } else if (stage === "run") {
      const target = current ? current.minute : 90;
      ticker = setInterval(() => {
        minuteRef.current = Math.min(target, minuteRef.current + (fast ? 1.2 : 0.45));
        setMinute(minuteRef.current);
        if (minuteRef.current >= target) {
          clearInterval(ticker);
          setStage(current ? "build" : "end");
        }
      }, 100);
    } else if (stage === "build" && current) {
      const name = current.team === "home" ? homeName : awayName;
      if (current.kind === "half") {
        const h = moments.slice(0, cursor).filter((m) => m.kind === "goal" && m.team === "home").length;
        const a = moments.slice(0, cursor).filter((m) => m.kind === "goal" && m.team === "away").length;
        say(halfLine(h, a, seedBase));
        if (halftime && mineInvolved && !changed.current) {
          timers.push(setTimeout(() => setStage("break"), gap(1800)));
        } else {
          timers.push(setTimeout(() => { setCursor((c) => c + 1); setStage("run"); }, gap(2600)));
        }
      } else {
        say(current.kind === "foul" ? foulBuildLine(name, `${seedBase}|${cursor}|b`) : current.pen ? penBuildLine(name, `${seedBase}|${cursor}|b`) : buildLine(name, `${seedBase}|${cursor}|b`));
        timers.push(setTimeout(() => setStage("result"), gap(2300)));
      }
    } else if (stage === "result" && current) {
      const name = current.team === "home" ? homeName : awayName;
      if (current.kind === "goal") {
        const upTo = moments.slice(0, cursor + 1).filter((m) => m.kind === "goal");
        const h = upTo.filter((m) => m.team === "home").length;
        const a = upTo.filter((m) => m.team === "away").length;
        const scoredMine = mineInvolved ? (current.team === "home") === myIsHome : null;
        say(current.pen ? penGoalLine(name, h, a, scoredMine, `${seedBase}|${cursor}|g`, { player: current.player }) : goalLine(name, h, a, scoredMine, `${seedBase}|${cursor}|g`, { player: current.player, assist: current.assist }), "goal");
      } else if (current.kind === "foul") {
        say(foulLine(name, current.card ?? false, `${seedBase}|${cursor}|m`, current.by), "miss");
      } else {
        say(current.pen ? penMissLine(name, current.kind === "save", `${seedBase}|${cursor}|m`) : missLine(name, current.kind === "save", `${seedBase}|${cursor}|m`), "miss");
      }
      timers.push(setTimeout(() => { setCursor((c) => c + 1); setStage("run"); }, gap(current.kind === "goal" ? 3600 : 2800)));
    } else if (stage === "end") {
      setMinute(90);
    }

    return () => {
      timers.forEach(clearTimeout);
      if (ticker) clearInterval(ticker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, cursor, done]);

  const myGoals = myIsHome ? data.homeScore : data.awayScore;
  const theirGoals = myIsHome ? data.awayScore : data.homeScore;
  let verdict = myGoals > theirGoals ? "Victory" : myGoals < theirGoals ? "Defeat" : "Draw";
  let line = `${verdict}, ${myGoals}-${theirGoals}`;
  if (penalties && myGoals === theirGoals) {
    const mine = myIsHome ? penalties[0] : penalties[1];
    const theirs = myIsHome ? penalties[1] : penalties[0];
    verdict = mine > theirs ? "Victory" : "Defeat";
    line = `${verdict} on penalties, ${mine}-${theirs} after ${myGoals}-${theirGoals}`;
  }

  // the commentator closes the match
  useEffect(() => {
    if (!done) return;
    const result = !mineInvolved ? null : verdict === "Victory" ? "win" : verdict === "Defeat" ? "lose" : "draw";
    const extra = penalties ? " والماتش اتحسم بركلات الترجيح!" : "";
    say(fullTimeLine(result, data.homeScore, data.awayScore, seedBase) + extra);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useEffect(() => {
    button.current?.focus();
  }, [done]);

  // optional voice: the browser reads the commentary out loud
  useEffect(() => {
    if (!voice || !now || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(now.text);
    u.lang = "ar-EG";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }, [now, voice]);
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  async function applyHalftime(change: HalftimeChange | null) {
    changed.current = true;
    if (change && halftime) {
      try {
        const revised = await halftime.apply(change, { events: data.events, home_score: data.homeScore, away_score: data.awayScore });
        setData({ events: revised.events, homeScore: revised.home_score, awayScore: revised.away_score });
        say(change.subs ? `تغييرات في الشوط التاني! ${change.subs} ${change.subs > 1 ? "تبديلات" : "تبديل"} ومدرب ${myIsHome ? homeName : awayName} بيغيّر شكل الماتش.` : "المدرب غيّر الأسلوب للشوط التاني!");
      } catch {
        /* the match goes on as it was */
      }
    }
    setCursor((c) => c + 1);
    setStage("run");
  }

  function skip() {
    minuteRef.current = 90;
    setMinute(90);
    setCursor(moments.length);
    setSkipped(true);
    setStage("end");
  }

  const onBreak = !done && stage === "break" && !!halftime;
  const goalNow = !done && stage === "result" && current?.kind === "goal";

  return (
    <div className={`fx-match bc-match ${goalNow ? "is-goal" : ""}`} role="dialog" aria-modal="true" aria-label="Match">
      <div className="fx-match-bg" aria-hidden="true" />
      <div className="bc-flash" aria-hidden="true" key={`f${goalCount}`} />
      {onBreak && halftime && (
        <HalftimePanel
          clubId={halftime.clubId}
          starters={halftime.starters}
          bench={halftime.bench}
          score={`${homeName} ${homeGoals}-${awayGoals} ${awayName}`}
          onApply={(c) => applyHalftime(c)}
          onSkip={() => applyHalftime(null)}
        />
      )}

      <div className="fx-match-inner">
        <header className="fx-board gx-cut" key={goalCount}>
          <div className="fx-board-team">
            {home && <img src={home.logo} alt="" />}
            <strong style={{ borderBottom: `3px solid ${kits.home}`, paddingBottom: 2 }}>{home?.name}</strong>
          </div>

          <div className="fx-board-score">
            <b>{homeGoals}</b>
            <i>-</i>
            <b>{awayGoals}</b>
          </div>

          <div className="fx-board-team is-away">
            {away && <img src={away.logo} alt="" />}
            <strong style={{ borderBottom: `3px solid ${kits.away}`, paddingBottom: 2 }}>{away?.name}</strong>
          </div>
        </header>

        {shownMoments.some((m) => m.player) && (
          <div className="bc-scorers" aria-label="Scorers">
            <ul>
              {shownMoments.filter((m) => m.team === "home" && m.player).map((m, i) => <li key={i}>{m.player} {Math.floor(m.minute)}&apos;</li>)}
            </ul>
            <ul className="is-away">
              {shownMoments.filter((m) => m.team === "away" && m.player).map((m, i) => <li key={i}>{m.player} {Math.floor(m.minute)}&apos;</li>)}
            </ul>
          </div>
        )}

        <div className="fx-clock" aria-hidden="true">
          <span>{done ? "FT" : `${Math.floor(minute)}'`}</span>
          <i>
            <b style={{ width: `${(minute / 90) * 100}%` }} />
          </i>
          <button type="button" className="bc-voice" aria-pressed={voice} onClick={() => setVoice((v) => !v)} title="Read the commentary aloud">
            {voice ? "Voice on" : "Voice off"}
          </button>
        </div>

        {done && (
          <p className={`fx-verdict is-${verdict.toLowerCase()}`} role="status">
            {line}
          </p>
        )}

        <PitchView
          homeColor={kits.home}
          awayColor={kits.away}
          seed={seedBase}
          ev={!done && current && current.kind !== "half" && (stage === "build" || stage === "result") ? { id: cursor, kind: current.kind, team: current.team, stage: stage === "build" ? "build" : "result", pen: current.pen, card: current.card } : null}
        />

        <section className="bc-booth" aria-label="Commentary">
          <img className={`bc-man ${now ? "is-talking" : ""} ${now?.tone === "goal" ? "is-goal" : ""}`} src="/studio/commentator.webp" alt="" />
          {now && (
            <div className={`bc-bubble is-${now.tone}`} key={now.id} dir="rtl" lang="ar" role="status">
              {goalNow && <b className="bc-goal-word" aria-hidden="true">GOAL!</b>}
              <p>{now.text}</p>
            </div>
          )}
        </section>

        <ul className="fx-feed bc-log" aria-label="Commentary log" dir="rtl" lang="ar">
          {log.slice(1).map((l) => (
            <li key={l.id} data-type={l.tone === "goal" ? "goal" : "chance"}>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>

        {done && others.length > 0 && (
          <section className="fx-others" aria-label="Other results">
            <h3>{othersTitle}</h3>
            <ul>
              {others.map((o) => (
                <li key={o.id}>
                  <span>{clubOf(o.home_club)?.name}</span>
                  <b>
                    {o.home_score} - {o.away_score}
                    {o.pens ? ` (${o.pens})` : ""}
                  </b>
                  <span>{clubOf(o.away_club)?.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="fx-match-actions">
          {!done ? (
            <button type="button" ref={button} className="fx-skip gx-cut gx-cut-s" onClick={skip}>
              Skip to full time
            </button>
          ) : (
            <button type="button" ref={button} className="gx-btn" onClick={onClose}>
              {closeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
