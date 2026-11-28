# AI Tool Autopilot — Conservative Homepage Check

This function processes up to 20 pending discoveries per run.

## Required secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOPILOT_CRON_SECRET` (same private shared secret as the discovery function)

## Request

Send a POST request to the deployed Supabase Edge Function with header:

```
x-autopilot-secret: <private secret>
```

Do not place the secret in source control, browser code, or chat messages.

## What it does

- Loads pending discoveries only.
- Requires HTTPS, rejects URL credentials, non-standard ports, literal IP addresses, and local/internal hostnames.
- Follows at most four HTTPS redirects, checking every redirect target.
- Checks HTTP status and HTML content type, and reads at most 700 KB of homepage HTML.
- Captures title, meta description, Open Graph site name, final URL and response metadata.
- Stores evidence and moves reachable sites to `needs_review`.
- Marks inaccessible or unsafe URLs as `failed` / `rejected`.

## Important safety boundary

A reachable homepage is not proof that the discovered site is the official product, that the product exists as described, or that its claims/pricing are accurate. Therefore this function **never** sets `verification_status=verified`, never generates SEO claims, and never publishes pages. Those require independent source/ownership checks and a later quality gate.

## Deployment

This source is not deployed automatically by Vercel. Deploy it to the existing Supabase project only after setting the secrets privately and reviewing the Edge Function logs. Keep JWT verification enabled where the scheduler can provide the expected authorization; the shared secret check is an additional guard, not a replacement for platform authorization.
