# Anjal AI Directory

A production-oriented AI tools discovery directory with a curated 1000-tool catalog. Built with React, TypeScript, Vite and Tailwind CSS.

## Status
- 1000 unique AI tools in the catalog
- Duplicate protection by normalized tool name and official website
- Search, AI-assisted ranking and category filtering
- SEO-friendly tool detail pages with canonical URLs and structured data
- Official website links
- Ratings/pricing are not fabricated
- Ad monetization configuration is prepared for production setup

## Daily web push notifications

The Daily AI page includes an opt-in browser push control. Push is permission-based; visitors can turn it off at any time. The service worker is `public/sw.js`.

Before enabling it:
1. Restore/activate the Supabase project and apply `supabase/migrations/20261104000100_create_push_subscriptions.sql`.
2. Generate a VAPID key pair. Set the public key as `VITE_VAPID_PUBLIC_KEY` in the Vercel build environment and redeploy the preview.
3. Set these Supabase Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `PUSH_CRON_SECRET`. Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the Edge Function runtime.
4. Deploy `push-subscriptions` and `send-daily-push` from `supabase/functions/`.
5. Schedule `send-daily-push` daily at 09:00 Asia/Kolkata (03:30 UTC) using Supabase Cron + pg_net. Store the cron bearer secret in Supabase Vault; never commit it to Git.

The subscription UI remains disabled until the public VAPID key and Supabase client configuration are present. Notifications are not sent until the database, Edge Functions, secrets, and daily schedule are all active.
