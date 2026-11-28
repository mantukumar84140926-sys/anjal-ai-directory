# AI Tool Autopilot Discovery

The `ai-tool-autopilot-discover` Edge Function is the first isolated stage of the Anjal AI Directory autopilot.

## Current behavior
- Reads a small, fixed list of public AI/ML publisher RSS feeds.
- Stores feed entries as **unverified candidates** in `public.ai_tool_discoveries`.
- Uses the normalized domain unique constraint to avoid duplicate candidates.
- Writes run metrics to the private `public.ai_tool_discovery_runs` table.
- Does not mark candidates verified, generate AI-written SEO copy, alter the static catalog, or publish pages.

This conservative boundary is intentional: a blog announcement is not proof that the linked product is a real, working AI tool. Verification, quality scoring, SEO generation, and the static-page/sitemap integration must pass separate checks before publication.

## Required Edge Function secrets
Set these in Supabase Edge Function secrets (never in frontend `VITE_*` variables):
- `AUTOPILOT_CRON_SECRET`: a long random secret used in the `x-autopilot-secret` request header.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose it to browsers or commit it).

## Invocation
POST to the function URL with header `x-autopilot-secret: <secret>`. Keep JWT verification enabled unless the deployment platform's scheduler cannot supply a user JWT; if disabled, the function's own secret check is mandatory.

## Next stages
1. Validate feed links against the publisher and actual product homepage.
2. Add independent verification and duplicate checks beyond domain uniqueness.
3. Add AI-generated descriptions/SEO metadata only after source evidence is collected and a private provider key is configured.
4. Integrate only verified, quality-approved records into the build-time prerender and sitemap pipeline.
5. Add a daily schedule and monitor run logs.
