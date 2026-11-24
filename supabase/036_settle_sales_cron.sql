-- OPTIONAL: lets the server sell listed players even while nobody has the game open.
-- 1) deploy the function:  npx.cmd supabase functions deploy settle-sales --use-api --no-verify-jwt
-- 2) set a secret:         npx.cmd supabase secrets set CRON_SECRET=PUT-A-LONG-RANDOM-TEXT-HERE
-- 3) put the same text and your project URL below, then run this file in the SQL Editor.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('gsm-settle-sales') where exists (select 1 from cron.job where jobname = 'gsm-settle-sales');
select cron.schedule(
  'gsm-settle-sales',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://sjalvvowzcokiyozcwrc.supabase.co/functions/v1/settle-sales',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PUT-THE-SAME-LONG-RANDOM-TEXT-HERE'),
    body := '{}'::jsonb
  );
  $$
);
