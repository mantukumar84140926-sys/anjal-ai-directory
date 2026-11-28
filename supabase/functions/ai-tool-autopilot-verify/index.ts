import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://anjal-ai-directory.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-autopilot-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

/**
 * Syntax-only URL screening. Deliberately does not fetch candidate-controlled
 * URLs: doing so from a shared Edge Function creates an SSRF/DNS-rebinding
 * surface. A reachable homepage is not proof of ownership in any case.
 */
function allowedHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    if (!host || host === "localhost" || host.endsWith(".localhost") ||
        host.endsWith(".local") || host.endsWith(".internal") ||
        host.endsWith(".test") || host.endsWith(".invalid")) return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
    return url;
  } catch {
    return null;
  }
}

function completenessScore(candidate: {
  name: string;
  official_url: string;
  source_evidence: unknown;
}, description: string): number {
  let score = 0;
  const name = String(candidate.name || "").trim();
  const text = String(description || "").trim();
  const evidence = candidate.source_evidence && typeof candidate.source_evidence === "object"
    ? candidate.source_evidence as Record<string, unknown>
    : {};

  if (name.length >= 3 && name.length <= 100) score += 15;
  if (/[a-z]/i.test(name) && !/^(new|latest|introducing|announcing)\b/i.test(name)) score += 5;
  if (text.length >= 80) score += 10;
  if (text.length >= 250) score += 10;
  if (text.length >= 500) score += 5;
  if (allowedHttpsUrl(candidate.official_url)) score += 20;
  if (typeof evidence.item_url === "string" && allowedHttpsUrl(evidence.item_url)) score += 15;
  if (typeof evidence.feed_url === "string" && allowedHttpsUrl(evidence.feed_url)) score += 10;
  if (typeof evidence.feed === "string" && evidence.feed.trim().length > 2) score += 10;
  return Math.min(100, score);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("AUTOPILOT_CRON_SECRET");
  const suppliedSecret = req.headers.get("x-autopilot-secret");
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Server configuration incomplete" }, 503);

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = await supabase.from("ai_tool_discovery_runs").insert({
    status: "running",
    sources_checked: 0,
  }).select("id").single();
  if (run.error || !run.data?.id) return json({ error: "Could not create verification run log" }, 500);

  const pending = await supabase.from("ai_tool_discoveries")
    .select("id,name,official_url,short_description,source_evidence")
    .eq("verification_status", "pending")
    .eq("publication_status", "discovered")
    .order("discovered_at", { ascending: true })
    .limit(20);

  if (pending.error) {
    await supabase.from("ai_tool_discovery_runs").update({
      status: "failed",
      run_finished_at: new Date().toISOString(),
      error_summary: pending.error.message.slice(0, 4000),
    }).eq("id", run.data.id);
    return json({ error: "Could not load pending discoveries" }, 500);
  }

  let rejected = 0;
  let needsReview = 0;
  let highCompleteness = 0;
  const errors: string[] = [];

  for (const candidate of pending.data || []) {
    const safeUrl = allowedHttpsUrl(candidate.official_url);
    const score = completenessScore(candidate, candidate.short_description || "");
    const invalidReason = safeUrl ? null : "Candidate URL failed HTTPS and hostname syntax checks";
    if (invalidReason) rejected++;
    else needsReview++;
    if (!invalidReason && score >= 70) highCompleteness++;

    const existing = candidate.source_evidence && typeof candidate.source_evidence === "object"
      ? candidate.source_evidence as Record<string, unknown>
      : {};
    const update = await supabase.from("ai_tool_discoveries").update({
      quality_score: score,
      verification_status: invalidReason ? "failed" : "needs_review",
      publication_status: invalidReason ? "rejected" : "needs_review",
      source_evidence: {
        ...existing,
        automated_screen: {
          url_syntax_valid: Boolean(safeUrl),
          completeness_score: score,
          score_type: "metadata_completeness_not_product_quality",
          external_network_request_made: false,
          checked_at: new Date().toISOString(),
        },
      },
      rejection_reason: invalidReason ||
        "Metadata completeness screened; independent product ownership, functionality, claims and quality remain unverified",
      updated_at: new Date().toISOString(),
    }).eq("id", candidate.id).eq("verification_status", "pending");

    if (update.error) errors.push(`${candidate.name}: database update failed: ${update.error.message}`);
  }

  const finalStatus = errors.length ? (needsReview + rejected > 0 ? "partial" : "failed") : "completed";
  const runUpdate = await supabase.from("ai_tool_discovery_runs").update({
    status: finalStatus,
    run_finished_at: new Date().toISOString(),
    candidates_found: pending.data?.length || 0,
    verified_count: 0,
    rejected_count: rejected,
    error_summary: errors.length ? errors.slice(0, 15).join("\\n").slice(0, 4000) : null,
    metrics: {
      checked: pending.data?.length || 0,
      needs_review: needsReview,
      rejected,
      completeness_score_70_plus: highCompleteness,
      note: "Score measures metadata completeness only. No candidate is verified or published.",
    },
  }).eq("id", run.data.id);

  if (runUpdate.error) return json({ status: "partial", error: "Screening ran but metrics update failed" }, 500);

  return json({
    status: finalStatus,
    checked: pending.data?.length || 0,
    needsReview,
    rejected,
    completenessScore70Plus: highCompleteness,
    verified: 0,
    published: 0,
    errors: errors.slice(0, 10),
    note: "No candidate-controlled URL is fetched. Scores measure metadata completeness, not product quality or ownership. All valid candidates remain unpublished for independent verification.",
  });
});
