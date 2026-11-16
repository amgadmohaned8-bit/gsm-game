"use client";

import { useCallback, useEffect, useState } from "react";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { ago, type RPost } from "@/lib/football/socialPosts";
import Icon from "@/components/Icon";
import SocialArt from "@/components/SocialArt";
import "./socialx.css";

const SECONDS = 5;

/** Full-screen stories of one manager: tap to move on, they advance by themselves. */
export default function StoryViewer({
  stories, mine, onClose, onDelete,
}: {
  stories: RPost[]; mine: boolean; onClose: () => void; onDelete: (p: RPost) => void;
}) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [tick, setTick] = useState(0);
  const cur = stories[Math.min(i, stories.length - 1)];

  const next = useCallback(() => {
    setTick(0);
    if (i >= stories.length - 1) onClose();
    else setI(i + 1);
  }, [i, stories.length, onClose]);
  const back = () => { setTick(0); setI((n) => Math.max(0, n - 1)); };

  useEffect(() => {
    if (held) return;
    const t = window.setInterval(() => setTick((v) => v + 0.05), 50);
    return () => window.clearInterval(t);
  }, [held, i]);
  useEffect(() => { if (tick >= SECONDS) next(); }, [tick, next]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [next, onClose]);

  if (!cur) return null;
  const club = clubs.find((c) => c.id === cur.club);

  return (
    <div className="sx-story" role="dialog" aria-modal="true" aria-label={`${cur.name} story`}>
      <div className="sx-story-in" onPointerDown={() => setHeld(true)} onPointerUp={() => setHeld(false)} onPointerLeave={() => setHeld(false)}>
        <div className="sx-bars" aria-hidden="true">
          {stories.map((s, n) => (
            <span key={s.id}><i style={{ width: n < i ? "100%" : n === i ? `${Math.min(100, (tick / SECONDS) * 100)}%` : "0%" }} /></span>
          ))}
        </div>
        <header className="sx-story-head">
          <span className="sx-ava">{club && <img src={club.logo} alt="" />}</span>
          <div><strong>{cur.name}</strong><small>{ago(cur.at)}</small></div>
          {mine && <button type="button" className="sx-x" aria-label="Delete this story" onClick={() => { onDelete(cur); }}><Icon name="close" size={18} /></button>}
          <button type="button" className="sx-x" aria-label="Close" onClick={onClose}><Icon name="arrow-left" size={20} /></button>
        </header>
        <SocialArt image={cur.image} bg={cur.bg} text={cur.caption} story />
        <button type="button" className="sx-tap is-back" aria-label="Previous" onClick={back} />
        <button type="button" className="sx-tap is-next" aria-label="Next" onClick={next} />
      </div>
    </div>
  );
}
