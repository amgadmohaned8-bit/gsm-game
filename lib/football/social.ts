/**
 * The social feed: press-conference posts from managers (you and your shared
 * league), generated quotes from rival coaches, and match results. Everything
 * generated is seeded, so the feed looks the same every time you open it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { teamRating, squadOf } from "@/lib/football/squads";
import { myRoom } from "@/lib/football/rooms";
import type { Quote, Tone } from "@/lib/football/press";

export type Slide =
  | { kind: "quote"; q: string; a: string; tone: Tone }
  | { kind: "score"; home: string; away: string; hs: number; as: number; label: string };

export type Comment = { who: string; text: string; me?: boolean };

export type Post = {
  id: string;
  /** account the post belongs to; stories filter by this */
  account: string;
  name: string;
  handle: string;
  logo: string;
  role: "you" | "manager" | "coach" | "club";
  tag?: string;
  matchday: number;
  caption: string;
  slides: Slide[];
  likes: number;
  comments: Comment[];
};

export type Story = { account: string; name: string; logo: string; role: Post["role"]; fresh: boolean; label?: string };

export type Feed = { posts: Post[]; stories: Story[]; me: { name: string; club: string } };

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h ^ (h >>> 15)) >>> 0;
}
const pick = <T,>(list: T[], seed: string, n = 0) => list[hash(seed + n) % list.length];
const nameOf = (id: string) => clubs.find((c) => c.id === id)?.name ?? id;
const logoOf = (id: string) => clubs.find((c) => c.id === id)?.logo ?? "";
const rating = (id: string) => teamRating(squadOf(id));

/* ---------- rival coaches ---------- */

type CoachLine = { q: string; a: (c: { club: string; opp: string }) => string; tone: Tone };

const asked = ["الماتش الجاي قدام {opp}؟", "إيه رسالتك لجماهير {club}؟", "عن مواجهة {opp}.. رأيك؟", "جاهزين للماتش؟"];

const coachBank: Record<"strong" | "even" | "weak", ((c: { club: string; opp: string }) => string)[]> = {
  strong: [
    (c) => `${c.opp}؟ فريق محترم، بس إحنا بنلعب عشان نكسب مش عشان نشارك.`,
    (c) => `عندنا الأفضلية وهنثبتها في الماتش. ${c.club} جاهز.`,
    (c) => `لاعبيني في أحسن حال، ومش هنسيب لـ ${c.opp} أي فرصة.`,
    (c) => `الثلاث نقط مش للنقاش. هنهاجم من أول دقيقة.`,
  ],
  even: [
    (c) => `الماتش قدام ${c.opp} هيتحسم بالتفاصيل، ولازم نكون أذكى.`,
    (c) => `فريقين متقاربين.. اللي هيستغل فرصه هيكسب.`,
    (c) => `بنحترم ${c.opp} بس واثقين في اللي عندنا.`,
    (c) => `هنلعبها خطوة خطوة، ومفيش حاجة اسمها ماتش سهل.`,
  ],
  weak: [
    (c) => `${c.opp} فريق كبير والمهمة صعبة، بس هنقاتل لآخر ثانية.`,
    (c) => `مفيش ضغط علينا، الضغط كله على ${c.opp}.`,
    (c) => `هنقفل المساحات ونستنى فرصتنا.. الكورة مبتحسبش بالورق.`,
    (c) => `ممكن نعمل مفاجأة، وده بالظبط اللي بنحلم بيه.`,
  ],
};

const toneFor = (kind: "strong" | "even" | "weak", seed: string): Tone =>
  kind === "strong" ? pick<Tone>(["confident", "fiery"], seed) : kind === "weak" ? pick<Tone>(["humble", "calm"], seed) : pick<Tone>(["calm", "confident"], seed);

export function coachSlides(seed: string, club: string, opp: string): Slide[] {
  const diff = rating(club) - rating(opp);
  const kind = diff > 2 ? "strong" : diff < -2 ? "weak" : "even";
  const ctx = { club: nameOf(club), opp: nameOf(opp) };
  const bank = coachBank[kind];
  const a = hash(seed) % bank.length;
  const b = (a + 1 + (hash(seed + "b") % (bank.length - 1))) % bank.length;
  return [a, b].map((i, n) => ({
    kind: "quote" as const,
    q: asked[(hash(seed) + n * 2) % asked.length].replace("{opp}", ctx.opp).replace("{club}", ctx.club),
    a: bank[i](ctx),
    tone: toneFor(kind, seed + n),
  }));
}

/* ---------- fans ---------- */

const fans = ["omar_kora", "mido.10", "ahly_forever", "zizo_goal", "nour.fc", "kareem_9", "sara.matches", "hossam_tactics", "dodo_ultras", "yara.football"];

const fanLines: Record<Tone | "win" | "loss" | "draw", string[]> = {
  confident: ["كلام كبير يا كوتش 🔥", "ثقة الأبطال!", "إحنا وراك للآخر 💪", "ده المدرب اللي عايزينه"],
  humble: ["احترام للكل.. برافو يا كوتش", "كلام عاقل جداً 👏", "التواضع ده اللي بيكسّب", "ربنا يوفقك"],
  fiery: ["نار يا كوتش 🔥🔥", "هو ده الكلام!", "الصحافة اتصدمت 😂", "عايزين الحماس ده في الماتش"],
  calm: ["هادي وذكي.. ده الأسلوب", "كلام متزن 👌", "استنى النتيجة بس", "تحليل ممتاز"],
  silent: ["بدون تعليق؟ 😂", "الصمت أحياناً أبلغ", "غامض يا كوتش 👀", "استنينا أكتر من كده!"],
  win: ["مبروك الفوز! 🏆", "أداء جامد النهاردة 🔥", "كمّل كده يا كوتش", "ثلاث نقط تحفة"],
  loss: ["معلش، الجاية أحسن", "لازم نراجع الدفاع..", "خسارة موجعة 💔", "هنعوضها إن شاء الله"],
  draw: ["نقطة مش وحشة", "كنا نقدر ناخد أكتر", "تعادل بطعم الخسارة 😅", "عدّت على خير"],
};

function makeComments(seed: string, key: Tone | "win" | "loss" | "draw"): Comment[] {
  const n = 2 + (hash(seed) % 3);
  const out: Comment[] = [];
  for (let i = 0; i < n; i++) out.push({ who: pick(fans, seed, i), text: pick(fanLines[key], seed, i + 7) });
  return out;
}

const likesFor = (seed: string, club: string, base = 900) => base + Math.round(rating(club) * 24) + (hash(seed) % 4200);

/* ---------- the feed ---------- */

type MatchRow = { home_club: string; away_club: string; home_score: number | null; away_score: number | null; status: string; matchday: number };

const dominant = (quotes: Quote[]): Tone => {
  const count: Record<string, number> = {};
  quotes.forEach((q) => (count[q.tone] = (count[q.tone] ?? 0) + 1));
  return (Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "calm") as Tone;
};

export async function loadFeed(
  client: SupabaseClient,
  userId: string,
  opts: { club: string; league: string; season: string; name: string; roomId: string | null }
): Promise<Feed> {
  const { club, league, season, name, roomId } = opts;
  const posts: Post[] = [];
  const stories: Story[] = [];

  const { data: mrows } = await client
    .from("league_matches")
    .select("home_club, away_club, home_score, away_score, status, matchday")
    .eq("user_id", userId)
    .eq("league_id", league)
    .eq("season", season);
  const matches = (mrows ?? []) as MatchRow[];
  const done = matches.filter((m) => m.status === "completed" && m.home_score != null);
  const mine = (m: MatchRow) => m.home_club === club || m.away_club === club;
  const myDone = done.filter(mine).sort((a, b) => b.matchday - a.matchday);
  const myNext = matches.filter((m) => !(m.status === "completed") && mine(m)).sort((a, b) => a.matchday - b.matchday)[0];

  const room = await myRoom(client, roomId).catch(() => null);
  const members = (room?.members ?? []) as { user_id: string; club_id: string; name: string | null }[];

  const { data: prows } = await client.from("press_quotes").select("*").eq("season", season);
  const pressRows = (prows ?? []) as {
    user_id: string; manager_name: string | null; club_id: string; opponent_id: string; kind: string; matchday: number; quotes: Quote[];
  }[];

  /* managers' press conferences */
  pressRows.forEach((r) => {
    const isMe = r.user_id === userId;
    const who = isMe ? name : r.manager_name ?? members.find((m) => m.user_id === r.user_id)?.name ?? "Manager";
    const id = `p-${r.user_id}-${r.kind}-${r.matchday}`;
    const tone = dominant(r.quotes);
    posts.push({
      id,
      account: `m:${r.user_id}`,
      name: who,
      handle: who.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "manager",
      logo: logoOf(r.club_id),
      role: isMe ? "you" : "manager",
      tag: r.kind === "cup" ? "League Cup" : undefined,
      matchday: r.matchday,
      caption: `المؤتمر الصحفي قبل مواجهة ${nameOf(r.opponent_id)} 🎙️`,
      slides: r.quotes.map((q) => ({ kind: "quote" as const, q: q.q, a: q.a, tone: q.tone })),
      likes: likesFor(id, r.club_id, 1200),
      comments: makeComments(id, tone),
    });
  });

  /* rival coaches: your next opponent and the last three you faced */
  const faced = [...(myNext ? [myNext] : []), ...myDone.slice(0, 3)];
  faced.forEach((m, i) => {
    const opp = m.home_club === club ? m.away_club : m.home_club;
    const id = `c-${opp}-${m.matchday}`;
    const slides = coachSlides(`${season}|${opp}|${club}|${m.matchday}`, opp, club);
    posts.push({
      id,
      account: `c:${opp}`,
      name: `مدرب ${nameOf(opp)}`,
      handle: `${opp.replace(/-/g, "_")}_coach`,
      logo: logoOf(opp),
      role: "coach",
      tag: i === 0 && myNext ? "Next opponent" : undefined,
      matchday: m.matchday,
      caption: `قبل مواجهة ${nameOf(club)} 🎙️`,
      slides,
      likes: likesFor(id, opp),
      comments: makeComments(id, slides[0].kind === "quote" ? slides[0].tone : "calm"),
    });
  });

  /* results */
  const resultOf = (m: MatchRow): "win" | "loss" | "draw" => {
    const mineHome = m.home_club === club;
    const f = mineHome ? m.home_score! : m.away_score!;
    const a = mineHome ? m.away_score! : m.home_score!;
    return f > a ? "win" : f < a ? "loss" : "draw";
  };
  myDone.slice(0, 4).forEach((m) => {
    const id = `r-${m.matchday}`;
    posts.push({
      id,
      account: `k:${club}`,
      name: nameOf(club),
      handle: club.replace(/-/g, "_") + "_fc",
      logo: logoOf(club),
      role: "club",
      tag: "Full time",
      matchday: m.matchday,
      caption: `${nameOf(m.home_club)} ${m.home_score} - ${m.away_score} ${nameOf(m.away_club)} ⚽`,
      slides: [{ kind: "score", home: m.home_club, away: m.away_club, hs: m.home_score!, as: m.away_score!, label: `Matchday ${m.matchday}` }],
      likes: likesFor(id, club, 2000),
      comments: makeComments(id, resultOf(m)),
    });
  });
  const latest = done.reduce((n, m) => Math.max(n, m.matchday), 0);
  const big = done
    .filter((m) => m.matchday === latest && !mine(m))
    .sort((a, b) => Math.abs(b.home_score! - b.away_score!) - Math.abs(a.home_score! - a.away_score!))[0];
  if (big) {
    const id = `r-${big.home_club}-${big.matchday}`;
    const winner = big.home_score! >= big.away_score! ? big.home_club : big.away_club;
    posts.push({
      id,
      account: `k:${winner}`,
      name: nameOf(winner),
      handle: winner.replace(/-/g, "_") + "_fc",
      logo: logoOf(winner),
      role: "club",
      tag: "Full time",
      matchday: big.matchday,
      caption: `${nameOf(big.home_club)} ${big.home_score} - ${big.away_score} ${nameOf(big.away_club)}`,
      slides: [{ kind: "score", home: big.home_club, away: big.away_club, hs: big.home_score!, as: big.away_score!, label: `Matchday ${big.matchday}` }],
      likes: likesFor(id, winner, 1500),
      comments: makeComments(id, "win"),
    });
  }

  posts.sort((a, b) => b.matchday - a.matchday || hash(a.id) - hash(b.id));

  /* stories */
  const has = (acc: string) => posts.some((p) => p.account === acc);
  stories.push({ account: `m:${userId}`, name: "Your story", logo: logoOf(club), role: "you", fresh: has(`m:${userId}`) });
  if (myNext) {
    const opp = myNext.home_club === club ? myNext.away_club : myNext.home_club;
    stories.push({ account: `c:${opp}`, name: nameOf(opp), logo: logoOf(opp), role: "coach", fresh: true, label: "Next" });
  }
  members
    .filter((m) => m.user_id !== userId)
    .forEach((m) => stories.push({ account: `m:${m.user_id}`, name: m.name ?? "Manager", logo: logoOf(m.club_id), role: "manager", fresh: has(`m:${m.user_id}`) }));
  const seen = new Set(stories.map((s) => s.account));
  faced.slice(1).forEach((m) => {
    const opp = m.home_club === club ? m.away_club : m.home_club;
    if (!seen.has(`c:${opp}`)) { seen.add(`c:${opp}`); stories.push({ account: `c:${opp}`, name: nameOf(opp), logo: logoOf(opp), role: "coach", fresh: false }); }
  });
  if (has(`k:${club}`)) stories.push({ account: `k:${club}`, name: nameOf(club), logo: logoOf(club), role: "club", fresh: false });

  return { posts, stories, me: { name, club } };
}
