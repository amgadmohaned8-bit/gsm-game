"use client";

import { useEffect, useState } from "react";
import "./orientation.css";

type LockApi = { lock?: (o: string) => Promise<void> };

function isPhone() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.screen.width, window.screen.height) <= 600;
  return coarse && small;
}

async function lockLandscape(): Promise<boolean> {
  try {
    const o = screen.orientation as unknown as LockApi;
    if (!o?.lock) return false;
    await o.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

/**
 * Phones play GSM sideways. This asks the browser / installed app to keep the
 * screen in landscape. Browsers only allow that inside fullscreen or an
 * installed app, so when the lock is refused and the phone is upright we show a
 * small "turn your phone" card. It can be dismissed: the game still works upright.
 */
export default function OrientationGate() {
  const [phone, setPhone] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const p = isPhone();
    setPhone(p);
    if (!p) return;
    document.documentElement.dataset.device = "phone";
    try {
      if (sessionStorage.getItem("gsm-portrait-ok") === "1") setHidden(true);
    } catch {}
    void lockLandscape();
    const mq = window.matchMedia("(orientation: portrait)");
    const sync = () => setPortrait(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    // a refused lock may succeed after the first touch (installed apps / fullscreen)
    const first = () => void lockLandscape();
    window.addEventListener("pointerdown", first, { once: true });
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("pointerdown", first);
    };
  }, []);

  async function goLandscape() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    } catch {}
    await lockLandscape();
  }

  function stay() {
    setHidden(true);
    try {
      sessionStorage.setItem("gsm-portrait-ok", "1");
    } catch {}
  }

  if (!phone || !portrait || hidden) return null;

  return (
    <div className="og" role="dialog" aria-label="Turn your phone">
      <div className="og-card">
        <svg className="og-phone" viewBox="0 0 64 64" aria-hidden="true">
          <rect x="22" y="6" width="20" height="36" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M12 52c8 8 24 8 32-2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M44 44l2 8-8-1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2>Turn your phone</h2>
        <p>GSM plays best sideways, so every screen fits without scrolling.</p>
        <button type="button" className="og-go" onClick={goLandscape}>Go landscape</button>
        <button type="button" className="og-stay" onClick={stay}>Continue in portrait</button>
      </div>
    </div>
  );
}
