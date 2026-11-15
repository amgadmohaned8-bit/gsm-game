"use client";

import { leaveCurrentRoom } from "@/lib/football/careers";
import { sfx } from "@/lib/sound";
import { registerPush } from "@/lib/push";
import { alertMode, alertNow, alertProblem, alertState, askAlerts } from "@/lib/notify";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { myRoom } from "@/lib/football/rooms";
import { useSettings } from "@/lib/settings";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./settings.css";

type Contract = { manager_name: string; selected_club: string | null; selected_league: string | null; room_id: string | null };

function Switch({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="st-row st-switch" onClick={() => onChange(!on)}>
      <span><strong>{label}</strong>{note && <small>{note}</small>}</span>
      <i aria-hidden="true"><b /></i>
    </button>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; name: string; note: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="st-choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "is-on" : ""} onClick={() => onChange(o.id)}>
          <strong>{o.name}</strong>
          <small>{o.note}</small>
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [s, set] = useSettings();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [contract, setContract] = useState<Contract | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [perm, setPerm] = useState<"granted" | "denied" | "default" | "none">("none");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [note, setNote] = useState<{ key: string; text: string; bad?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<"" | "leave" | "reset">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/");
      const { data: c } = await supabase
        .from("manager_contracts")
        .select("manager_name, selected_club, selected_league, room_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      let roomCode: string | null = null;
      if (c?.room_id) {
        try { roomCode = (await myRoom(supabase, c.room_id))?.code ?? null; } catch { /* no code to show */ }
      }
      if (off) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      setContract((c as Contract) ?? null);
      setCode(roomCode);
      void alertState().then(setPerm);
      setLoading(false);
    })();
    return () => { off = true; };
  }, [router]);

  const club = clubs.find((x) => x.id === contract?.selected_club);

  async function changePassword() {
    if (pw.a.length < 8) return setNote({ key: "pw", text: "Use at least 8 characters.", bad: true });
    if (pw.a !== pw.b) return setNote({ key: "pw", text: "The two passwords do not match.", bad: true });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    setBusy(false);
    if (error) return setNote({ key: "pw", text: "Could not change the password. Log in again and retry.", bad: true });
    setPw({ a: "", b: "" });
    setNote({ key: "pw", text: "Password changed." });
  }

  async function alerts() {
    setPerm(await askAlerts());
    void registerPush(supabase, true); // the phone can also be alerted while the game is closed
  }

  const [alertTest, setAlertTest] = useState("");
  async function testAlert() {
    const st = await alertState();
    setPerm(st);
    const problem = await alertProblem();
    if (problem) {
      setAlertTest(`The app cannot reach the notification plugin: ${problem}`);
      return;
    }
    if (st !== "granted") {
      setAlertTest(st === "denied" ? "Alerts are blocked. Allow notifications for GSM in the phone settings (App info > Notifications)." : "Alerts are off. Tap Turn on first.");
      return;
    }
    await alertNow("GSM test", "If you can read this, alerts work.", `test-${Date.now()}`);
    setAlertTest(alertMode() === "app" ? "Sent. You should see it in a second. If not, check the phone's battery and notification settings for GSM." : "Sent. This is the browser, so alerts only show while this page is open. Install the app for alerts when it is closed.");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function leaveRoom() {
    setBusy(true);
    try {
      await leaveCurrentRoom(supabase, userId);
      await supabase.from("manager_contracts").update({ room_id: null }).eq("user_id", userId);
      setCode(null);
      setContract((c) => (c ? { ...c, room_id: null } : c));
      setNote({ key: "room", text: "You left the shared league. Your season continues on your own." });
    } catch {
      setNote({ key: "room", text: "Could not leave. Try again.", bad: true });
    }
    setConfirm("");
    setBusy(false);
  }

  async function resetCareer() {
    setBusy(true);
    try {
      await supabase.from("room_members").delete().eq("user_id", userId);
      for (const table of ["league_matches", "cup_matches", "transfers", "transfer_listings"]) {
        const { error } = await supabase.from(table).delete().eq("user_id", userId);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("manager_contracts")
        .update({ selected_league: null, selected_club: null, club_appointed_at: null, room_id: null })
        .eq("user_id", userId);
      if (error) throw error;
      try {
        Object.keys(localStorage).filter((k) => k.includes(userId) && /^gsm-(lineup|talks|watch)/.test(k)).forEach((k) => localStorage.removeItem(k));
      } catch { /* nothing to clear */ }
      router.replace("/game/leagues");
    } catch {
      setNote({ key: "reset", text: "Could not clear everything. Try again.", bad: true });
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Opening settings...</p>
      </main>
    );
  }

  const say = (key: string) => (note?.key === key ? <p className={`st-note ${note.bad ? "is-bad" : ""}`} role="status">{note.text}</p> : null);

  return (
    <main className="st">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="st-bg gx-kb" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="st-wrap">
        <header className="st-head">
          <p>Game options</p>
          <h1><span className="gx-slant">Settings</span></h1>
        </header>

        <section className="st-card gx-cut" style={{ "--i": 0 } as React.CSSProperties}>
          <h2>Matches</h2>
          <Switch on={s.press} onChange={(v) => set({ press: v })} label="Press conference before the match" note="Two journalists ask, you answer. Your words go to the social feed." />
          <Switch on={s.studio} onChange={(v) => set({ studio: v })} label="Studio before the match" note="The presenters talk about the match first." />
          <Switch on={s.voice} onChange={(v) => set({ voice: v })} label="Read the commentary aloud" note="Uses your browser's Arabic voice, if it has one." />
          <p className="st-label">Match speed</p>
          <Choice
            label="Match speed"
            value={s.speed}
            onChange={(v) => set({ speed: v })}
            options={[
              { id: "normal", name: "Full", note: "Every chance, with the commentator" },
              { id: "fast", name: "Quick", note: "Same match, about half the time" },
              { id: "instant", name: "Result only", note: "Straight to full time" },
            ]}
          />
        </section>

        <section className="st-card gx-cut" style={{ "--i": 1 } as React.CSSProperties}>
          <h2>Alerts</h2>
          <div className="st-row">
            <span>
              <strong>Kickoff alerts</strong>
              <small>
                {perm === "granted" ? "On. You hear when a matchday is ready, when the transfer market refreshes and when your club needs you. In the installed app they arrive even when the game is closed." : perm === "denied" ? "Blocked in your browser. Allow notifications for this site in the browser's site settings, then come back." : perm === "none" ? "This browser does not support notifications." : "Off. Turn them on to hear when a matchday kicks off."}
              </small>
            </span>
            {perm === "default" && <button type="button" className="st-btn" onClick={alerts}>Turn on</button>}
            {perm === "granted" && <em>On</em>}
          </div>
          <div className="st-row">
            <span>
              <strong>Test an alert</strong>
              <small>{alertTest || (alertMode() === "app" ? "Installed app detected." : "Running in a browser: alerts only show while the page is open.")}</small>
            </span>
            <button type="button" className="st-btn" onClick={testAlert}>Send test</button>
          </div>
        </section>

        <section className="st-card gx-cut" style={{ "--i": 2 } as React.CSSProperties}>
          <h2>Sound</h2>
          <Switch on={s.sound} onChange={(v) => { set({ sound: v }); if (v) setTimeout(() => sfx("confirm"), 80); }} label="Game sounds" note="Crowd, whistle, goals and button taps." />
          <Switch on={s.music} onChange={(v) => set({ music: v })} label="Background music" note="A calm stadium-evening loop. It steps back during matches." />
          <p className="st-label">Music volume</p>
          <Choice
            label="Music volume"
            value={s.musicVolume}
            onChange={(v) => set({ musicVolume: v })}
            options={[
              { id: "low", name: "Low", note: "Barely there" },
              { id: "mid", name: "Medium", note: "Balanced" },
              { id: "high", name: "High", note: "Full" },
            ]}
          />
          <p className="st-label">Sound volume</p>
          <Choice
            label="Volume"
            value={s.volume}
            onChange={(v) => { set({ volume: v }); setTimeout(() => sfx("goal"), 80); }}
            options={[
              { id: "low", name: "Low", note: "Quiet" },
              { id: "mid", name: "Medium", note: "Balanced" },
              { id: "high", name: "High", note: "Loud" },
            ]}
          />
        </section>

        <section className="st-card gx-cut" style={{ "--i": 2 } as React.CSSProperties}>
          <h2>Display</h2>
          <p className="st-label">Graphics</p>
          <Choice
            label="Graphics"
            value={s.perf}
            onChange={(v) => set({ perf: v })}
            options={[
              { id: "auto", name: "Auto", note: "Light on phones, full elsewhere" },
              { id: "lite", name: "Smooth", note: "Fewer effects, best for older phones" },
              { id: "full", name: "Full", note: "Blur, glow and moving backdrops" },
            ]}
          />
          <Switch on={s.calm} onChange={(v) => set({ calm: v })} label="Calm motion" note="Turns off most animation." />
          <Switch on={s.large} onChange={(v) => set({ large: v })} label="Larger text" />
        </section>

        <section className="st-card gx-cut" style={{ "--i": 3 } as React.CSSProperties}>
          <h2>Account</h2>
          <div className="st-row"><span><strong>{contract?.manager_name ?? "Manager"}</strong><small>{email}</small></span><button type="button" className="st-btn is-ghost" onClick={logout}>Log out</button></div>
          <form className="st-pw" onSubmit={(e) => { e.preventDefault(); changePassword(); }}>
            <p className="st-label">Change password</p>
            <input type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
            <input type="password" autoComplete="new-password" placeholder="Repeat it" aria-label="Repeat the new password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
            <button type="submit" className="st-btn" disabled={busy || !pw.a}>Save password</button>
            {say("pw")}
          </form>
        </section>

        <section className="st-card gx-cut" style={{ "--i": 4 } as React.CSSProperties}>
          <h2>Your career</h2>
          <div className="st-row">
            <span><strong>{club ? club.name : "No club yet"}</strong><small>{club ? "Your club this season" : "Pick a league and a club to start."}</small></span>
            <button type="button" className="st-btn" onClick={() => router.push(club ? "/game/fixtures" : "/game/leagues")}>{club ? "Match centre" : "Choose a club"}</button>
          </div>
          {code && (
            <div className="st-row">
              <span><strong>Shared league</strong><small>Code {code}. Friends join from the league screen.</small></span>
              {confirm !== "leave" ? (
                <button type="button" className="st-btn is-ghost" onClick={() => setConfirm("leave")}>Leave</button>
              ) : (
                <span className="st-confirm">
                  <button type="button" className="st-btn is-danger" disabled={busy} onClick={leaveRoom}>Yes, leave</button>
                  <button type="button" className="st-btn is-ghost" onClick={() => setConfirm("")}>No</button>
                </span>
              )}
            </div>
          )}
          {say("room")}
          <div className="st-row">
            <span><strong>Change league or club</strong><small>Move to another club. Matches you already played stay in your history.</small></span>
            <button type="button" className="st-btn is-ghost" onClick={() => router.push("/game/leagues")}>Change</button>
          </div>
        </section>

        <section className="st-card st-danger gx-cut" style={{ "--i": 5 } as React.CSSProperties}>
          <h2>Danger zone</h2>
          <div className="st-row">
            <span>
              <strong>Start again from zero</strong>
              <small>Deletes your matches, cup, transfers and balance, and sends you back to choose a club. Your trophies and profile stay.</small>
            </span>
            {confirm !== "reset" ? (
              <button type="button" className="st-btn is-danger" onClick={() => setConfirm("reset")}>Start again</button>
            ) : (
              <span className="st-confirm">
                <button type="button" className="st-btn is-danger" disabled={busy} onClick={resetCareer}>{busy ? "Clearing..." : "Yes, delete it"}</button>
                <button type="button" className="st-btn is-ghost" disabled={busy} onClick={() => setConfirm("")}>Cancel</button>
              </span>
            )}
          </div>
          {say("reset")}
        </section>
      </div>
    </main>
  );
}
