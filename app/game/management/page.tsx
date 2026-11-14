
"use client";

import { resetCareerData } from "@/lib/football/careerReset";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { activeSeason } from "@/lib/football/season";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { calculateStandings, type Match } from "@/lib/football/table";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./management.css";


type ManagerData = {
  manager_name: string;
  selected_club: string;
  selected_league: string;
};

type LeagueMatch = Match & {
  user_id: string;
  league_id: string;
  season: string;
  matchday: number;
  played_at: string | null;
};

type Dialogue = {
  title: string;
  text: string;
  mood: "normal" | "angry" | "happy" | "serious";
  label: string;
};

export default function ManagementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [resignModal, setResignModal] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [resignError, setResignError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadManagement() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/");
          return;
        }

        const { data: contract, error: contractError } = await supabase
          .from("manager_contracts")
          .select("manager_name, selected_club, selected_league")
          .eq("user_id", user.id)
          .maybeSingle();

        if (contractError) throw contractError;

        if (!contract?.selected_club || !contract?.selected_league) {
          router.replace("/game/leagues");
          return;
        }

        const season = await activeSeason(supabase, user.id, contract.selected_league);

        const { data: matchData, error: matchesError } = await supabase
          .from("league_matches")
          .select("*")
          .eq("user_id", user.id)
          .eq("league_id", contract.selected_league)
          .eq("season", season)
          .order("matchday", { ascending: true });

        if (matchesError) throw matchesError;

        if (!cancelled) {
          setManager(contract as ManagerData);
          setMatches((matchData ?? []) as LeagueMatch[]);
        }
      } catch (err) {
        console.error("Management loading error:", err);

        if (!cancelled) {
          setError("تعذر تحميل بيانات الإدارة. حاول تحديث الصفحة.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadManagement();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const club = clubs.find(
    (item) => item.id === manager?.selected_club
  );

  const standings = useMemo(
    () => calculateStandings(matches),
    [matches]
  );

  const managerStanding = standings.findIndex(
    (item) => item.clubId === manager?.selected_club
  );

  const position =
    managerStanding >= 0 ? managerStanding + 1 : null;

  const completedMatches = matches
    .filter(
      (match) =>
        match.status === "completed" &&
        match.home_score !== null &&
        match.away_score !== null &&
        (match.home_club === manager?.selected_club ||
          match.away_club === manager?.selected_club)
    )
    .sort((a, b) => b.matchday - a.matchday);

  const latestMatch = completedMatches[0];

  const matchResult = latestMatch
    ? (() => {
        const isHome =
          latestMatch.home_club === manager?.selected_club;

        const myGoals = isHome
          ? latestMatch.home_score!
          : latestMatch.away_score!;

        const opponentGoals = isHome
          ? latestMatch.away_score!
          : latestMatch.home_score!;

        return {
          myGoals,
          opponentGoals,
          result:
            myGoals > opponentGoals
              ? "win"
              : myGoals < opponentGoals
                ? "loss"
                : "draw",
          matchday: latestMatch.matchday,
        };
      })()
    : null;

  const totalMatchdays = Math.max(
    1,
    (standings.length - 1) * 2
  );

  const currentMatchday = Math.max(
    0,
    ...matches.map((match) => match.matchday)
  );

  const seasonProgress = currentMatchday / totalMatchdays;

  const seasonStage =
    seasonProgress >= 0.9
      ? "end"
      : seasonProgress >= 0.45
        ? "middle"
        : "start";

  const recentResults = completedMatches.slice(0, 5).map((match) => {
    const isHome = match.home_club === manager?.selected_club;

    const goalsFor = isHome
      ? match.home_score!
      : match.away_score!;

    const goalsAgainst = isHome
      ? match.away_score!
      : match.home_score!;

    return goalsFor > goalsAgainst
      ? "win"
      : goalsFor < goalsAgainst
        ? "loss"
        : "draw";
  });

  const losses = recentResults.filter((result) => result === "loss").length;

  const badForm = losses >= 3 || (position !== null && position > 10);

  // Short and about the current round only. When the last line is read,
  // the next click starts again from the first one.
  const dialogues = useMemo<Dialogue[]>(() => {
    if (!manager || !club) return [];

    if (!matchResult) {
      return [
        {
          title: "Season opener",
          text: `أهلاً يا ${manager.manager_name}. لسه ملعبناش أول مباراة.`,
          mood: "normal",
          label: "Before round 1",
        },
        {
          title: "What I expect",
          text: "عايز بداية قوية. جهّز الفريق كويس.",
          mood: "serious",
          label: "Before round 1",
        },
      ];
    }

    const label = `Round ${matchResult.matchday}`;
    const score = `${matchResult.myGoals}-${matchResult.opponentGoals}`;

    const reaction: Dialogue =
      matchResult.result === "win"
        ? {
            title: "Great win",
            text: `كسبنا ${score}. شغل ممتاز.`,
            mood: "happy",
            label,
          }
        : matchResult.result === "loss"
          ? {
              title: "Not good enough",
              text: `خسرنا ${score}. مش مقبول.`,
              mood: "angry",
              label,
            }
          : {
              title: "A point",
              text: `تعادل ${score}. كنا نقدر ناخد أكتر.`,
              mood: "serious",
              label,
            };

    const standing: Dialogue = position
      ? {
          title: "League position",
          text:
            position === 1
              ? "إحنا في الصدارة. حافظ عليها."
              : position <= 4
                ? `إحنا في المركز ${position}. وضع كويس.`
                : position <= 10
                  ? `المركز ${position}. محتاجين أكتر.`
                  : `المركز ${position}. ده مقلق.`,
          mood: position <= 4 ? "happy" : position <= 10 ? "serious" : "angry",
          label,
        }
      : {
          title: "League position",
          text: "لسه الترتيب بيتحدد.",
          mood: "normal",
          label,
        };

    const next: Dialogue = {
      title: "Next round",
      text:
        matchResult.result === "win"
          ? "ركّز، المباراة الجاية مش أسهل."
          : "عايز رد فعل في الجولة الجاية.",
      mood: matchResult.result === "loss" ? "serious" : "normal",
      label,
    };

    return [reaction, standing, next];
  }, [manager, club, matchResult, position]);

  const currentDialogue =
    dialogues[dialogueIndex % Math.max(dialogues.length, 1)];

  const imageMood =
    currentDialogue?.mood === "angry" ||
    (badForm && currentDialogue?.mood !== "happy")
      ? "angry"
      : "normal";

  function talkToManager() {
    if (!dialogues.length) return;

    // first click opens the first line; after the last line it starts over
    if (!bubbleVisible) {
      setDialogueIndex(0);
      setBubbleVisible(true);
      return;
    }

    setDialogueIndex((current) =>
      (current + 1) % dialogues.length
    );
  }

  if (loading) {
    return (
      <main className="management-loading">
        <div className="management-loading-logo"><GsmMark size={64} /></div>
        <p>Preparing your office...</p>
      </main>
    );
  }

  if (error || !manager || !club) {
    return (
      <main className="management-loading">
        <p>{error || "Could not load management office."}</p>
        <button onClick={() => router.push("/game/dashboard")}>
          Back to dashboard
        </button>
      </main>
    );
  }

  async function resign() {
    setResigning(true);
    setResignError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/");
      const uid = auth.user.id;
      // leaving the club also frees the seat in a shared league
      await supabase.from("room_members").delete().eq("user_id", uid);
      // the career ends here: nothing of it follows him to the next club
      if (manager?.selected_league) await resetCareerData(supabase, uid, manager.selected_league, club?.id);
      const { error: updateError } = await supabase
        .from("manager_contracts")
        .update({ selected_league: null, selected_club: null, club_appointed_at: null, room_id: null })
        .eq("user_id", uid);
      if (updateError) throw updateError;
      router.replace("/game/leagues");
    } catch {
      setResignError("Could not submit your resignation. Check your connection and try again.");
      setResigning(false);
    }
  }

  return (
    <main className="mg gx-grain">
      <div className="gx-curtain" aria-hidden="true" />

      {/* the whole screen is the office: tap the manager to talk */}
      <button type="button" className="manager-character" onClick={talkToManager} aria-label="Talk to manager">
        <img
          key={imageMood}
          src={imageMood === "angry" ? "/office/angry.jpg" : "/office/normal.jpg"}
          alt="Football manager"
          className="manager-image"
        />
      </button>
      <div className="mg-shade" aria-hidden="true" />

      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="mg-body">
        <aside className="mg-side mg-glass" aria-label="Club overview">
          <div className="mg-side-head">
            <h1>Your office</h1>
            <p>{club.name}</p>
          </div>

          <dl className="mg-stats">
            <div>
              <dt>League position</dt>
              <dd>{position ? `#${position}` : "—"}</dd>
            </div>
            <div>
              <dt>Last match</dt>
              <dd>{matchResult ? `${matchResult.myGoals} - ${matchResult.opponentGoals}` : "Not played"}</dd>
            </div>
            <div>
              <dt>Season stage</dt>
              <dd>{seasonStage === "start" ? "Beginning" : seasonStage === "middle" ? "Mid season" : "Final stage"}</dd>
            </div>
            <div>
              <dt>Matchday</dt>
              <dd>{latestMatch ? latestMatch.matchday : "—"}</dd>
            </div>
          </dl>
        </aside>

        <div className="mg-talk">
          {bubbleVisible && currentDialogue ? (
            <div className={`mg-dialogue mg-glass mood-${currentDialogue.mood}`} key={dialogueIndex} role="status">
              <small>
                {currentDialogue.label}
                <span className="mg-dialogue-count">
                  {(dialogueIndex % dialogues.length) + 1} / {dialogues.length}
                </span>
              </small>
              <strong>{currentDialogue.title}</strong>
              <p dir="auto">{currentDialogue.text}</p>
            </div>
          ) : (
            <span className="mg-hint mg-glass">Tap the manager to talk</span>
          )}
        </div>

        <div className="mg-actions mg-glass">
          <button type="button" className="mg-resign" onClick={() => setResignModal(true)}>
            <Icon name="logout" size={14} />
            Resign from club
          </button>
        </div>
      </div>

      {resignModal && (
        <div className="mg-overlay" role="dialog" aria-modal="true" aria-labelledby="resign-title" onClick={() => !resigning && setResignModal(false)}>
          <div className="mg-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mg-modal-icon"><Icon name="warning" size={24} /></div>
            <h2 id="resign-title">Resign from {club.name}?</h2>
            <p dir="auto">هل أنت متأكد إنك عايز تقدم استقالتك من تدريب {club.name}؟</p>
            <p className="mg-modal-warning" dir="auto">الاستقالة هتنهي مهمتك كمدير فني، وهتختار دوري ونادي جديد. موسم الدوري هيكمل زي ما هو.</p>
            {resignError && <p className="mg-modal-error" role="alert">{resignError}</p>}

            <div className="mg-modal-buttons">
              <button type="button" className="gx-btn" onClick={() => setResignModal(false)} disabled={resigning}>
                Keep my job
              </button>
              <button type="button" className="mg-confirm" onClick={resign} disabled={resigning}>
                {resigning ? "Resigning..." : "Confirm resignation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
