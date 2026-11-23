/**
 * The three commentators of GSM.
 *
 *  - Medhat Shelbi (مدحت شلبي): the voice of most matches, with Bilal Allam.
 *  - Bilal Allam (بلال علام): the other voice of most matches.
 *  - Essam El Shawali (عصام الشوالي): the big matches: the Premier League, the European clubs
 *    and any match of Al Ahly, Zamalek or Pyramids.
 *
 * One commentator calls the whole match. Every line is picked from a fixed seed, so a match
 * is always described the same way. The catchphrases are theirs; the facts (who scored, the
 * score) are added around them.
 */

import { clubs as premierClubs } from "@/lib/football/clubs";
import { europeanClubs } from "@/lib/football/europeClubs";
import { foulLine, pick } from "@/lib/football/commentary";

export type CommentatorId = "medhat" | "bilal" | "essam";

export type Commentator = { id: CommentatorId; name: string; english: string; photo: string };

export const COMMENTATORS: Record<CommentatorId, Commentator> = {
  medhat: { id: "medhat", name: "مدحت شلبي", english: "Medhat Shelbi", photo: "/commentators/medhat.webp" },
  bilal: { id: "bilal", name: "بلال علام", english: "Bilal Allam", photo: "/commentators/bilal.webp" },
  essam: { id: "essam", name: "عصام الشوالي", english: "Essam El Shawali", photo: "/commentators/essam.webp" },
};

const BIG_EGYPT = new Set(["al-ahly", "zamalek", "pyramids"]);
const PREMIER = new Set(premierClubs.map((c) => c.id));
const EUROPE = new Set(europeanClubs.map((c) => c.id));

/** Essam calls the big matches; the others share the rest. */
export function commentatorFor(homeClub: string, awayClub: string, seed: string): Commentator {
  const big = [homeClub, awayClub].some((id) => PREMIER.has(id) || EUROPE.has(id) || BIG_EGYPT.has(id));
  if (big) return COMMENTATORS.essam;
  return pick([COMMENTATORS.medhat, COMMENTATORS.bilal], `${seed}|who`);
}

type Pools = {
  goal: string[];
  /** a goal in the last minutes */
  lateGoal?: string[];
  miss: string[];
  save?: string[];
  build: string[];
  /** the build-up in the last minutes */
  lateBuild?: string[];
  kickoff?: string[];
  half?: string[];
  win?: string[];
  end?: string[];
  card?: string[];
};

const POOLS: Record<CommentatorId, Pools> = {
  medhat: {
    goal: [
      "جووووووول! يا حلاوة يا ولاد!",
      "يا حبيب قلبي يا مهاجم.. عملتها إزاي دي؟!",
      "حطها في الشباك وقال للدفاع مع السلامة!",
      "الهدف جه في وقته.. يا سلام يا سلام!",
      "يا جماعة اللي بيحصل ده فوق الخيال!",
      "المدرجات بتغني.. والفريق بيحتفل!",
      "يا نهار أبيض.. قلبوا الطاولة في ثانية!",
      "يا ولد يا جامد.. إيه الثقة دي!",
      "يا جماعة ده مش هدف.. دي تحفة فنية!",
      "الراجل ده جاي يلعب كورة ولا يعمل تاريخ؟!",
    ],
    lateGoal: ["ضربة قاضية في الوقت القاتل!", "يا نهار أبيض.. قلبوا الطاولة في ثانية!"],
    miss: [
      "يا ابني دي كانت محتاجة رجل مش رجلين!",
      "المرمى قدامك يا حبيبي.. بتبص على مين؟!",
      "يا خسارة يا جدعان.. دي كانت جول مضمون!",
      "العارضة قالت له مش النهارده!",
      "ده لو كان بيلعب تنس كان جابها!",
      "يا لهوي.. ضاعت مننا ضياع العمر!",
      "ياااااااه! فرصة كانت كفيلة تقلب الماتش!",
    ],
    save: ["الله عليك يا حارس.. أنقذت فريقك من مصيبة!", "ياااااااه! فرصة كانت كفيلة تقلب الماتش!"],
    build: ["بص على التمريرة.. بص على الجمال!", "يا ساتر يا رب.. الدفاع في خبر كان!", "يا نهار أبيض.. الدفاع اتفرج على الهجمة!", "يا سلام على الكورة الحلوة!"],
  },
  bilal: {
    goal: [
      "الله عليك يا حبيب والديك!",
      "لفها لفة جاتوه يا فنان!",
      "يا شيكا يا مزيكا!",
      "شوفلي شقة جنبك يا عبدالله!",
      "يا خرابي على الحلاوة!",
      "الله الله الله.. إيه الجمال ده!",
      "ده كلام كبير يا حضرات!",
      "يا سلام يا سلام يا سلام!",
      "يا جماعة ده هدف بطعم البطولة!",
      "الكرة في الشباك.. والحكاية اتحسمت!",
      "هنا تظهر شخصية البطل!",
      "يا خبر أبيض على المهارة!",
      "الجمهور كان مستني اللحظة دي!",
    ],
    lateGoal: ["كل ثانية بتفرق.. وكل لمسة ممكن تحسم!", "يا جماعة ده هدف بطعم البطولة!", "الكرة في الشباك.. والحكاية اتحسمت!"],
    miss: ["دي لو دخلت كانت المدرجات هتولع!", "ملكيش حق يا عارضة!", "يا نهار أبيض يا جماعة!", "يا لهوي على اللي حصل!"],
    build: [
      "من جاور السعيد يسعد!",
      "يا جماعة إحنا بنتفرج على فن!",
      "إيه الروقان ده يا ابني!",
      "الكرة بتقول لصاحبها خدني وحطني في الجون!",
      "بص على التحرك.. بص على التمركز!",
      "يا سلام على صناعة اللعب!",
      "هجمة منظمة.. شغل كورة من الآخر!",
      "الكرة بتتنقل والخصم مش عارف يعمل إيه!",
    ],
    lateBuild: ["كل ثانية بتفرق.. وكل لمسة ممكن تحسم!", "المباراة دخلت في مرحلة الحسابات الصعبة!"],
    kickoff: ["النهارده يوم الأبطال!"],
    half: ["المباراة دخلت في مرحلة الحسابات الصعبة!"],
    win: ["ليلة كبيرة لفريق كبير!", "البطولة مش بتروح غير للي يستحقها!"],
    end: ["ليلة كبيرة لفريق كبير!", "يا جماعة إحنا بنتفرج على فن!"],
    card: ["يا لهوي على اللي حصل!", "يا نهار أبيض يا جماعة!"],
  },
  essam: {
    goal: [
      "جوووووووووووووول! يا لها من قذيفة!",
      "هدف من ذهب.. في توقيت من نار!",
      "يا إلهي! لقد فعلها.. لقد فعلها!",
      "الشباك تعانق الكرة.. والمدرجات تنفجر!",
      "هدف يُدرس في كتب كرة القدم!",
      "هذا ليس هدفاً.. هذه رسالة!",
      "افتحوا أبواب المجد لهذا الفريق!",
      "يا لها من شخصية.. يا لها من روح!",
      "التاريخ يُكتب الآن أمام أعيننا!",
      "من قال إن الحلم مستحيل؟!",
      "إنه الجنون الكروي يا سادة!",
      "لا مستحيل في كرة القدم!",
      "يا لها من دراما كروية!",
    ],
    lateGoal: ["الرصاصة الأخيرة أصابت الهدف!", "يا لها من ليلة لا تُنسى!", "لا مستحيل في كرة القدم!"],
    miss: ["يا الله يا الله يا الله! ماذا يحدث هنا؟!", "إنها كرة القدم يا سادة!", "كرة القدم لا تعترف إلا بمن يقاتل!", "يا لها من دراما كروية!"],
    build: ["يا الله يا الله يا الله! ماذا يحدث هنا؟!", "هل يفعلها؟ هل يكتب التاريخ؟!", "الآن أو لا يكون!", "القلوب في الأقدام.. والأعين على الشباك!", "إنها كرة القدم يا سادة!"],
    lateBuild: ["الوقت يمر.. والأمل لا يموت!", "ثوانٍ تفصلنا عن المجد!", "اللحظات الأخيرة.. حيث تولد الأساطير!", "الآن أو لا يكون!"],
    kickoff: ["هنا تُكتب الحكايات وهنا تُصنع الأساطير!", "ليلة من ليالي كرة القدم الخالدة!"],
    half: ["كرة القدم لا تعترف إلا بمن يقاتل!", "إنها كرة القدم يا سادة!"],
    win: ["ارفعوا القبعات.. هنا الأبطال!", "ثلاث نقاط بطعم الذهب!", "المجد لمن آمن حتى النهاية!", "من الحلم إلى الحقيقة.. يا لها من رحلة!"],
    end: ["يا لها من نهاية.. يا لها من حكاية!", "انتهت الحكاية.. وبدأت الأسطورة!", "ليلة لن ينساها التاريخ!", "يا لها من ليلة لا تُنسى!"],
    card: ["يا الله يا الله يا الله! ماذا يحدث هنا؟!", "إنها كرة القدم يا سادة!"],
  },
};

const pickOf = (list: string[] | undefined, seed: string) => (list && list.length ? pick(list, seed) : "");

/** The words of one commentator for every moment of a match. */
export function voiceOf(c: CommentatorId) {
  const formal = c === "essam";
  const p = POOLS[c];

  return {
    kickoff: (home: string, away: string, seed: string) => {
      const reaction = pickOf(p.kickoff, seed + "k");
      const base = formal ? `صافرة البداية! ${home} في مواجهة ${away}.` : `صفاااارة البداية! ${home} قصاد ${away}.. الكورة بدأت يا جماعة!`;
      return reaction ? `${base} ${reaction}` : base;
    },

    half: (h: number, a: number, seed: string) => {
      const reaction = pickOf(p.half, seed + "h");
      const base = formal ? `نهاية الشوط الأول.. النتيجة ${h}-${a}.` : `نهاية الشوط الأول.. النتيجة ${h}-${a}. خدوا نفس وجاهزين للشوط التاني!`;
      return reaction ? `${base} ${reaction}` : base;
    },

    build: (team: string, minute: number, seed: string) => {
      const late = minute >= 75 ? pickOf(p.lateBuild, seed + "l") : "";
      const line = late || pickOf(p.build, seed + "b");
      return formal ? `${team} يتقدم.. ${line}` : `${team} بيتقدم.. ${line}`;
    },

    goal: (team: string, h: number, a: number, mineScored: boolean | null, minute: number, seed: string, who?: { player?: string; assist?: string }) => {
      const late = minute >= 80 ? pickOf(p.lateGoal, seed + "l") : "";
      const reaction = late || pickOf(p.goal, seed + "g");
      const named = who?.player ? (formal ? ` ${who.player} يسجل لـ${team}${who.assist ? ` بعد تمريرة من ${who.assist}` : " بمجهود فردي"}.` : ` ${who.player} هو اللي سجل${who.assist ? ` بعد تمريرة من ${who.assist}` : " بمجهود فردي"}!`) : ` ${team} يسجل!`;
      const tail = mineScored === true ? (formal ? " فرحة كبيرة لجماهيرك أيها المدرب." : " فرحة كبيرة لجماهيرك يا مدرب!") : mineScored === false ? (formal ? " والمدرب الآخر يتوتر.." : " مدرب الفريق التاني هيتوتر شوية..") : "";
      return `${reaction}${named}${tail} النتيجة ${h}-${a}.`;
    },

    penGoal: (team: string, h: number, a: number, mineScored: boolean | null, seed: string, who?: { player?: string }) => {
      const reaction = pickOf(p.goal, seed + "pg");
      const tail = mineScored === true ? (formal ? " أعصاب من حديد أيها المدرب!" : " أعصاب حديد يا مدرب!") : mineScored === false ? (formal ? " والمدرب الآخر يمسك رأسه.." : " والمدرب التاني ماسك راسه..") : "";
      return `${reaction} من ضربة الجزاء! ${who?.player ? `${who.player} ` : `${team} `}يسدد بثقة والحارس يذهب في اتجاه آخر!${tail} النتيجة ${h}-${a}.`;
    },

    miss: (team: string, saved: boolean, seed: string) => {
      const reaction = saved ? pickOf(p.save ?? p.miss, seed + "s") : pickOf(p.miss, seed + "m");
      const base = saved
        ? formal ? `الحارس يتصدى لمحاولة ${team}!` : `الحارس يتصدى لمحاولة ${team}!`
        : formal ? `${team} يضيّع الفرصة!` : `${team} بيضيّع الفرصة!`;
      return `${base} ${reaction}`;
    },

    penMiss: (team: string, saved: boolean, seed: string) => {
      const reaction = pickOf(p.miss, seed + "pm");
      return `${saved ? "الحارس يتصدى لضربة الجزاء!" : `ضربة الجزاء خارج المرمى! ${team} يضيّعها.`} ${reaction}`;
    },

    penBuild: (team: string, seed: string) => {
      const base = formal ? `ضربة جزاء لـ${team}! الحكم يشير إلى نقطة الجزاء والاستاد كله ساكت!` : `ضربة جزاااء لـ${team}! الحكم يشاور على النقطة والاستاد كله ساكت!`;
      return `${base} ${pickOf(p.build, seed + "pb")}`;
    },

    foul: (team: string, card: "yellow" | "red" | boolean | undefined, by: string | undefined, seed: string) => {
      const reaction = card ? pickOf(p.card ?? p.miss, seed + "c") : "";
      if (!formal) return `${foulLine(team, card, seed, by)} ${reaction}`.trim();
      if (card === "red") return `كارت أحمر! ${by ? `${by} ` : "المدافع "}يُطرد بعد تدخل عنيف على لاعب ${team}! الفريق سيكمل بعشرة لاعبين! ${reaction}`.trim();
      if (card) return `خطأ واضح على لاعب ${team}! ${by ? `${by} ` : "المدافع "}ينال بطاقة صفراء. ${reaction}`.trim();
      return `صافرة الحكم، خطأ على ${team}.. والكرة ستُنفذ من مكان الخطأ.`;
    },

    foulBuild: (team: string, seed: string) => `${team} ${formal ? "يدخل بالكرة" : "بيدخل بالكورة"}.. ${pick(["والمدافع يلحقه!", "وفي احتكاك قوي!"], seed)}`,

    full: (my: "win" | "lose" | "draw" | null, h: number, a: number, seed: string) => {
      const win = pickOf(p.win ?? p.end, seed + "w");
      const end = pickOf(p.end ?? p.win, seed + "e");
      const text =
        my === "win" ? (formal ? `صافرة النهاية! ${h}-${a} ومبروك أيها المدرب. ${win}` : `صافرة النهاية! ${h}-${a} ومبروك يا مدرب. ${win}`)
        : my === "lose" ? (formal ? `انتهى اللقاء ${h}-${a}.. خسارة صعبة لكن الطريق ما زال طويلاً. ${end}` : `انتهى الماتش ${h}-${a}.. خسارة صعبة بس الدوري طويل وهتعوّض! ${end}`)
        : my === "draw" ? (formal ? `انتهى اللقاء بالتعادل ${h}-${a}. ${end}` : `انتهى الماتش بالتعادل ${h}-${a}.. نقطة ماشية. ${end}`)
        : `صافرة النهاية! النتيجة النهائية ${h}-${a}. ${end}`;
      return text.trim();
    },
  };
}
