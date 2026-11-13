
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clubs } from "@/lib/football/clubs";
import { calculateStandings, type Match } from "@/lib/football/standings";
import "./management.css";

const SEASON = "2026-2027";

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

        const { data: matchData, error: matchesError } = await supabase
          .from("league_matches")
          .select("*")
          .eq("user_id", user.id)
          .eq("league_id", contract.selected_league)
          .eq("season", SEASON)
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

  const wins = recentResults.filter((result) => result === "win").length;
  const losses = recentResults.filter((result) => result === "loss").length;

  const badForm = losses >= 3 || (position !== null && position > 10);

  const dialogues = useMemo<Dialogue[]>(() => {
    if (!manager || !club) return [];

    const list: Dialogue[] = [
      {
        title: "WELCOME TO MY OFFICE",
        text: `أهلاً يا ${manager.manager_name}. مكتبك مفتوح، وعايز أشوف شغل يليق بتاريخ ${club.name}.`,
        mood: "normal",
        label: "MANAGER MEETING",
      },
    ];

    if (!matchResult) {
      list.push(
        {
          title: "THE SEASON AWAITS",
          text: "لسه ملعبناش أول مباراة. دي فرصتك تثبت إنك المدير المناسب للنادي.",
          mood: "normal",
          label: "SEASON OPENING",
        },
        {
          title: "OUR EXPECTATIONS",
          text: "الإدارة مستنية موسم قوي. عايزين فريق ينافس ويقدم كرة تليق باسم النادي.",
          mood: "serious",
          label: "BOARD EXPECTATIONS",
        },
        {
          title: "BUILD YOUR LEGACY",
          text: "كل بطولة عظيمة بدأت بخطوة. خلينا نكتب تاريخ جديد للنادي.",
          mood: "happy",
          label: "CLUB MESSAGE",
        }
      );
    } else {
      if (matchResult.result === "win") {
        list.push(
          {
            title: "EXCELLENT RESULT",
            text: `برافو عليك! كسبنا ${matchResult.myGoals}-${matchResult.opponentGoals}. عايز أشوف نفس الروح في المباراة الجاية.`,
            mood: "happy",
            label: "MATCH REACTION",
          },
          {
            title: "KEEP IT GOING",
            text: "الفوز ده مهم جداً، بس متفتكرش إن المهمة خلصت. لسه في مشوار طويل.",
            mood: "happy",
            label: "POST MATCH",
          }
        );
      } else if (matchResult.result === "loss") {
        list.push(
          {
            title: "NOT ACCEPTABLE",
            text: `الخسارة ${matchResult.myGoals}-${matchResult.opponentGoals}. مش النتيجة اللي كنت منتظرها. لازم نراجع حساباتنا.`,
            mood: "angry",
            label: "MATCH REACTION",
          },
          {
            title: "WE NEED A RESPONSE",
            text: "مش عايز أسمع أعذار. عايز أشوف رد فعل قوي من الفريق في المباراة القادمة.",
            mood: "angry",
            label: "POST MATCH",
          }
        );
      } else {
        list.push(
          {
            title: "POINTS DROPPED",
            text: `تعادل ${matchResult.myGoals}-${matchResult.opponentGoals}. كنا نقدر نطلع بنتيجة أفضل.`,
            mood: "serious",
            label: "MATCH REACTION",
          },
          {
            title: "NEXT TIME",
            text: "النقطة أفضل من لا شيء، لكن طموح النادي أكبر من كده.",
            mood: "normal",
            label: "POST MATCH",
          }
        );
      }
    }

    if (position === 1) {
      list.push({
        title: "TOP OF THE LEAGUE",
        text: "يا سلام! إحنا على قمة الدوري. حافظ على الصدارة، الجمهور بدأ يحلم بالبطولة.",
        mood: "happy",
        label: "LEAGUE REPORT",
      });
    } else if (position && position <= 4) {
      list.push({
        title: "A STRONG POSITION",
        text: `إحنا في المركز ${position}. وضعنا كويس، لكن المنافسة لسه مفتوحة.`,
        mood: "happy",
        label: "LEAGUE REPORT",
      });
    } else if (position && position <= 10) {
      list.push({
        title: "ROOM FOR IMPROVEMENT",
        text: `المركز ${position} مش كفاية لطموحاتنا. محتاجين نطلع لفوق.`,
        mood: "serious",
        label: "LEAGUE REPORT",
      });
    } else if (position) {
      list.push({
        title: "BOARD CONCERNS",
        text: `المركز ${position} مقلق جداً. لازم نبدأ نحقق نتائج أفضل قبل ما الوقت يفوت.`,
        mood: "angry",
        label: "LEAGUE REPORT",
      });
    }

    if (wins >= 3) {
      list.push({
        title: "WINNING MOMENTUM",
        text: "الفريق داخل في سلسلة انتصارات ممتازة. استغل الحالة دي وخليها تستمر!",
        mood: "happy",
        label: "TEAM FORM",
      });
    }

    if (losses >= 3) {
      list.push({
        title: "A SERIOUS WARNING",
        text: "ثلاث خسائر أو أكثر في آخر مبارياتنا! لازم نغير شكل الفريق ونوقف النزيف ده.",
        mood: "angry",
        label: "TEAM FORM",
      });
    }

    if (seasonStage === "start") {
      list.push({
        title: "THE ROAD AHEAD",
        text: "إحنا لسه في بداية الموسم. عندنا وقت نصحح الأخطاء ونبني فريق قوي.",
        mood: "normal",
        label: "SEASON UPDATE",
      });
    } else if (seasonStage === "middle") {
      list.push(
        {
          title: "HALF SEASON REPORT",
          text: "وصلنا لنص الموسم تقريباً. دلوقتي وقت تقييم الشغل اللي عملناه وتحديد أهداف المرحلة الجاية.",
          mood: "serious",
          label: "MID SEASON",
        },
        {
          title: "SECOND HALF",
          text: "النصف التاني محتاج تركيز أكبر. كل نقطة دلوقتي ممكن تفرق في شكل الموسم.",
          mood: "normal",
          label: "MID SEASON",
        }
      );
    } else {
      list.push(
        {
          title: "THE FINAL STRETCH",
          text: "وصلنا لنهاية الموسم. كل مباراة بقت مهمة، وعايزين ننهي المشوار بأفضل شكل.",
          mood: "serious",
          label: "SEASON FINALE",
        },
        {
          title: "SEASON REVIEW",
          text: `لعبنا لحد الجولة ${currentMatchday}. قرب وقت الحساب، وهنشوف وصلنا لإيه في النهاية.`,
          mood: "normal",
          label: "SEASON REVIEW",
        }
      );
    }

    list.push(
      {
        title: "KEEP YOUR FOCUS",
        text: "أنا واثق إننا نقدر نعمل حاجة كبيرة. المهم متفقدش تركيزك.",
        mood: "happy",
        label: "FINAL MESSAGE",
      },
      {
        title: "ONE CLUB. ONE DREAM.",
        text: "إحنا فريق واحد. اشتغل صح، وخلي الملعب هو اللي يتكلم.",
        mood: "normal",
        label: "CLUB MESSAGE",
      }
    );

    return list;
  }, [
    manager,
    club,
    matchResult,
    position,
    wins,
    losses,
    seasonStage,
    currentMatchday,
  ]);

  const currentDialogue =
    dialogues[dialogueIndex % Math.max(dialogues.length, 1)];

  const imageMood =
    currentDialogue?.mood === "angry" ||
    (badForm && currentDialogue?.mood !== "happy")
      ? "angry"
      : "normal";

  function talkToManager() {
    if (!dialogues.length) return;

    setDialogueIndex((current) =>
      (current + 1) % dialogues.length
    );

    setBubbleVisible(true);
  }

  function openManagerOffice() {
    setBubbleVisible(true);
  }

  if (loading) {
    return (
      <main className="management-loading">
        <div className="management-loading-logo">GSM</div>
        <p>PREPARING MANAGEMENT OFFICE...</p>
      </main>
    );
  }

  if (error || !manager || !club) {
    return (
      <main className="management-loading">
        <p>{error || "Could not load management office."}</p>
        <button onClick={() => router.push("/game/dashboard")}>
          BACK TO DASHBOARD
        </button>
      </main>
    );
  }

  return (
    <main className="management-page">
      <div className="management-background" />
      <div className="management-vignette" />

      <header className="management-header">
        <button
          className="management-back"
          onClick={() => router.push("/game/dashboard")}
        >
          ← DASHBOARD
        </button>

        <div className="management-brand">
          <strong>GSM</strong>
          <span>MANAGEMENT OFFICE</span>
        </div>

        <div className="management-season">
          SEASON 2026 / 2027
        </div>
      </header>

      <section className="office-scene manager-only-scene">
        {bubbleVisible && currentDialogue && (
          <div
            className={`manager-speech mood-${currentDialogue.mood}`}
            key={dialogueIndex}
          >
            <div className="speech-label">{currentDialogue.label}</div>
            <strong>{currentDialogue.title}</strong>
            <p>{currentDialogue.text}</p>
            <span className="speech-tail" />
          </div>
        )}

        <button
          className="manager-character"
          onClick={talkToManager}
          aria-label="Talk to manager"
        >
          <img
            src={
              imageMood === "angry"
                ? "/office/angry.jpg"
                : "/office/normal.jpg"
            }
            alt="Football manager"
            className="manager-image"
          />
          <span className="manager-click-hint">CLICK TO TALK</span>
        </button>
      </section>

      <section className="management-info">
        <div className="info-card">
          <span>YOUR CLUB</span>
          <strong>{club.name}</strong>
        </div>

        <div className="info-card">
          <span>LEAGUE POSITION</span>
          <strong>{position ? `#${position}` : "—"}</strong>
        </div>

        <div className="info-card">
          <span>LAST MATCH</span>
          <strong>
            {matchResult
              ? `${matchResult.myGoals} - ${matchResult.opponentGoals}`
              : "NOT PLAYED"}
          </strong>
        </div>

        <div className="info-card">
          <span>SEASON STAGE</span>
          <strong>
            {seasonStage === "start"
              ? "BEGINNING"
              : seasonStage === "middle"
                ? "MID SEASON"
                : "FINAL STAGE"}
          </strong>
        </div>
      </section>

      <section className="office-actions">
        <div className="office-action-heading">
          <span>MANAGER CONTROL CENTER</span>
          <h2>YOUR OFFICE</h2>
        </div>

        <button
          className="talk-action"
          onClick={openManagerOffice}
        >
          <span>💬</span>
          TALK TO MANAGER
        </button>

        <button
          className="resign-action"
          onClick={() => setResignModal(true)}
        >
          <span>↗</span>
          RESIGN FROM CLUB
        </button>
      </section>

      <footer className="management-footer">
        <span>GLOBAL SOCCER MANAGER</span>
        <span>YOUR CLUB. YOUR LEGACY.</span>
        <span>
          {latestMatch
            ? `LAST MATCHDAY ${latestMatch.matchday}`
            : "SEASON NOT STARTED"}
        </span>
      </footer>

      {resignModal && (
        <div
          className="resign-overlay"
          onClick={() => setResignModal(false)}
        >
          <div
            className="resign-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="resign-icon">!</div>
            <span>MANAGER CONTRACT</span>
            <h2>ARE YOU SURE?</h2>
            <p>
              هل أنت متأكد إنك عايز تقدم استقالتك من تدريب
              {` ${club.name}`}؟
            </p>
            <p className="resign-warning">
              الاستقالة هتنهي مهمتك كمدير فني.
            </p>

            <div className="resign-buttons">
              <button
                className="resign-cancel"
                onClick={() => setResignModal(false)}
              >
                KEEP MY JOB
              </button>

              <button
                className="resign-confirm"
                onClick={() => {
                  setResignModal(false);
                  alert(
                    "تأكيد الاستقالة ظاهر حالياً كتجربة. هنربطه بسجل العقود بعد تحديد طريقة حفظ الاستقالات في قاعدة البيانات."
                  );
                }}
              >
                CONFIRM RESIGNATION
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
