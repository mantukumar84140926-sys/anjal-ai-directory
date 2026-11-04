create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

create or replace function public.get_push_runtime_config()
returns jsonb
language sql
security definer
set search_path = ''
as $fn$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject', 'push_cron_secret');
$fn$;

revoke all on function public.get_push_runtime_config() from public, anon, authenticated;
grant execute on function public.get_push_runtime_config() to service_role;

select cron.schedule(
  'anjal-ai-daily-push',
  '30 3 * * *',
  $job$
    select net.http_post(
      url := 'https://fqxxsibgrzbkncyymjqk.supabase.co/functions/v1/send-daily-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);
