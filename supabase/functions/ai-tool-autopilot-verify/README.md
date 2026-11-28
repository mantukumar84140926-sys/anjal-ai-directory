# AI Tool Autopilot — Safe Metadata Screening

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
- Performs syntax-only URL screening: HTTPS is required; credentials, non-standard ports, literal IP addresses, and local/internal hostnames are rejected.
- Calculates a deterministic metadata-completeness score from the candidate name, description, HTTPS URL and RSS evidence.
- Stores the score and screening evidence, then moves syntactically acceptable candidates to `needs_review`.
- Marks malformed or unsafe URL syntax as `failed` / `rejected`.

## Important security and quality boundaries

- **It does not fetch candidate-controlled URLs.** This avoids turning the shared Edge Function into an SSRF or DNS-rebinding proxy.
- The score measures metadata completeness only. It is not a measure of product quality, legitimacy, safety, popularity, ownership or accuracy.
- No candidate is marked `verified` or `published`. Independent ownership/product checks and a separate high-quality content gate are still required before indexable pages can be generated.
- A high completeness score must never be treated as permission to publish.

## Deployment

This source is not deployed automatically by Vercel. Deploy it to the existing Supabase project only after setting the secrets privately and reviewing the Edge Function logs. Keep platform JWT verification enabled where the scheduler can provide the expected authorization; the shared secret check is an additional guard, not a replacement for platform authorization.
