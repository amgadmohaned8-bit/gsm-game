محتويات الملف وأماكنها:

lib/football/strength.ts          -> ضعه في lib/football/ (استبدل القديم)
lib/football/matchday.ts          -> ضعه في lib/football/ (استبدل القديم)
app/game/fixtures/page.tsx        -> ضعه في app/game/fixtures/ (استبدل القديم)
sql/fix_room_results.sql          -> شغّله مرة واحدة في Supabase SQL Editor

الترتيب:
1) شغّل ملف الـ SQL في Supabase
2) استبدل الملفات التلاتة في مشروعك
3) ارفع على Vercel (git push)
node scripts/photos.mjs
node scripts/build-edge.mjs
npx.cmd supabase login
npx.cmd supabase link --project-ref sjalvvowzcokiyozcwrc
npx.cmd supabase functions deploy play-matchday --use-api
npx.cmd supabase functions deploy play-round --use-api
npx.cmd supabase functions deploy play-friendly --use-api
npx.cmd supabase functions deploy play-halftime --use-api
npx.cmd supabase functions deploy settle-sales --use-api --no-verify-jwt
git add .
git commit -m "v163 server sells shared league listings"
git push