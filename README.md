# بنك GSM — خطوات النسخ واللصق (Next.js)

1) **قاعدة البيانات:** افتح `supabase/gsm_bank_migration.sql` والصقه كله في Supabase → SQL Editor ثم Run (مرة واحدة).
   لو اللعبة بتخزن الفلوس بالملايين (10 = 10M) غيّر الدالة `bank_unit()` من `1000000` إلى `1`، وغيّر `UNIT` في `lib/bankAdapter.js` بنفس القيمة.

2) **انسخ الملفات لمشروعك بنفس المسارات:**
   - `public/images/bank-bg.jpg`  (الصورة المرجعية)
   - `lib/bankApi.js`
   - `lib/bankAdapter.js`
   - `components/bank/BankPage.jsx`
   - `components/bank/bank.module.css`
   - `app/bank/page.jsx`   (لو مشروعك Pages Router: انسخ المحتوى إلى `pages/bank.jsx` وصدّر `BankPage` كـ default)

3) **مسار الـ Supabase client:** في `lib/bankApi.js` السطر `import { supabase } from '@/lib/supabaseClient'` — عدّله لمسار الـ client الموجود عندك.
   وتأكد إن alias `@/` شغال في `tsconfig.json` / `jsconfig.json`.

4) **اربط اللعبة:** افتح `lib/bankAdapter.js` واملأ دالتين فقط:
   - `useGameCalendar()` → `season`, `gameDay`, `midDay`, `seasonLen`, `clubId` (أيام مطلقة من تقويم اللعبة، مش Date.now()).
   - `useClubBudget()` → `budget` و `applyToBudget(delta)` (الدالة اللي عندك بتزوّد/تخصم رصيد النادي).
   ولما تخلص غيّر `connected: false` إلى `connected: true`.

5) افتح `/bank`.

القيود (منع التعاقد، تجميد الانتقالات، البيع الإجباري، خصم النقاط) بترجع من `getBankStatus` كأعلام:
`signings_blocked`, `transfers_frozen`, `frozen_transfer_pct`, `forced_sale_allowed`, `points_deducted_season`.
اربطها بنظام الانتقالات وترتيب الدوري عندك.
