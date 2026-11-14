"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { markNoticesSeen, unseenNotices, type FriendNotice } from "@/lib/football/friendlies";
import { alertNow } from "@/lib/notify";
import { sfx } from "@/lib/sound";
import "./friendnotice.css";

const label = (n: FriendNotice) => (n.kind === "league" ? `league, matchday ${n.matchday ?? ""}`.trim() : "friendly");
const name = (id: string) => clubs.find((c) => c.id === id)?.name ?? id;

/**
 * A friend in the same shared league played a friendly against your club:
 * a banner tells you who and the score (and a phone alert if they are on).
 */
export default function FriendNotices() {
  const pathname = usePathname();
  const [list, setList] = useState<FriendNotice[]>([]);

  useEffect(() => {
    let off = false;
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || off) return;
        const fresh = await unseenNotices(supabase, user.id);
        if (off || !fresh.length) return;
        void markNoticesSeen(supabase, fresh.map((n) => n.id));
        sfx("ping");
        for (const n of fresh) {
          void alertNow(`${n.from_name || "A friend"} played you`, `${name(n.home_club)} ${n.home_score}-${n.away_score} ${name(n.away_club)} (${label(n)})`, `fn-${n.id}`);
        }
        setList((cur) => [...cur, ...fresh]);
        window.setTimeout(() => setList((cur) => cur.filter((n) => !fresh.some((f) => f.id === n.id))), 9000);
      } catch { /* messages are optional */ }
    }
    void check();
    const t = setInterval(check, 30_000);
    // coming back to the game (after the screen was off): look right away
    const back = () => { if (!document.hidden) void check(); };
    document.addEventListener("visibilitychange", back);
    return () => { off = true; clearInterval(t); document.removeEventListener("visibilitychange", back); };
  }, [pathname]);

  if (!list.length) return null;
  return (
    <div className="fn" role="status" aria-live="polite">
      {list.map((n) => (
        <button key={n.id} type="button" className="fn-card" onClick={() => setList((cur) => cur.filter((x) => x.id !== n.id))}>
          <b>{n.from_name || "A friend"} played you</b>
          <span>{name(n.home_club)} <i>{n.home_score}-{n.away_score}</i> {name(n.away_club)} · {label(n)}</span>
        </button>
      ))}
    </div>
  );
}
