# خزانة كؤوس المدرب (GSM)

الخزانة بتاعة المدرب نفسه مش الفريق: صورته واسمه فوق، وجواها الكؤوس اللي كسبها مع أي نادي.
لو كسب نفس الكأس أكتر من مرة بيظهر تحته `x2` / `x3`، واللوحة النحاس بتكتب المواسم والنادي.
فلتر الأندية فوق بيعرض كؤوس نادي واحد بس.

## الملفات

| الملف | بيعمل إيه |
|---|---|
| `supabase/migrations/033_manager_trophies.sql` | جدول `manager_trophies` + RLS + دالة `award_trophy` (السيرفر بس هو اللي يكتب) |
| `supabase/functions/_shared/awardTrophy.ts` | دالة تناديها من الـ Edge Function لما بطولة أو موسم يخلص |
| `lib/trophies/catalog.ts` | قايمة الكؤوس (الاسم، الصورة، الرف). تضيف كأس هنا تظهر له خانة لوحده |
| `lib/trophies/aggregate.ts` | بيجمّع السجلات: العدد، المواسم، الأندية، الفلتر |
| `lib/trophies/queries.ts` | بيجيب كؤوس مدرب من Supabase |
| `components/trophy-cabinet/*` | الكومبوننت والـ CSS (نفس شكل التصميم اللي وافقت عليه) |
| `app/trophies/page.tsx` | صفحة مثال |
| `lib/trophies/aggregate.check.ts` | فحص سريع للمنطق: `bun lib/trophies/aggregate.check.ts` |

## الدمج

1. **الجدول:** غيّر رقم الملف `033` للرقم التالي في فولدر الـ migrations عندك، وشغّله.
2. **الملفات:** انسخ `lib/trophies`, `components/trophy-cabinet`, `app/trophies` في المشروع.
   الكود بيفترض Next.js (App Router) + TypeScript + الـ alias `@/`.
3. **الصفحة:** في `app/trophies/page.tsx` عدّل الأسطر اللي عليها `TODO`
   (الـ Supabase helper ومسار تسجيل الدخول ومكان اسم المدرب).
4. **الصور:** حط صور الـ PNG في `public/trophies/` بنفس أسماء الأنواع، مثلاً `league_title.png`.
   لحد ما الصورة تتحط، الخانة بتعرض مربع فيه اسم الكأس بدل ما تبوظ.
   المطلوب: خلفية شفافة، الكأس من الأمام، عرض 512px على الأقل.
5. **الخطوط (اختياري):** الكومبوننت بيستخدم `--font-exo` و `--font-spectral`
   لو معرّفهم بـ `next/font`، ولو لأ بيرجع لخط النظام.

## تسجيل الكأس تلقائياً

في الـ Edge Function اللي بتقفل الدوري أو الكأس:

```ts
import { awardTrophy } from '../_shared/awardTrophy.ts';

await awardTrophy(admin, {
  managerId: winner.managerId,
  trophyType: 'league_title',   // من lib/trophies/catalog.ts
  season,
  clubId: winner.clubId,
  clubName: winner.clubName,
  competitionId: leagueId,
});
```

الدالة آمنة لو اتنادت مرتين (نفس الكأس لنفس الموسم والنادي مبيتسجلش تاني).
والمستخدم العادي مقدرش يكتب في الجدول خالص.

## أنواع الكؤوس المتاحة دلوقتي

`league_title`, `caf_champions_league`, `domestic_cup`, `caf_confederation_cup`, `super_cup`
(الرف اللي فوق)، و `manager_of_year`, `fair_play`, `unbeaten_season`, `manager_of_month`,
`winning_streak` (الرف اللي تحت). عدد الكؤوس الكبيرة لازم يساوي عدد الصغيرة عشان الخانات تتظبط.

## ملاحظات

- لم ألمس أي ملف موجود في مشروعك (ولا `finance.ts`)، كله ملفات جديدة.
- لم أشوف كود مشروعك نفسه، فالافتراضات فوق (Next.js و alias `@/` وشكل الـ Supabase helper) محتاجة مراجعة سريعة.
- مفيش أي `.env.local` في الملفات.
