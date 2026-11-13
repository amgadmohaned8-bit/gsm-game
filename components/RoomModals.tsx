"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs, clubsOfLeague } from "@/lib/football/leagueClubs";
import {
  forgetCode, inviteLink, joinRoom, myRoom, normalizeCode, previewRoom, startRoom,
  type RoomInfo, type RoomMember,
} from "@/lib/football/rooms";
import { seasonLabel } from "@/lib/football/season";
import Icon from "./Icon";
import "./rooms.css";

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="rm" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rm-panel gx-cut" style={{ "--bg": "var(--ink-1)", "--bd": "var(--brass-lo)" } as React.CSSProperties}>
        <header>
          <h2>{title}</h2>
          <button ref={ref} type="button" className="rm-x" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Members({ members, total = 20 }: { members: RoomMember[]; total?: number }) {
  return (
    <div className="rm-members">
      <p><b>{members.length}</b> {members.length === 1 ? "manager" : "managers"} · the computer plays the other {total - members.length} clubs</p>
      <ul>
        {members.map((m) => {
          const c = clubs.find((x) => x.id === m.club_id);
          return (
            <li key={m.user_id}>
              {c && <img src={c.logo} alt="" />}
              <span><strong>{m.name ?? "Manager"}</strong><small>{c?.name ?? m.club_id}</small></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Dashboard: start a shared league or show the code to share. */
export function InviteModal(props: {
  userId: string; roomId: string | null; leagueId: string; season: string; clubId: string;
  onClose: () => void; onCreated: (roomId: string) => void;
}) {
  const { userId, roomId, leagueId, season, clubId, onClose, onCreated } = props;
  const [room, setRoom] = useState<Awaited<ReturnType<typeof myRoom>>>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(roomId));
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let off = false;
    if (roomId) myRoom(supabase, roomId).then((r) => { if (!off) { setRoom(r); setLoading(false); } }).catch(() => setLoading(false));
    return () => { off = true; };
  }, [roomId]);

  async function create() {
    setBusy(true); setMsg("");
    try {
      const made = await startRoom(supabase, userId, leagueId, season, clubId);
      onCreated(made.id);
      setRoom(await myRoom(supabase, made.id));
    } catch {
      setMsg("Could not create the league. Run supabase/005_friends_rooms.sql first.");
    } finally { setBusy(false); }
  }

  async function copy(kind: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(""), 1800); } catch { setMsg(text); }
  }

  return (
    <Shell title="Play with friends" onClose={onClose}>
      {loading ? <p className="rm-p">Loading...</p> : !room ? (
        <>
          <p className="rm-p">Turn this season into a shared league. Friends join with a code, each takes a club, everyone plays the same fixtures and the same results. Clubs without a manager are played by the computer.</p>
          <button type="button" className="gx-btn rm-go" onClick={create} disabled={busy}>{busy ? "Creating..." : "Create shared league"}</button>
        </>
      ) : (
        <>
          <p className="rm-p">Share this code. Friends enter it from the league screen with "Join with code", or open the link.</p>
          <div className="rm-code" aria-label={`League code ${room.code}`}>
            {room.code.split("").map((ch: string, i: number) => <span key={i} style={{ animationDelay: `${i * 70}ms` }}>{ch}</span>)}
          </div>
          <div className="rm-row">
            <button type="button" className="rm-btn" onClick={() => copy("code", room.code)}>{copied === "code" ? "Copied" : "Copy code"}</button>
            <button type="button" className="rm-btn" onClick={() => copy("link", inviteLink(room.code))}>{copied === "link" ? "Copied" : "Copy link"}</button>
          </div>
          <Members members={room.members} />
        </>
      )}
      {msg && <p className="rm-msg" role="alert">{msg}</p>}
    </Shell>
  );
}

/** League screen: enter a code, see the league, take a free club. */
export function JoinModal({ initialCode = "", onClose }: { initialCode?: string; onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeCode(initialCode));
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function look(value = code) {
    setBusy(true); setMsg(""); setRoom(null); setPick("");
    try {
      const r = await previewRoom(supabase, value);
      if (!r) setMsg("No league with this code.");
      else setRoom(r);
    } catch {
      setMsg("Could not check the code. Try again.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    // not logged in yet: the code stays saved, and the login brings the manager back here
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/");
      else if (code.length === 6) look(code);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join() {
    if (!room || !pick) return;
    setBusy(true); setMsg("");
    const { data } = await supabase.auth.getUser();
    if (!data.user) { router.replace("/"); return; }
    const err = await joinRoom(supabase, data.user.id, room, pick);
    if (err) { setMsg(err); setBusy(false); look(room.code); return; }
    forgetCode();
    router.replace("/game/dashboard");
  }

  const taken = new Map((room?.members ?? []).map((m) => [m.club_id, m]));

  return (
    <Shell title="Join with code" onClose={onClose}>
      <form className="rm-form" onSubmit={(e) => { e.preventDefault(); look(); }}>
        <input value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} placeholder="ABC123" inputMode="text" autoCapitalize="characters" aria-label="League code" maxLength={6} />
        <button type="submit" className="rm-btn" disabled={busy || code.length < 6}>Find league</button>
      </form>

      {room && (
        <div className="rm-found">
          <p className="rm-p"><b>{room.owner ?? "A manager"}</b>'s league · <span style={{ textTransform: "capitalize" }}>{room.league_id.replace("-", " ")}</span> · season {seasonLabel(room.season)}</p>
          <Members members={room.members} />
          <h3 className="rm-h">Pick your club</h3>
          <div className="rm-clubs" role="group" aria-label="Clubs">
            {clubsOfLeague(room.league_id).map((c, i) => {
              const t = taken.get(c.id);
              return (
                <button key={c.id} type="button" disabled={Boolean(t)} className={`rm-club ${pick === c.id ? "is-on" : ""}`} aria-pressed={pick === c.id} onClick={() => setPick(c.id)} style={{ animationDelay: `${i * 25}ms` }}>
                  <img src={c.logo} alt="" />
                  <span>{c.name}</span>
                  {t && <small>{t.name ?? "Taken"}</small>}
                </button>
              );
            })}
          </div>
          <button type="button" className="gx-btn rm-go" disabled={!pick || busy} onClick={join}>{busy ? "Joining..." : "Join this league"}</button>
        </div>
      )}
      {msg && <p className="rm-msg" role="alert">{msg}</p>}
    </Shell>
  );
}
