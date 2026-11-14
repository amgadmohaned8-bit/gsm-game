
"use client";

import { egyptClubs } from "@/lib/football/egypt";
import { africanClubs, isCafCup } from "@/lib/football/africa";
import { saveContSetup } from "@/lib/football/continental";
import { activeSeason } from "@/lib/football/season";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./final-contract.css";

type Club = {
  id: string;
  name: string;
  city: string;
  stadium: string;
  logo: string;
};

type ManagerContract = {
  manager_name: string;
  avatar: string | null;
  experience: string;
  signature_data: string;
  signed_at: string;
};

const premierClubs: Record<string, Club> = {
  arsenal: {
    id: "arsenal", name: "Arsenal", city: "London",
    stadium: "Emirates Stadium", logo: "/club-logos/arsenal.png",
  },
  "aston-villa": {
    id: "aston-villa", name: "Aston Villa", city: "Birmingham",
    stadium: "Villa Park", logo: "/club-logos/aston-villa.png",
  },
  bournemouth: {
    id: "bournemouth", name: "Bournemouth", city: "Bournemouth",
    stadium: "Vitality Stadium", logo: "/club-logos/bournemouth.png",
  },
  brentford: {
    id: "brentford", name: "Brentford", city: "London",
    stadium: "Gtech Community Stadium", logo: "/club-logos/brentford.png",
  },
  brighton: {
    id: "brighton", name: "Brighton", city: "Brighton",
    stadium: "Amex Stadium", logo: "/club-logos/brighton.png",
  },
  chelsea: {
    id: "chelsea", name: "Chelsea", city: "London",
    stadium: "Stamford Bridge", logo: "/club-logos/chelsea.png",
  },
  coventry: {
    id: "coventry", name: "Coventry City", city: "Coventry",
    stadium: "Coventry Building Society Arena", logo: "/club-logos/coventry.png",
  },
  "crystal-palace": {
    id: "crystal-palace", name: "Crystal Palace", city: "London",
    stadium: "Selhurst Park", logo: "/club-logos/crystal-palace.png",
  },
  everton: {
    id: "everton", name: "Everton", city: "Liverpool",
    stadium: "Hill Dickinson Stadium", logo: "/club-logos/everton.png",
  },
  fulham: {
    id: "fulham", name: "Fulham", city: "London",
    stadium: "Craven Cottage", logo: "/club-logos/fulham.png",
  },
  "hull-city": {
    id: "hull-city", name: "Hull City", city: "Hull",
    stadium: "MKM Stadium", logo: "/club-logos/hull-city.png",
  },
  ipswich: {
    id: "ipswich", name: "Ipswich Town", city: "Ipswich",
    stadium: "Portman Road", logo: "/club-logos/ipswich.png",
  },
  leeds: {
    id: "leeds", name: "Leeds United", city: "Leeds",
    stadium: "Elland Road", logo: "/club-logos/leeds.png",
  },
  liverpool: {
    id: "liverpool", name: "Liverpool", city: "Liverpool",
    stadium: "Anfield", logo: "/club-logos/liverpool.png",
  },
  "man-city": {
    id: "man-city", name: "Manchester City", city: "Manchester",
    stadium: "Etihad Stadium", logo: "/club-logos/man-city.png",
  },
  "man-united": {
    id: "man-united", name: "Manchester United", city: "Manchester",
    stadium: "Old Trafford", logo: "/club-logos/man-united.png",
  },
  newcastle: {
    id: "newcastle", name: "Newcastle United", city: "Newcastle",
    stadium: "St James' Park", logo: "/club-logos/newcastle.png",
  },
  "nottingham-forest": {
    id: "nottingham-forest", name: "Nottingham Forest", city: "Nottingham",
    stadium: "City Ground", logo: "/club-logos/nottingham-forest.png",
  },
  sunderland: {
    id: "sunderland", name: "Sunderland", city: "Sunderland",
    stadium: "Stadium of Light", logo: "/club-logos/sunderland.png",
  },
  tottenham: {
    id: "tottenham", name: "Tottenham Hotspur", city: "London",
    stadium: "Tottenham Hotspur Stadium", logo: "/club-logos/tottenham.png",
  },
};

const clubs: Record<string, Club> = { ...premierClubs, ...Object.fromEntries(egyptClubs.map((c) => [c.id, c])), ...Object.fromEntries(africanClubs.map((c) => [c.id, c])) };

const experienceTitles: Record<string, string> = {
  C: "Beginner Coach",
  B: "Professional Coach",
  A: "Elite Coach",
};

const leagueTitles: Record<string, string> = {
  "premier-league": "Premier League",
  "egyptian-premier-league": "Egyptian Premier League",
  "caf-champions-league": "CAF Champions League",
  "caf-confederation-cup": "CAF Confederation Cup",
  "la-liga": "La Liga",
  "serie-a": "Serie A",
  bundesliga: "Bundesliga",
};

export default function FinalContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const clubId = searchParams.get("club");
  const leagueId = searchParams.get("league") || "premier-league";

  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<ManagerContract | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [league, setLeague] = useState("premier-league");
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setConfirmed(false);
      setClub(null);

      try {
        const selectedClub = clubId ? clubs[clubId] : null;

        setLeague(leagueId);

        if (!selectedClub) {
          router.replace(`/game/team-selection?league=${leagueId}`);
          return;
        }

        setClub(selectedClub);

        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/");
          return;
        }

        const { data, error } = await supabase
          .from("manager_contracts")
          .select(
            "manager_name, avatar, experience, signature_data, signed_at, selected_league, selected_club, club_appointed_at"
          )
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (error) throw error;

        if (!data?.signed_at || !data?.signature_data) {
          router.replace("/game/contract");
          return;
        }

        if (cancelled) return;

        setManager(data as ManagerContract);

        const alreadyConfirmed =
          data.selected_club === selectedClub.id &&
          data.selected_league === leagueId &&
          !!data.club_appointed_at;

        setConfirmed(alreadyConfirmed);
      } catch (error) {
        console.error("Contract loading error:", error);
        if (!cancelled) {
          alert("Could not load your contract.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [router, clubId, leagueId]);

  function goBack() {
    router.push(`/game/team-selection?league=${league}`);
  }

  async function confirmAppointment() {
    if (!club || saving) return;

    // لا تمنع التأكيد إلا إذا كان النادي الحالي هو نفسه المعتمد بالفعل.
    if (confirmed) return;

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/");
        return;
      }

      const { data: saved, error } = await supabase
        .from("manager_contracts")
        .update({
          selected_league: league,
          selected_club: club.id,
          club_appointed_at: new Date().toISOString(),
        })
        .eq("user_id", authData.user.id)
        .select("selected_club");

      if (error) throw error;

      // an update that touched no row would send you back to the start next time
      if (!saved || saved.length === 0 || saved[0].selected_club !== club.id) {
        throw new Error("Your club was not saved. Check the update policy on manager_contracts.");
      }

      if (isCafCup(league)) {
        // a stand-alone continental career: the cup itself, with the Egyptian clubs picked earlier
        const season = await activeSeason(supabase, authData.user.id, league);
        const egypt = (searchParams.get("egypt") || "").split(",").filter(Boolean);
        await saveContSetup(supabase, authData.user.id, { comp_id: league, season, club_id: club.id, egypt, source: "standalone" });
        setConfirmed(true);
        router.push("/game/continental");
        return;
      }

      setConfirmed(true);
      router.push("/game/dashboard");
    } catch (error) {
      console.error("Appointment error:", error);
      alert("Could not confirm your club appointment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="appointment-loading">
        PREPARING YOUR APPOINTMENT...
      </main>
    );
  }

  if (!manager || !club) return null;

  return (
    <main className="appointment-page">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="ct-bg gx-kb" aria-hidden="true" />
      <GameHud step={4} onBack={() => router.back()} />

      <section className="appointment-container">
        <div className="appointment-heading">
          <span>YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>THE FINAL APPOINTMENT</h1>
          <p>Review your manager contract and confirm your new club.</p>
        </div>

        <div className="appointment-grid">
          <article className="mini-contract">
            <div className="mini-contract-top">
              <span className="mini-gsm-seal">
                <GsmMark size={30} />
              </span>
              <div className="mini-contract-heading">
                <strong>GLOBAL SOCCER MANAGER</strong>
                <span>OFFICIAL DOCUMENT</span>
              </div>
              <span className="mini-contract-year">2026</span>
            </div>

            <div className="mini-contract-rule" />

            <div className="mini-contract-title">
              <span>MANAGER REGISTRATION</span>
              <h2>OFFICIAL CONTRACT</h2>
              <p>Manager Appointment Certificate</p>
            </div>

            <div className="mini-manager">
              {manager.avatar ? (
                <img src={manager.avatar} alt="Manager" />
              ) : (
                <div className="mini-avatar-placeholder">GSM</div>
              )}

              <div>
                <span>MANAGER NAME</span>
                <strong>{manager.manager_name}</strong>
                <small>HEAD COACH</small>
              </div>
            </div>

            <div className="mini-contract-fields">
              <div>
                <span>EXPERIENCE LEVEL</span>
                <strong>
                  {manager.experience} —{" "}
                  {experienceTitles[manager.experience] || "Manager"}
                </strong>
              </div>
              <div>
                <span>CONTRACT NUMBER</span>
                <strong>GSM-2026</strong>
              </div>
            </div>

            <div className="mini-signature-area">
              <span>REGISTERED SIGNATURE</span>
              <img
                src={manager.signature_data}
                alt="Original manager signature"
              />
              <div className="mini-signature-line" />
              <small>ORIGINAL SIGNATURE · VERIFIED</small>
            </div>

            <div className="mini-contract-footer">
              <span>GSM OFFICIAL</span>
              <span>2026 / 2027</span>
            </div>
          </article>

          <article className="club-appointment-card">
            <div className="club-card-label">YOUR SELECTED CLUB</div>

            <div className="club-logo-frame">
              <img src={club.logo} alt={`${club.name} logo`} />
            </div>

            <span className="club-appointed-label">MANAGER APPOINTMENT</span>
            <h2>{club.name}</h2>
            <p className="club-city">{club.city}{league === "premier-league" ? ", England" : league === "egyptian-premier-league" ? ", Egypt" : ""}</p>

            <div className="club-info-list">
              <div>
                <span>COMPETITION</span>
                <strong>{leagueTitles[league] || league}</strong>
              </div>
              <div>
                <span>HOME STADIUM</span>
                <strong>{club.stadium}</strong>
              </div>
              <div>
                <span>SEASON</span>
                <strong>2026 / 2027</strong>
              </div>
            </div>

            <div className="club-card-bottom">
              <span>YOUR CLUB. YOUR LEGACY.</span>
              <span>GSM</span>
            </div>
          </article>
        </div>

        <section className="appointment-sign-area">
          <div className="appointment-sign-copy">
            <span>FINAL STEP</span>
            <h2>
              {confirmed
                ? "APPOINTMENT CONFIRMED"
                : "SIGN YOUR CLUB APPOINTMENT"}
            </h2>
            <p>
              {confirmed
                ? `Your appointment as manager of ${club.name} has been saved.`
                : "Your original manager signature will remain unchanged. Confirm your appointment with this club."}
            </p>
          </div>

          <button
            type="button"
            className="appointment-confirm-button"
            onClick={confirmAppointment}
            disabled={saving || confirmed}
          >
            {saving
              ? "CONFIRMING..."
              : confirmed
                ? "APPOINTMENT CONFIRMED"
                : "SIGN & CONFIRM APPOINTMENT"}
          </button>

          <button
            type="button"
            className="appointment-back-button"
            onClick={goBack}
          >
            <Icon name="arrow-left" size={16} />
            BACK TO CLUB SELECTION
          </button>
        </section>

        <footer className="appointment-footer">
          <span>GLOBAL SOCCER MANAGER</span>
          <span>OFFICIAL MANAGER APPOINTMENT · 2026</span>
        </footer>
      </section>
    </main>
  );
}
