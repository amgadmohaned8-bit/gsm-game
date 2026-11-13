"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { pickRound, reactionFor, toneOf, type Quote } from "@/lib/football/press";
import "./press.css";


const hello = ["السلام عليكم يا كوتش!", "مساء الخير يا كوتش.", "أهلاً يا كوتش، سؤال سريع."];

/** Two questions from two journalists before the match. */
export default function PressConference(props: {
  myClub: string;
  oppClub: string;
  cup: boolean;
  home: boolean;
  seed: string;
  label?: string;
  onDone: (quotes: Quote[]) => void;
}) {
  const { myClub, oppClub, cup, home, seed, label, onDone } = props;
  const me = clubs.find((c) => c.id === myClub);
  const opp = clubs.find((c) => c.id === oppClub);
  const rounds = useMemo(
    () => pickRound(seed, myClub, oppClub, cup, home, { club: me?.name ?? myClub, opp: opp?.name ?? oppClub }),
    [seed, myClub, oppClub, cup, home, me, opp]
  );

  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<"ask" | "react">("ask");
  const [typed, setTyped] = useState(0);
  const [text, setText] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [reaction, setReaction] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  // the page around keeps re-rendering (its clock ticks); the timers must not restart each time
  const finish = useRef(onDone);
  finish.current = onDone;

  const round = rounds[step];
  const j = round.journalist;
  const line = stage === "ask" ? `${hello[step % hello.length]} ${round.question}` : reaction;
  const done = typed >= line.length;

  // the journalist's words appear letter by letter
  useEffect(() => {
    setTyped(0);
    const t = setInterval(() => setTyped((n) => n + 1), 22);
    return () => clearInterval(t);
  }, [step, stage, reaction]);

  useEffect(() => {
    if (stage === "ask" && done) box.current?.focus();
  }, [stage, done]);

  // after the reaction: next question, or the end
  useEffect(() => {
    if (stage !== "react" || !done) return;
    const t = setTimeout(() => {
      if (step + 1 < rounds.length) {
        setStep(step + 1);
        setStage("ask");
        setText("");
      } else {
        finish.current(quotes);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [stage, done, step, rounds.length, quotes]);

  function send(answer: string) {
    const a = answer.trim() || "بدون تعليق";
    const tone = toneOf(a);
    setQuotes((q) => [...q, { q: round.question, a, by: j.name, outlet: j.outlet, tone }]);
    setReaction(reactionFor(tone, `${seed}|${step}|r`));
    setStage("react");
  }

  return (
    <div className="pc" role="dialog" aria-modal="true" aria-label="Press conference">
      <img className="pc-hall" src="/studio/press-hall.jpg" alt="" />
      <div className="pc-shade" aria-hidden="true" />
      <div className="pc-flashes" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => <i key={i} style={{ left: `${6 + i * 14}%`, top: `${28 + ((i * 17) % 30)}%`, animationDelay: `${(i * 0.83) % 4}s` }} />)}
      </div>

      <header className="pc-banner pc-glass">
        <img src={me?.logo} alt="" />
        <div>
          <small>Press conference</small>
          <strong>{me?.name} · {label ?? "Before the match"}</strong>
        </div>
        <span className="pc-count" aria-label={`Question ${step + 1} of ${rounds.length}`}>{step + 1}/{rounds.length}</span>
      </header>

      <div className="pc-ask">
        <div className={`pc-line pc-glass is-${stage}`} key={`${step}-${stage}`} dir="rtl" lang="ar">
          <strong><span className="pc-live" aria-hidden="true" />{j.name} <small>{j.outlet}</small></strong>
          <p>{line.slice(0, typed)}<span className="pc-caret" aria-hidden="true" /></p>
        </div>
      </div>

      <div className="pc-reply">
        {stage === "ask" ? (
          <form className="pc-answer pc-glass" onSubmit={(e) => { e.preventDefault(); send(text); }} aria-hidden={!done} style={{ opacity: done ? 1 : 0.45 }}>
            <label htmlFor="pc-text">Your answer</label>
            <textarea id="pc-text" ref={box} dir="auto" rows={3} maxLength={220} value={text} disabled={!done}
              placeholder="Write what you want to say..." onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <div className="pc-hints" dir="rtl" lang="ar">
              {round.ask.hints.map((h) => <button type="button" key={h} disabled={!done} onClick={() => setText(h)}>{h}</button>)}
            </div>
            <div className="pc-actions">
              <small>{text.length}/220</small>
              <button type="button" className="pc-ghost" disabled={!done} onClick={() => send("بدون تعليق")}>No comment</button>
              <button type="submit" className="gx-btn" disabled={!done || !text.trim()}>Answer</button>
            </div>
          </form>
        ) : (
          <blockquote className="pc-you pc-glass" dir="auto">
            <small>You said</small>
            {quotes[quotes.length - 1]?.a}
          </blockquote>
        )}
        <button type="button" className="pc-skip" onClick={() => onDone(quotes)}>Skip the press conference</button>
      </div>
    </div>
  );
}
