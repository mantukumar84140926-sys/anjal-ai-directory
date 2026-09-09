create table if not exists public.tool_events (
  id bigint generated always as identity primary key,
  event text not null check (char_length(event) between 2 and 80),
  tool_slug text,
  path text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tool_events_created_at_idx on public.tool_events(created_at desc);
create index if not exists tool_events_slug_idx on public.tool_events(tool_slug);
create index if not exists tool_events_event_idx on public.tool_events(event);

create table if not exists public.tool_submissions (
  id bigint generated always as identity primary key,
  name text not null,
  website text not null,
  category text not null,
  description text not null,
  submitter_email text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists tool_submissions_status_idx on public.tool_submissions(status);
create index if not exists tool_submissions_created_at_idx on public.tool_submissions(created_at desc);

create table if not exists public.tool_claims (
  id bigint generated always as identity primary key,
  tool_slug text not null,
  tool_name text not null,
  website text not null,
  claimant_name text not null,
  claimant_email text not null,
  company_role text,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists tool_claims_status_idx on public.tool_claims(status);
create index if not exists tool_claims_slug_idx on public.tool_claims(tool_slug);

alter table public.tool_events enable row level security;
alter table public.tool_submissions enable row level security;
alter table public.tool_claims enable row level security;

drop policy if exists public_insert_tool_events on public.tool_events;
create policy public_insert_tool_events on public.tool_events for insert to anon, authenticated with check (true);

drop policy if exists public_insert_tool_submissions on public.tool_submissions;
create policy public_insert_tool_submissions on public.tool_submissions for insert to anon, authenticated with check (status = 'pending');

drop policy if exists public_insert_tool_claims on public.tool_claims;
create policy public_insert_tool_claims on public.tool_claims for insert to anon, authenticated with check (status = 'pending');

revoke all on public.tool_events from anon, authenticated;
grant insert on public.tool_events to anon, authenticated;
revoke all on public.tool_submissions from anon, authenticated;
grant insert on public.tool_submissions to anon, authenticated;
revoke all on public.tool_claims from anon, authenticated;
grant insert on public.tool_claims to anon, authenticated;
