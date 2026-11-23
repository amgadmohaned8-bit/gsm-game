"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncServerTime } from "@/lib/serverTime";

const LIMIT_MS = 2 * 60_000;

/** Keeps the game on the server clock and tells the player when the device clock is wrong. */
export default function TimeSync() {
  const [off, setOff] = useState(0);

  useEffect(() => {
    let dead = false;
    const run = async () => {
      const o = await syncServerTime(supabase);
      if (!dead && o !== null) setOff(o);
    };
    void run();
    const timer = setInterval(run, 5 * 60_000);
    const visible = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      dead = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  if (Math.abs(off) < LIMIT_MS) return null;
  const minutes = Math.round(Math.abs(off) / 60_000);
  return (
    <div role="status" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9999, padding: "10px 14px", borderRadius: 12, background: "#2a1a05", color: "#f7db96", border: "1px solid #f7db96", fontSize: 13, textAlign: "center" }}>
      Your device clock is {minutes} min {off > 0 ? "behind" : "ahead"}. The game uses the server time, so changing the clock does not help.
    </div>
  );
}
