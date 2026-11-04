create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  timezone text not null default 'Asia/Kolkata',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Browser clients never read or write this table directly. The Edge Functions
-- use the server-side service role key and validate each request.
revoke all on table public.push_subscriptions from anon, authenticated;
grant all on table public.push_subscriptions to service_role;

create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions (enabled) where enabled = true;
