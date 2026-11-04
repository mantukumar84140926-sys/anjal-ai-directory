# Anjal AI Ecosystem — Safe Implementation Roadmap

## Product goal
Turn Anjal AI Directory into a daily-use AI ecosystem for students, creators, developers, founders, and businesses. The existing directory remains the core discovery layer; repeat visits come from fresh daily discovery, practical prompts, workflows, challenges, and a personal workspace.

## Current verified baseline (4 November 2026)
- Vite + React + TypeScript single-page application.
- Existing 1,000-tool catalog, category pages, tool detail pages, AI Finder, and 5,000-prompt Prompt Library.
- Supabase client is configured through public Vite environment variables. Existing database migration creates tool_events, tool_submissions, and tool_claims with RLS.
- Existing Monetag/advertising, SEO prerender, sitemap, and current routes must be preserved.
- Supabase project fqxxsibgrzbkncyymjqk currently reports INACTIVE and database introspection timed out during this audit. No schema changes or live data writes are safe until the project is active and verified.
- Existing open PR #5 adds crawlable Prompt Library HTML. This work is kept on a separate branch and does not modify that PR or production.

## Delivery principles
1. Never commit directly to main; use small feature branches and preview deployments.
2. Preserve the existing 1,000-tool catalog, 5,000 prompts, monetization, SEO routes, and Supabase data.
3. Add database objects only through reviewed, additive migrations with RLS and least-privilege grants.
4. AI-generated entries must be source-backed, deduplicated, checked for valid official URLs, and idempotent. If verification fails, do not publish.
5. Keep all provider credentials server-side (Supabase Vault / Edge Function secrets). Never put model API keys in VITE_ variables or browser code.
6. Validate type-check, lint, catalog uniqueness, production build, and Vercel preview before merging.

## Phases

### Phase 1 — Daily return loop (first UI slice)
- Add a Daily AI Hub route with rotating picks from the existing catalog, a prompt of the day from the existing prompt collection, one practical AI tip, and a daily challenge.
- Persist challenge completion locally for the current day without requiring an account.
- Be transparent: until the backend automation is enabled, the page rotates existing content and does not claim to discover newly launched tools.

### Phase 2 — Reactivate and verify the data layer
- Restore the existing Supabase project and verify current migrations, tables, grants, RLS, and analytics writes.
- Additive tables: daily_content, ai_workflows, user_bookmarks, challenge_completions, and automation_runs.
- Public users can read published content; signed-in users can read/write only their own bookmarks and progress; automation writes are restricted to a server-side service role.
- Add indexes for publication date, content type, slug, and user/date lookup. Do not expose service-role secrets to the client.

### Phase 3 — Automated daily research and publishing
- A scheduled Supabase Cron job invokes a server-side Edge Function once per day.
- Research source-backed AI launches, feature updates, creator techniques, and practical workflows.
- Normalize and deduplicate against existing catalog entries and recent published content.
- Validate source URL, publication date, category, summary, and factual claims; reject unverifiable items.
- Publish a daily bundle only after all checks pass; otherwise retain the last good bundle and log the failure.
- Store run status, source URLs, timestamps, content hashes, and error summaries for auditability.
- Supabase Cron supports recurring jobs and run history; use it as the scheduler after project reactivation. See https://supabase.com/docs/guides/cron and https://supabase.com/docs/guides/functions/schedule-functions.

### Phase 4 — Workflow Library
- Searchable step-by-step recipes connecting multiple tools (input → tool → output).
- Filters for creator, study, coding, business, marketing, and productivity.
- Each workflow includes required tools, estimated effort, expected output, prompt templates, and alternatives.
- One-click copy and save; track useful workflow opens and outbound clicks.

### Phase 5 — Personal AI Workspace
- Optional account sign-in; browsing remains open without an account.
- Saved tools, prompts, workflows, recent activity, and challenge progress.
- Row-level security ensures each signed-in user can access only their own records.
- Export saved items and allow account deletion.

### Phase 6 — Trends, community, and growth
- Trend pages based on verified source signals and directory engagement, not fabricated popularity.
- User-submitted tools/workflows enter a moderation queue before public listing.
- Shareable collections and public workflow pages with canonical URLs and internal links.
- Email/push notifications only after explicit opt-in.

## Success metrics
- Returning visitors (D1 / D7 / D30), not just page views.
- Daily Hub → tool detail → official website click-through.
- Prompt copy rate and workflow completion rate.
- Challenge completion and repeat challenge visits.
- Saved items per active user.
- Organic impressions and clicks by daily-content landing page.
- Content freshness, source validity, duplicate rate, and automation success rate.

## First implementation status
- Daily AI Hub UI is being introduced as a separate, reviewable feature branch.
- No production deployment or database mutation is performed by this branch.
- Live automated research is intentionally gated on restoring and verifying the inactive Supabase project and configuring a server-side AI provider secret.
