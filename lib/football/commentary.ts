/**
 * What the presenters and the commentator say, in Egyptian Arabic.
 * Every line is picked from a fixed seed, so the same match is always
 * described the same way.
 */

import { bestEleven, squadOf, teamRating } from "@/lib/football/squads";

export type Line = { who: "f" | "m"; name: string; text: string };

export const PRESENTERS = { f: "ليلى", m: "كريم" } as const;

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h ^ (h >>> 15)) >>> 0;
}
export function pick<T>(list: T[], seed: string): T {
  return list[hash(seed) % list.length];
}

type Club = { id: string; name: string; stadium?: string };

export function studioScript(opts: { home: Club; away: Club; myClub: string; label: string }): Line[] {
  const { home, away, myClub, label } = opts;
  const hr = teamRating(squadOf(home.id)) || 72;
  const ar = teamRating(squadOf(away.id)) || 72;
  const star = (id: string) => bestEleven(squadOf(id), "4-3-3").sort((a, b) => b.rating - a.rating)[0]?.name;
  const seed = `${home.id}|${away.id}|${label}`;
  const f = (text: string): Line => ({ who: "f", name: PRESENTERS.f, text });
  const m = (text: string): Line => ({ who: "m", name: PRESENTERS.m, text });

  const gap = Math.abs(hr - ar);
  const strong = hr >= ar ? home : away;
  const weak = hr >= ar ? away : home;
  const form =
    gap <= 2
      ? `الفريقين قوتهم متقاربة جداً، ${home.name} بتقييم ${hr} و${away.name} بتقييم ${ar}.. الماتش مفتوح على كل الاحتمالات!`
      : `${strong.name} الأقوى على الورق بتقييم ${Math.max(hr, ar)} قصاد ${Math.min(hr, ar)} لـ${weak.name}.. بس الكورة مفيهاش كلمة أكيدة يا باشا!`;

  const mine = myClub === home.id ? home : myClub === away.id ? away : null;
  const hs = star(home.id);
  const as = star(away.id);

  return [
    m(pick(["أهلاً بيكم يا جماعة في استوديو GSM الرياضي! النهاردة ماتش من العيار التقيل.", "مساء الخير عليكم! معاكم استوديو GSM.. والليلة كورة بجد."], seed + "a")),
    f(`${label}: ${home.name} يستضيف ${away.name}${home.stadium ? ` على ملعب ${home.stadium}` : ""}.`),
    m(form),
    f(hs && as ? `ومن النجوم اللي نستنى منهم حاجة: ${hs} مع ${home.name}، و${as} مع ${away.name}.` : "والجماهير كلها مستنية الصافرة."),
    mine
      ? f(`ومدربك النهاردة ماسك ${mine.name}.. الضغط كبير والجماهير مستنية فرحة!`)
      : f(pick(["والماتش ده ممكن يغيّر شكل الجدول، خليكم معانا!", "الجماهير جهزت نفسها.. وإحنا كمان!"], seed + "b")),
    m("يلا نروح للملعب.. مع المعلق! الماتش يبدأ دلوقتي!"),
  ];
}

/* ---------- the commentator ---------- */

const zones = ["على الجناح اليمين", "من ناحية الشمال", "في قلب الملعب", "على حدود الصندوق", "من الدفاع بتمريرة طويلة", "بتمريرة بينية ممتازة"];

export const kickoffLine = (home: string, away: string, seed: string) =>
  pick(
    [`صفاااارة البداية! ${home} قصاد ${away}.. الكورة بدأت يا جماعة!`, `الحكم يطلق الصافرة.. ${home} و${away} والماتش ولّع!`],
    seed
  );

export const halfLine = (h: number, a: number, seed: string) =>
  pick(
    [`نهاية الشوط الأول.. النتيجة ${h}-${a}. خدوا نفس وجاهزين للشوط التاني!`, `الحكم يعلن نهاية الشوط الأول، ${h}-${a}.. والتاني أحلى!`],
    seed
  );

export const buildLine = (team: string, seed: string) =>
  pick(
    [
      `كورة هجوم عند ${team}! ${pick(zones, seed + "z")}..`,
      `${team} بيتقدم ${pick(zones, seed + "z")}.. استنوا!`,
      `الكورة مع ${team} ${pick(zones, seed + "z")}.. هجمة خطيرة!`,
      `ماشي ماشي ${team}! ${pick(zones, seed + "z")}.. هيسدد؟`,
    ],
    seed
  );

export const goalLine = (team: string, h: number, a: number, mineScored: boolean | null, seed: string, who?: { player?: string; assist?: string }) => {
  const base = pick(
    [
      `جووووووول! ${team} بيسجل! يا سلام يا سلام، دي حلاوة!`,
      `جوووول يا جماعة! الشبكة بتتهز! ${team} يهزّ الشباك، كورة تحفة يا باشا!`,
      `الله الله الله! جووول ${team}! ده مش جول ده لوحة فنية!`,
      `جوووووول! خلاص اتحسمت! ${team} يسجل ويولّعها في الاستاد!`,
      `يا ولاااد! جول جامد من ${team}! سلملي على الإيد اللي سددت!`,
    ],
    seed
  );
  const named = who?.player
    ? ` ${who.player} هو اللي سجل${who.assist ? ` بعد تمريرة رائعة من ${who.assist}` : " بمجهود فردي"}!`
    : "";
  const tail = mineScored === true ? " فرحة كبيرة لجماهيرك يا مدرب!" : mineScored === false ? " مدرب الفريق التاني هيتوتر شوية.." : "";
  return `${base}${named}${tail} النتيجة ${h}-${a}.`;
};

export const missLine = (team: string, saved: boolean, seed: string) =>
  pick(
    saved
      ? [`الحارس يتصدى! إيد حديد يا بطل، ${team} ما نفعش!`, "يا ساتر! حارس المرمى يمسكها بصعوبة!", "تصدي رائع! الكورة تطلع للركنية!"]
      : [`يااا ضاعت من ${team}! جنب القائم بسنتيمترات!`, `العارضة! لا مش معقولة، كورة تتحرق من ${team}!`, `${team} يسدد.. فوق المرمى! فرصة ضايعة بجد!`],
    seed
  );

export function fullTimeLine(my: "win" | "lose" | "draw" | null, h: number, a: number, seed: string) {
  if (my === "win") return pick([`صافرة النهاية! ${h}-${a} ومبروك يا مدرب، فوز يتحط في الإطار!`, `انتهى الماتش ${h}-${a}.. شغل مدرب بجد، مبروك الثلاث نقط!`], seed);
  if (my === "lose") return pick([`انتهى الماتش ${h}-${a}.. خسارة صعبة، بس الدوري طويل وهتعوّض!`, `صافرة النهاية ${h}-${a}.. نرجع نظبط الدنيا ونرد في الماتش الجاي!`], seed);
  if (my === "draw") return `انتهى الماتش بالتعادل ${h}-${a}.. نقطة ماشية بدل ما تروح كلها.`;
  return `صافرة النهاية! النتيجة النهائية ${h}-${a}.`;
}

/* ---- fouls and penalties (shown on the pitch; they do not change the score) ---- */

export const foulBuildLine = (team: string, seed: string) =>
  pick([`${team} بيدخل بالكورة.. والمدافع يلحقه!`, `هجمة لـ${team}.. استنوا في احتكاك!`, `${team} ماشي بسرعة وفي التحام قوي!`], seed);

export const foulLine = (team: string, card: "yellow" | "red" | boolean | undefined, seed: string, by?: string) => {
  if (card === "red") return pick([`كارت أحمر! ${by ? `${by} ` : "المدافع "}يتطرد من الحكم بعد تدخل عنيف على لاعب ${team}! الفريق هيكمل بعشرة!`, `الحكم يطلع الأحمر! طرد مباشر وتدخل خطير على ${team}.. الماتش اتغيّر!`], seed);
  return pick(
    card
      ? [`فاول واضح على لاعب ${team}! ${by ? `${by} ` : "المدافع "}ياخد كارت أصفر!`, `الحكم يصفّر ويطلع الكارت الأصفر.. تدخل عنيف على لاعب ${team}!`]
      : [`فاول لصالح ${team}! الحكم يصفّر وكورة ثابتة في مكان خطير!`, `صافرة الحكم، فاول على ${team}.. الكورة هتتنفذ من مكان الخطأ.`],
    seed
  );
};

export const penBuildLine = (team: string, seed: string) =>
  pick([`ضربة جزاااء لـ${team}! الحكم يشاور على النقطة والاستاد كله ساكت!`, `بينالتي! ${team} بياخد ضربة جزاء.. أعصاب الكل تتشد!`], seed);

export const penGoalLine = (team: string, h: number, a: number, mineScored: boolean | null, seed: string, who?: { player?: string }) => {
  const tail = mineScored === true ? " أعصاب حديد يا مدرب!" : mineScored === false ? " والمدرب التاني ماسك راسه.." : "";
  return `جووووول من ضربة الجزاء! ${who?.player ? `${who.player} ` : ""}يسدد بثقة والحارس رايح في اتجاه تاني!${tail} النتيجة ${h}-${a}.`;
};

export const penMissLine = (team: string, saved: boolean, seed: string) =>
  saved
    ? pick([`الحارس يتصدى لضربة الجزاء! يا سلام، ${team} ضيّع فرصة العمر!`, "ضربة الجزاء.. والحارس مسكها! المدرجات بتتجنن!"], seed)
    : pick([`ضربة الجزاء برّا المرمى! ${team} ضيّعها بشكل غريب!`, "وااااو! ضربة الجزاء تخبط في القائم وتطلع!"], seed);
