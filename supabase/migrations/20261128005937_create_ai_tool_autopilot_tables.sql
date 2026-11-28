-- Additive foundation for the Anjal AI daily discovery pipeline.
-- Existing static catalog pages are not changed by this migration.

create table if not exists public.ai_tool_discoveries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  official_url text not null,
  normalized_domain text not null,
  source_url text,
  category text,
  short_description text,
  full_description text,
  seo_title text,
  seo_description text,
  features jsonb not null default '[]'::jsonb,
  pricing_status text not null default 'unverified',
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','failed','needs_review')),
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  publication_status text not null default 'discovered'
    check (publication_status in ('discovered','verified','published','rejected','needs_review')),
  source_evidence jsonb not null default '{}'::jsonb,
  rejection_reason text,
  discovered_at timestamptz not null default now(),
  verified_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_tool_discoveries_domain_unique unique (normalized_domain)
);

create index if not exists ai_tool_discoveries_status_idx
  on public.ai_tool_discoveries (publication_status, discovered_at desc);
create index if not exists ai_tool_discoveries_category_idx
  on public.ai_tool_discoveries (category);

alter table public.ai_tool_discoveries enable row level security;
revoke all on public.ai_tool_discoveries from anon, authenticated;
grant select on public.ai_tool_discoveries to anon, authenticated;
drop policy if exists "Public can read published AI tool discoveries" on public.ai_tool_discoveries;
create policy "Public can read published AI tool discoveries"
  on public.ai_tool_discoveries
  for select
  to anon, authenticated
  using (publication_status = 'published');

create table if not exists public.ai_tool_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  run_started_at timestamptz not null default now(),
  run_finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running','completed','partial','failed')),
  sources_checked integer not null default 0,
  candidates_found integer not null default 0,
  verified_count integer not null default 0,
  published_count integer not null default 0,
  rejected_count integer not null default 0,
  error_summary text,
  metrics jsonb not null default '{}'::jsonb
);

alter table public.ai_tool_discovery_runs enable row level security;
revoke all on public.ai_tool_discovery_runs from anon, authenticated;
drop policy if exists "No public access to discovery run logs" on public.ai_tool_discovery_runs;
create policy "No public access to discovery run logs"
  on public.ai_tool_discovery_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);
