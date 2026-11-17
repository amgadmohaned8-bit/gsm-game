"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { seasonLabel } from "@/lib/football/season";
import { leagueOf } from "@/lib/football/leaguesCatalog";
import { isCafCup } from "@/lib/football/africa";
import { fetchEuroSetups, isEuroComp } from "@/lib/football/europe";
import { EGYPT_LEAGUE, fetchContSetup, qualifyFromLeague } from "@/lib/football/continental";
import { careerStats, stashCareer, switchCareer, syncCareers, type Career } from "@/lib/football/careers";
import GsmMark from "@/components/GsmMark";
import Icon from "@/components/Icon";
import "./myteams.css";

type Manager = { manager_name?: string | null; selected_club: string | null; selected_league: string | null; room_id?: string | null; club_appointed_at?: string | null };
type Slot = { key: string; comp: string; club: string; kind: "league" | "cup" | "qualified"; status: string; career: Career };

const MAX = 4;
const clubOf = (id: string) => clubs.find((c) => c.id === id);

export default function MyTeamsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uid, setUid] = useState("");
  const [manager, setManager] = useState<Manager | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/"); return; }
        const { data: contract } = await supabase.from("manager_contracts").select("manager_name, selected_club, selected_league, room_id, club_appointed_at").eq("user_id", user.id).maybeSingle();
        if (!contract?.selected_club) { router.replace("/game/leagues"); return; }
        const careers = await syncCareers(supabase, user.id, contract);
        const { data: ms } = await supabase.from("league_matches").select("league_id, season, home_club, away_club, home_score, away_score, status").eq("user_id", user.id);
        const stats = careerStats((ms ?? []) as never[], careers);

        const list: Slot[] = [];
        for (const c of careers) {
          if (isEuroComp(c.league_id)) {
            let status = "European cup";
            try {
              const s = (await fetchEuroSetups(supabase, user.id)).find((x) => x.comp_id === c.league_id);
              if (s) status = `Season ${seasonLabel(s.season)}`;
            } catch { /* table missing: still show the slot */ }
            list.push({ key: c.league_id, comp: c.league_id, club: c.club_id, kind: "cup", status, career: c });
            continue;
          }
          if (isCafCup(c.league_id)) {
            let status = "Continental cup";
            try {
              const s = await fetchContSetup(supabase, user.id, c.league_id);
              if (s) status = `Season ${seasonLabel(s.season)}`;
            } catch { /* table missing: still show the slot */ }
            list.push({ key: c.league_id, comp: c.league_id, club: c.club_id, kind: "cup", status, career: c });
            continue;
          }
          const last = stats.seasons.find((r) => r.league_id === c.league_id);
          const status = last ? (last.done ? `${seasonLabel(last.season)} · finished ${ord(last.pos)}` : `${seasonLabel(last.season)} · ${ord(last.pos)} of ${last.teams}`) : "New career";
          list.push({ key: c.league_id, comp: c.league_id, club: c.club_id, kind: "league", status, career: c });
        }
        // clubs that finished in the Egyptian top four get a continental slot of their own
        for (const c of careers.filter((x) => x.league_id === EGYPT_LEAGUE)) {
          try {
            const q = await qualifyFromLeague(supabase, user.id, c.club_id);
            const s = q[q.length - 1];
            if (s && !list.some((x) => x.comp === s.comp_id)) {
              list.push({ key: `q-${s.comp_id}`, comp: s.comp_id, club: c.club_id, kind: "qualified", status: `Qualified · ${seasonLabel(s.season)}`, career: c });
            }
          } catch { /* shows up next visit */ }
        }

        if (off) return;
        setUid(user.id);
        setManager(contract as Manager);
        setSlots(list.slice(0, MAX));
      } catch (err) {
        console.error("My teams load error:", err);
        if (!off) setError("Could not load your teams. Check your connection and try again.");
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [router]);

  async function enter(s: Slot) {
    if (busy || !manager) return;
    setBusy(s.key);
    setError("");
    try {
      const active = manager.selected_league === s.career.league_id && manager.selected_club === s.career.club_id;
      if (!active) await switchCareer(supabase, uid, manager, s.career);
      router.push(s.kind === "league" ? "/game/dashboard" : isEuroComp(s.comp) ? "/game/europe" : "/game/continental");
    } catch {
      setError("Could not open that team. Try again.");
      setBusy("");
    }
  }

  async function add() {
    if (busy || !manager) return;
    setBusy("add");
    try {
      await stashCareer(supabase, uid, manager as never);
      router.push("/game/leagues?add=1");
    } catch {
      setError("Could not start. Try again.");
      setBusy("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const empty = Math.max(0, MAX - slots.length);

  return (
    <main className="mt">
      <div className="mt-bg" aria-hidden="true" />
      <header className="mt-top">
        <span className="mt-brand"><GsmMark size={34} /><b>GSM</b></span>
        <div className="mt-top-r">
          <button type="button" onClick={() => router.push("/game/manager")}><Icon name="user" size={18} /><span>Profile</span></button>
          <button type="button" onClick={signOut}><Icon name="logout" size={18} /><span>Sign out</span></button>
        </div>
      </header>

      <section className="mt-stage">
        <div className="mt-title">
          <p>Welcome back{manager?.manager_name ? `, ${manager.manager_name}` : ""}</p>
          <h1>My teams</h1>
        </div>

        {loading ? (
          <div className="mt-grid" aria-busy="true">
            {Array.from({ length: MAX }).map((_, i) => <div key={i} className="mt-slot mt-skel" />)}
          </div>
        ) : (
          <div className="mt-grid">
            {slots.map((s, i) => {
              const l = leagueOf(s.comp);
              const club = clubOf(s.club);
              const active = manager?.selected_league === s.career.league_id && manager?.selected_club === s.career.club_id;
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`mt-slot ${s.kind !== "league" ? "is-cup" : ""} ${active ? "is-active" : ""}`}
                  style={{ "--c1": l.color, "--c2": l.color2, "--i": i } as React.CSSProperties}
                  onClick={() => enter(s)}
                  disabled={!!busy}
                >
                  <img className="mt-comp" src={l.logo} alt="" />
                  <span className="mt-kind">{s.kind === "league" ? "League" : "Continental"}</span>
                  <span className="mt-crest">{club?.logo ? <img src={club.logo} alt="" /> : <b>{(club?.name ?? s.club).slice(0, 2)}</b>}</span>
                  <strong className="mt-club">{club?.name ?? s.club}</strong>
                  <span className="mt-league">{l.name}</span>
                  <span className="mt-status">{s.status}</span>
                  <span className="mt-go">{busy === s.key ? "Opening…" : "Enter"} <Icon name="check" size={16} /></span>
                </button>
              );
            })}
            {Array.from({ length: empty }).map((_, i) => (
              <button key={`e${i}`} type="button" className="mt-slot mt-add" style={{ "--i": slots.length + i } as React.CSSProperties} onClick={add} disabled={!!busy}>
                <span className="mt-plus">+</span>
                <strong>Add a team</strong>
                <span className="mt-league">Pick a league or a cup and a club</span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-err" role="alert">{error}</p>}
      </section>
    </main>
  );
}

function ord(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
