"use client";

import { MAX_CAREERS } from "@/lib/football/leagueIds";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { LEAGUES, leagueOf } from "@/lib/football/leaguesCatalog";
import { buildCabinet, type Win } from "@/lib/football/trophyCatalog";
import { careerStats, stashCareer, switchCareer, syncCareers, type Career } from "@/lib/football/careers";
import { MAX_LEVEL, levelOf, loadBadgeData, loadUnlocked, measure, progressOf, trainingBoost, xpForLevel, xpOf, type Progress } from "@/lib/football/badges";
import { seasonLabel } from "@/lib/football/season";
import FriendsPanel from "@/components/FriendsPanel";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./manager.css";

type Manager = { manager_name: string; avatar: string | null; selected_league: string | null; selected_club: string | null; room_id: string | null; club_appointed_at: string | null };

const clubOf = (id: string) => clubs.find((c) => c.id === id);
const ord = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]);

export default function ManagerPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [manager, setManager] = useState<Manager | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [wins, setWins] = useState<Win[]>([]);
  const [rows, setRows] = useState<Progress[]>([]);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadBadgeData>> | null>(null);
  const [xp, setXp] = useState(0);
  const [failed, setFailed] = useState("");
  const [cabTab, setCabTab] = useState("all");
  const [pick, setPick] = useState<{ league: string; kind: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/");
      const { data: m } = await supabase
        .from("manager_contracts")
        .select("manager_name, avatar, selected_league, selected_club, room_id, club_appointed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!m?.selected_club) return router.replace("/game/leagues");
      const careerRows = await syncCareers(supabase, user.id, m as Manager);
      const [badgeData, unlocked, won] = await Promise.all([
        loadBadgeData(supabase, user.id, m.selected_club),
        loadUnlocked(supabase, user.id),
        supabase.from("trophies").select("kind, season, club_id, league_id").eq("user_id", user.id),
      ]);
      const list = (won.data ?? []) as { kind: string; season: string; club_id: string | null; league_id?: string | null }[];
      setUid(user.id);
      setManager(m as Manager);
      setDraft((m as Manager).manager_name);
      setCareers(careerRows.length ? careerRows : [{ league_id: m.selected_league || "premier-league", club_id: m.selected_club, room_id: m.room_id ?? null, appointed_at: m.club_appointed_at ?? null }]);
      setWins(list.map((t) => ({ kind: t.kind, season: t.season, club_id: t.club_id, league_id: t.league_id || "premier-league" })));
      setData(badgeData);
      const progress = progressOf(measure(badgeData), unlocked);
      setRows(progress);
      setXp(xpOf(progress.filter((p) => p.done).map((p) => p.id)));
    } catch (err) {
      console.error("Manager page error:", err);
      setFailed("The manager page could not load. Please try again.");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const activeLeague = manager?.selected_league || "premier-league";
  const stats = useMemo(() => (data ? careerStats(data.matches, careers) : null), [data, careers]);
  const cabinet = useMemo(() => buildCabinet(wins, careers.map((c) => c.league_id)), [wins, careers]);
  const next = useMemo(() => rows.filter((r) => !r.done).sort((a, b) => b.ratio - a.ratio).slice(0, 3), [rows]);
  const recent = useMemo(() => rows.filter((r) => r.done).sort((a, b) => b.xp - a.xp).slice(0, 8), [rows]);

  if (!manager || !stats) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{failed || "Loading your manager page..."}</p>
      </main>
    );
  }

  const club = clubOf(manager.selected_club!);
  const league = leagueOf(activeLeague);
  const level = levelOf(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const pct = level >= MAX_LEVEL ? 100 : Math.round(((xp - from) / (to - from)) * 100);
  const doneCount = rows.filter((r) => r.done).length;
  const titles = wins.filter((w) => w.kind === "league").length;
  const cups = wins.filter((w) => w.kind !== "league" && w.kind !== "objective").length;
  const winRate = stats.totals.played ? Math.round((stats.totals.w / stats.totals.played) * 100) : 0;
  const bestFinish = stats.seasons.filter((s) => s.done).reduce((b, s) => Math.min(b, s.pos), 99);
  // up to four teams, in any league, also two in the same one
  const open = careers.length >= MAX_CAREERS ? [] : LEAGUES.filter((l) => l.available);
  const shown = cabTab === "all" ? cabinet : cabTab === "cups" ? cabinet.filter((c) => c.cup) : cabinet.filter((c) => c.leagueId === cabTab);
  const totalTrophies = wins.filter((w) => w.kind !== "objective").length;
  const picked = pick ? cabinet.find((c) => c.leagueId === pick.league)?.slots.find((s) => s.kind === pick.kind) : null;

  async function doSwitch(c: Career) {
    setBusy(c.league_id);
    setNote("");
    try {
      await switchCareer(supabase, uid, manager!, c);
      await load();
      setNote(`Now managing ${clubOf(c.club_id)?.name ?? c.club_id} in the ${leagueOf(c.league_id).name}.`);
    } catch {
      setNote("The switch did not save. Make sure supabase/012_careers_trophies.sql has been run.");
    } finally {
      setBusy("");
    }
  }

  async function addLeague() {
    setBusy("add");
    try {
      await stashCareer(supabase, uid, manager!);
      router.push("/game/leagues?add=1");
    } catch {
      setNote("Could not start. Make sure supabase/012_careers_trophies.sql has been run.");
      setBusy("");
    }
  }

  async function saveProfile() {
    const clean = draft.trim();
    if (clean.length < 2) return setNote("The name needs at least 2 letters.");
    setBusy("save");
    try {
      let avatar = manager!.avatar;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${uid}/${Date.now()}.${ext}`;
        const { error: up } = await supabase.storage.from("manager-avatars").upload(path, file, { contentType: file.type, upsert: false });
        if (up) throw up;
        avatar = supabase.storage.from("manager-avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("manager_contracts").update({ manager_name: clean, avatar, updated_at: new Date().toISOString() }).eq("user_id", uid);
      if (error) throw error;
      setManager({ ...manager!, manager_name: clean, avatar });
      setFile(null);
      setPreview("");
      setEditing(false);
      setNote("Profile saved.");
    } catch {
      setNote("Could not save. Please try again.");
    } finally {
      setBusy("");
    }
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) return setNote("Choose an image under 5 MB.");
    setFile(f);
  }

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const face = preview || manager.avatar;

  return (
    <main className="mgr" style={{ "--lc": league.color, "--lc2": league.color2 } as CSSProperties}>
      <div className="gx-curtain" aria-hidden="true" />
      <div className="mgr-bg gx-kb" aria-hidden="true" />
      <div className="mgr-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="mgr-wrap">
        {/* hero */}
        <section className="mgr-hero">
          <div className="mgr-face">
            {face ? <img src={face} alt="" /> : <span>{manager.manager_name.slice(0, 1).toUpperCase()}</span>}
            <button type="button" onClick={() => { setEditing(true); go("mgr-edit"); }} aria-label="Edit your photo and name"><Icon name="pen" size={16} /></button>
          </div>
          <div className="mgr-who">
            <p>Manager profile</p>
            <h1><span className="gx-slant">{manager.manager_name}</span></h1>
            <div className="mgr-at">
              {club && <img src={club.logo} alt="" />}
              <span>
                <b>{club?.name ?? manager.selected_club}</b>
                <small>{league.name}{league.country ? ` · ${league.country}` : ""}</small>
              </span>
            </div>
          </div>
          <Link href="/game/achievements" className="mgr-level" aria-label={`Coach level ${level}. Open achievements`}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" className="bg" />
              <circle cx="60" cy="60" r="52" className="fg" strokeDasharray={`${(pct / 100) * 326.7} 326.7`} />
            </svg>
            <b>{level}</b>
            <small>Coach level</small>
            <em>{doneCount} of {rows.length} achievements · training +{Math.round((trainingBoost(level) - 1) * 100)}%</em>
          </Link>
        </section>

        <nav className="mgr-nav" aria-label="Sections">
          {[["mgr-trophies", "Trophy room"], ["mgr-careers", "Careers"], ["mgr-history", "History"], ["mgr-ach", "Achievements"], ["mgr-friends", "Friends"], ["mgr-edit", "Edit profile"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => go(id)}>{label}</button>
          ))}
        </nav>

        {note && <p className="mgr-note" role="status">{note}</p>}

        <ul className="mgr-stats">
          {[
            [stats.seasons.filter((s) => s.done).length, "Seasons"],
            [stats.totals.played, "Matches"],
            [`${winRate}%`, "Win rate"],
            [stats.totals.gf, "Goals"],
            [titles, "Titles"],
            [bestFinish === 99 ? "-" : `${bestFinish}${ord(bestFinish)}`, "Best finish"],
          ].map(([v, l], i) => (
            <li key={l as string} style={{ animationDelay: `${i * 60}ms` }}><b>{v}</b><span>{l}</span></li>
          ))}
        </ul>

        {/* trophy room */}
        <section id="mgr-trophies" className="mgr-sec">
          <header className="mgr-sh">
            <div><p>Your cabinet</p><h2>Trophy room</h2></div>
            <span className="mgr-total"><b>{totalTrophies}</b> trophies</span>
          </header>
          <div className="mgr-tabs" role="tablist" aria-label="Leagues">
            <button type="button" role="tab" aria-selected={cabTab === "all"} onClick={() => setCabTab("all")}>All</button>
            {cabinet.filter((c) => !c.cup).map((c) => (
              <button key={c.leagueId} type="button" role="tab" aria-selected={cabTab === c.leagueId} onClick={() => setCabTab(c.leagueId)}>
                {leagueOf(c.leagueId).logo && <img src={leagueOf(c.leagueId).logo} alt="" />}{leagueOf(c.leagueId).name}
              </button>
            ))}
            <button type="button" role="tab" aria-selected={cabTab === "cups"} onClick={() => setCabTab("cups")}>Cups</button>
          </div>

          {shown.map((c) => {
            const l = leagueOf(c.leagueId);
            const big = c.slots.filter((s) => !s.small);
            const small = c.slots.filter((s) => s.small);
            const won = c.slots.reduce((n, s) => n + s.wins.length, 0);
            return (
              <article key={c.leagueId} className="mgr-cab" style={{ "--c1": l.color, "--c2": l.color2 } as CSSProperties}>
                <header>
                  {l.logo && <img src={l.logo} alt="" />}
                  <div><strong>{l.name}</strong><small>{won ? `${won} won here` : c.cup && !l.available ? "Coming soon" : l.available ? "Nothing won yet" : "Coming soon"}</small></div>
                </header>
                <div className="mgr-glass">
                  <div className="mgr-row">
                    {big.map((s) => (
                      <button key={s.kind} type="button" className={`mgr-trophy ${s.wins.length ? "is-won" : "is-locked"} ${pick?.league === c.leagueId && pick.kind === s.kind ? "is-on" : ""}`} onClick={() => setPick(pick?.league === c.leagueId && pick.kind === s.kind ? null : { league: c.leagueId, kind: s.kind })} aria-pressed={pick?.league === c.leagueId && pick.kind === s.kind}>
                        <span className="mgr-lamp" aria-hidden="true" />
                        <img src={s.image} alt="" loading="lazy" />
                        <strong>{s.title}</strong>
                        <em>{s.wins.length ? `x${s.wins.length}` : s.soon ? "Coming soon" : "Not yet"}</em>
                      </button>
                    ))}
                  </div>
                  <div className="mgr-plank" aria-hidden="true" />
                  {small.length > 0 && (
                    <div className="mgr-row is-small">
                      {small.map((s) => (
                        <button key={s.kind} type="button" className={`mgr-trophy ${s.wins.length ? "is-won" : "is-locked"} ${pick?.league === c.leagueId && pick.kind === s.kind ? "is-on" : ""}`} onClick={() => setPick(pick?.league === c.leagueId && pick.kind === s.kind ? null : { league: c.leagueId, kind: s.kind })} aria-pressed={pick?.league === c.leagueId && pick.kind === s.kind}>
                          <img src={s.image} alt="" loading="lazy" />
                          <strong>{s.title}</strong>
                          <em>{s.wins.length ? `x${s.wins.length}` : s.soon ? "Coming soon" : "Not yet"}</em>
                        </button>
                      ))}
                    </div>
                  )}
                  {small.length > 0 && <div className="mgr-plank" aria-hidden="true" />}
                </div>
                {picked && pick?.league === c.leagueId && (
                  <div className="mgr-detail">
                    <h3>{picked.title}</h3>
                    <p>{picked.note}</p>
                    {picked.wins.length ? (
                      <ul>
                        {picked.wins.map((w) => (
                          <li key={w.season}>{clubOf(w.club_id ?? "") && <img src={clubOf(w.club_id ?? "")!.logo} alt="" />}<b>{seasonLabel(w.season)}</b><span>{clubOf(w.club_id ?? "")?.name ?? ""}</span></li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mgr-empty">Not won yet. It goes on the shelf as soon as you lift it.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {cabTab === "all" && LEAGUES.some((l) => !l.available && !cabinet.some((c) => c.leagueId === l.id)) && (
            <p className="mgr-soon">More cabinets are on the way: {LEAGUES.filter((l) => !l.available && !cabinet.some((c) => c.leagueId === l.id)).map((l) => l.name).join(", ")}.</p>
          )}
          {cups > 0 && <p className="mgr-soon">{cups} cup {cups === 1 ? "win" : "wins"} so far. Every new cup you add to the game gets its own place on the shelf.</p>}
        </section>

        {/* careers */}
        <section id="mgr-careers" className="mgr-sec">
          <header className="mgr-sh"><div><p>Run more than one</p><h2>Careers</h2></div></header>
          <ul className="mgr-careers">
            {careers.map((c) => {
              const l = leagueOf(c.league_id);
              const cl = clubOf(c.club_id);
              const active = c.league_id === activeLeague;
              const t = wins.filter((w) => w.league_id === c.league_id && w.kind === "league").length;
              const seasons = stats.seasons.filter((s) => s.league_id === c.league_id && s.done).length;
              return (
                <li key={c.league_id} className={active ? "is-active" : ""} style={{ "--c1": l.color, "--c2": l.color2 } as CSSProperties}>
                  {l.logo && <img className="mgr-cl" src={l.logo} alt="" />}
                  <div className="mgr-cc">
                    {cl && <img src={cl.logo} alt="" />}
                    <div><strong>{cl?.name ?? c.club_id}</strong><small>{l.name}</small></div>
                  </div>
                  <p><b>{seasons}</b> seasons <b>{t}</b> titles</p>
                  {active ? <span className="mgr-badge">Active now</span> : <button type="button" className="gx-btn" disabled={!!busy} onClick={() => doSwitch(c)}>{busy === c.league_id ? "Switching..." : "Switch to this league"}</button>}
                </li>
              );
            })}
            <li className="mgr-add">
              <Icon name="flag" size={28} />
              <strong>Add another league</strong>
              <small>{open.length ? "Pick a league and a club. Every team keeps its own seasons, table, squad and trophies." : `You manage ${MAX_CAREERS} teams, the most you can have. Resign from one to start another.`}</small>
              <button type="button" className="gx-btn" disabled={!open.length || !!busy} onClick={addLeague}>{busy === "add" ? "Opening..." : open.length ? "Add a team" : "Full"}</button>
            </li>
          </ul>
        </section>

        {/* history */}
        <section id="mgr-history" className="mgr-sec">
          <header className="mgr-sh"><div><p>Season by season</p><h2>History</h2></div></header>
          {stats.seasons.length ? (
            <div className="mgr-table" role="table" aria-label="Season history">
              <div className="mgr-th" role="row"><span>Season</span><span>Club</span><span>Pos</span><span>W</span><span>D</span><span>L</span><span>GF-GA</span><span>Pts</span></div>
              {stats.seasons.map((s, i) => {
                const cl = clubOf(s.club);
                return (
                  <div key={`${s.league_id}|${s.season}`} role="row" className={`mgr-tr ${s.done && s.pos === 1 ? "is-champ" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                    <span><b>{seasonLabel(s.season)}</b><small>{leagueOf(s.league_id).name}{s.done ? "" : " · in progress"}</small></span>
                    <span className="mgr-hc">{cl && <img src={cl.logo} alt="" />}{cl?.name ?? s.club}</span>
                    <span className="mgr-pos">{s.pos}{ord(s.pos)}</span>
                    <span>{s.w}</span><span>{s.d}</span><span>{s.l}</span><span>{s.gf}-{s.ga}</span><span><b>{s.pts}</b></span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mgr-empty">Your seasons will be listed here once you play some matches.</p>
          )}
        </section>

        {/* achievements */}
        <section id="mgr-ach" className="mgr-sec">
          <header className="mgr-sh">
            <div><p>Earn coach levels</p><h2>Achievements</h2></div>
            <Link href="/game/achievements" className="mgr-more">See all {rows.length} <Icon name="arrow-right" size={16} /></Link>
          </header>
          <div className="mgr-ach">
            <div>
              <h3>Next up</h3>
              <ul className="mgr-next">
                {next.map((r) => (
                  <li key={r.id} className={`t-${r.tier}`}>
                    <span aria-hidden="true">{r.icon}</span>
                    <div><strong>{r.name}</strong><small>{r.desc}</small><i><em style={{ width: `${Math.round(r.ratio * 100)}%` }} /></i></div>
                    <b>{r.value}/{r.target}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Your best</h3>
              <ul className="mgr-medals">
                {recent.length ? recent.map((r) => <li key={r.id} className={`t-${r.tier}`} title={`${r.name}: ${r.desc}`}><span>{r.icon}</span></li>) : <li className="mgr-empty">Nothing unlocked yet.</li>}
              </ul>
            </div>
          </div>
        </section>

        <section id="mgr-friends" className="mgr-sec">
          <header className="mgr-sh"><div><p>Play together</p><h2>Friends</h2></div></header>
          <FriendsPanel userId={uid} />
        </section>

        <section id="mgr-edit" className="mgr-sec">
          <header className="mgr-sh"><div><p>Your details</p><h2>Edit profile</h2></div></header>
          <div className="mgr-edit">
            <label className="mgr-photo">
              {face ? <img src={face} alt="Your photo" /> : <span>GSM</span>}
              <i><Icon name="upload" size={16} /> Change</i>
              <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            <div className="mgr-field">
              <label htmlFor="mgr-name">Manager name</label>
              <input id="mgr-name" value={draft} maxLength={40} onChange={(e) => { setDraft(e.target.value); setEditing(true); }} />
              <button type="button" className="gx-btn" onClick={saveProfile} disabled={busy === "save" || (!file && draft.trim() === manager.manager_name)}>{busy === "save" ? "Saving..." : "Save changes"}</button>
              {editing && <small>Your name and photo show to your friends and in rooms.</small>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
