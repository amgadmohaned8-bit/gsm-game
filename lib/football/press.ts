/**
 * The press conference before a match: who asks, what they ask, and a rough
 * reading of the manager's tone. Questions are picked from a fixed seed, so a
 * given match always brings the same two, and different matches bring others.
 */

import { teamRating, squadOf } from "@/lib/football/squads";

export type Journalist = { id: string; name: string; outlet: string; skin: string; hair: string; suit: string };

export const journalists: Journalist[] = [
  { id: "sara", name: "سارة منصور", outlet: "GSM Sports", skin: "#e0b08c", hair: "#2a1a12", suit: "#6b2e4a" },
  { id: "mahmoud", name: "محمود الجمل", outlet: "Kora Plus", skin: "#c68a62", hair: "#15110e", suit: "#2f4a6b" },
  { id: "heba", name: "هبة فؤاد", outlet: "Goal Daily", skin: "#f0c8a4", hair: "#5a3a22", suit: "#2f6b5a" },
  { id: "tarek", name: "طارق الشناوي", outlet: "Stadium TV", skin: "#b9805a", hair: "#2b2b2b", suit: "#6b5a2f" },
  { id: "nada", name: "ندى عادل", outlet: "The Late Whistle", skin: "#e8bd98", hair: "#111", suit: "#4a2f6b" },
  { id: "yassin", name: "ياسين رضوان", outlet: "الكورة اليوم", skin: "#d49a72", hair: "#3b2a1c", suit: "#6b2f2f" },
];

export type Ask = {
  id: string;
  /** when the question fits */
  when: "any" | "strong" | "weak" | "even" | "cup" | "home" | "away";
  text: (c: Ctx) => string;
  /** a few answers the manager can start from */
  hints: [string, string, string];
};

export type Ctx = { club: string; opp: string; cup: boolean; home: boolean };

export const asks: Ask[] = [
  { id: "mood", when: "any", text: (c) => `يا كوتش، ماتش ${c.opp} النهاردة.. حاسس بإيه قبل الماتش؟`, hints: ["واثق في لاعبيني، وجاهزين نكسب.", "الماتش صعب وهنحترم الخصم.", "بنركز على شغلنا بس."] },
  { id: "plan", when: "any", text: (c) => `إيه خطتك قصاد ${c.opp}؟ هتلعب هجوم ولا هتأمّن الأول؟`, hints: ["هنهاجم من أول دقيقة.", "هنلعب بحذر ونستغل الفرص.", "الخطة عند المدرب بس، هتشوفوها في الماتش."] },
  { id: "fans", when: "any", text: (c) => `الجماهير مستنية فرحة من ${c.club}.. بتقولهم إيه؟`, hints: ["هنفرّحكم، وعد.", "ادعمونا وإحنا هنقدم كل اللي عندنا.", "الجماهير عظيمة وهنرد جميلها."] },
  { id: "form", when: "any", text: (c) => `الناس بتتكلم عن مستوى ${c.club} الفترة دي.. رأيك؟`, hints: ["مستوانا كويس وهيتحسن.", "في حاجات لازم نظبطها.", "مش بسمع الكلام الكتير."] },
  { id: "players", when: "any", text: () => `هتغيّر في التشكيلة النهاردة؟ في لاعب معين قلقان عليه؟`, hints: ["التشكيلة جاهزة وكلهم في أحسن حال.", "في تغييرات بسيطة.", "هتعرفوها قبل الماتش."] },
  { id: "press", when: "any", text: () => `في كلام إن الضغط عليك كبير.. بتتعامل معاه إزاي؟`, hints: ["الضغط جزء من الشغل وبحبه.", "بركز على اللاعبين مش على الكلام.", "مفيش ضغط، في طموح."] },
  { id: "strong1", when: "strong", text: (c) => `${c.opp} على الورق أقوى منكم.. خايف؟`, hints: ["مفيش حاجة اسمها خايف، هنكسر الترشيحات.", "أيوه قوي، بس إحنا مش أقل.", "هنلعبها بذكاء وهنشوف."] },
  { id: "strong2", when: "strong", text: (c) => `هتقدر توقف نجوم ${c.opp}؟`, hints: ["عندنا حل لكل نجم عندهم.", "هنقفل المساحات وهنعاقب.", "اللعب جماعي مش بنجم."] },
  { id: "weak1", when: "weak", text: (c) => `${c.opp} فريق أضعف على الورق.. تعتبره ماتش سهل؟`, hints: ["مفيش ماتش سهل، هنلعب بكل جدية.", "بنحترم الكل، بس الثلاث نقط لازم تيجي.", "الورق مبيلعبش، الملعب هو اللي بيتكلم."] },
  { id: "weak2", when: "weak", text: () => `الجماهير مستنية فوز كبير.. هتحقق ده؟`, hints: ["هنحاول نعمل أكبر نتيجة.", "النتيجة مش مهمة قد الأداء.", "اللي ييجي ييجي، المهم الفوز."] },
  { id: "even1", when: "even", text: (c) => `الفريقين متقاربين جداً.. إيه اللي هيحسم الماتش؟`, hints: ["التفاصيل الصغيرة والتركيز.", "الفريق اللي يستغل فرصه.", "الحماس والروح العالية."] },
  { id: "cup1", when: "cup", text: () => `الكأس مش زي الدوري.. إيه أهميته ليكم؟`, hints: ["عايزين البطولة ومش هنفرّط فيها.", "كل بطولة ليها قيمة وإحنا جايين نكسب.", "الكأس فرصة نكتب بيها تاريخ."] },
  { id: "cup2", when: "cup", text: () => `خروج المغلوب.. ده بيغيّر تفكيرك؟`, hints: ["أيوه، مفيش مجال للغلط.", "هنلعب زي أي ماتش وبنفس التركيز.", "اللي بيتأهل هو اللي بيستحق."] },
  { id: "home1", when: "home", text: () => `اللعب على ملعبكم وبين جمهوركم.. ميزة كبيرة؟`, hints: ["أكبر ميزة، الجمهور بيدينا طاقة.", "بنلعب في أي مكان بنفس العقلية.", "لازم نستغل ده."] },
  { id: "away1", when: "away", text: () => `اللعب بره ملعبكم مش سهل.. جاهزين؟`, hints: ["جاهزين لأي ظروف.", "هنقفل الماتش بدري ونسكت الجمهور.", "هنلعب بذكاء ونطلع بنقطة على الأقل."] },
];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h ^ (h >>> 15)) >>> 0;
}

export type Round = { journalist: Journalist; ask: Ask; question: string };

/** Two questions from two different journalists, fixed for this match. */
export function pickRound(seed: string, my: string, opp: string, cup: boolean, home: boolean, names: { club: string; opp: string }): Round[] {
  const diff = teamRating(squadOf(my)) - teamRating(squadOf(opp));
  const fit = (a: Ask) =>
    a.when === "any" || (a.when === "strong" && diff <= -2) || (a.when === "weak" && diff >= 2) || (a.when === "even" && Math.abs(diff) < 2) || (a.when === "cup" && cup) || (a.when === "home" && home && !cup) || (a.when === "away" && !home && !cup);
  const ctx: Ctx = { club: names.club, opp: names.opp, cup, home };
  const pool = asks.filter(fit);
  const special = pool.filter((a) => a.when !== "any");
  const general = pool.filter((a) => a.when === "any");
  const first = (special.length ? special : general)[hash(seed + "q1") % (special.length ? special.length : general.length)];
  const rest = general.filter((a) => a.id !== first.id);
  const second = rest[hash(seed + "q2") % rest.length];
  const j1 = journalists[hash(seed + "j1") % journalists.length];
  const others = journalists.filter((j) => j.id !== j1.id);
  const j2 = others[hash(seed + "j2") % others.length];
  return [
    { journalist: j1, ask: first, question: first.text(ctx) },
    { journalist: j2, ask: second, question: second.text(ctx) },
  ];
}

export type Tone = "confident" | "humble" | "fiery" | "calm" | "silent";

/** A rough reading of the answer, used for the reactions and the social feed. */
export function toneOf(text: string): Tone {
  const t = text.trim().toLowerCase();
  if (!t || /no comment|بدون تعليق|مفيش تعليق/.test(t)) return "silent";
  if (/هنكسر|هنكسب|هنفوز|مفيش حاجة اسمها خايف|أكبر|ولّع|هنسحق|win|crush|destroy/.test(t)) return "confident";
  if (/غلط|مش مقبول|كفاية|حكم|ظلم|hate|angry|unfair/.test(t)) return "fiery";
  if (/نحترم|صعب|حذر|تواضع|respect|hard|careful/.test(t)) return "humble";
  return "calm";
}

const reactions: Record<Tone, string[]> = {
  confident: ["إجابة واثقة جداً يا كوتش!", "ده كلام كبير.. هنشوفه في الملعب!", "ثقة عالية، والجمهور هيحب ده."],
  humble: ["كلام متزن ومحترم.", "إجابة هادية وذكية.", "تواضع جميل قبل ماتش كبير."],
  fiery: ["واو.. ده تصريح نار!", "نبرة قوية، الصحافة هتتكلم عنها!", "هتبقى عنوان الصحف بكرة."],
  calm: ["تمام يا كوتش، شكراً.", "إجابة واضحة.", "شكراً على الصراحة."],
  silent: ["حاضر.. بدون تعليق إذن.", "فهمنا، شكراً.", "مفيش مشكلة."],
};
export const reactionFor = (tone: Tone, seed: string) => reactions[tone][hash(seed) % reactions[tone].length];

export type Quote = { q: string; a: string; by: string; outlet: string; tone: Tone };
