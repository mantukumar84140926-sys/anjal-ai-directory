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

function allowedHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    if (!host || host === "localhost" || host.endsWith(".localhost") ||
        host.endsWith(".local") || host.endsWith(".internal") ||
        host.endsWith(".test") || host.endsWith(".invalid")) return null;
    // Reject literal IP addresses. This avoids direct requests to private/link-local
    // IPv4 and IPv6 addresses; DNS rebinding is still handled as a platform boundary.
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) return null;
    return url;
  } catch {
    return null;
  }
}

async function readLimited(response: Response, maxBytes = 700_000): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxBytes - total;
    const part = value.length > remaining ? value.slice(0, remaining) : value;
    chunks.push(part);
    total += part.length;
    if (part.length < value.length) break;
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

function meta(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim().slice(0, 500);
  }
  return "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || "";
}

async function inspectHomepage(start: URL) {
  let current = start;
  for (let hop = 0; hop <= 4; hop++) {
    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "AnjalAI-DirectoryVerifier/1.0 (+https://anjal-ai-directory.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || hop === 4) throw new Error("Too many or invalid redirects");
      const next = allowedHttpsUrl(new URL(location, current).toString());
      if (!next) throw new Error("Redirect target is not an allowed HTTPS website");
      current = next;
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Homepage returned HTTP ${response.status}`);
    }
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      await response.body?.cancel();
      throw new Error("Homepage did not return HTML");
    }

    const html = await readLimited(response);
    const title = extractTitle(html);
    const description = meta(html, "description") || meta(html, "og:description");
    const siteName = meta(html, "og:site_name");
    return {
      finalUrl: current.toString(),
      httpStatus: response.status,
      contentType,
      title,
      description,
      siteName,
      htmlBytesInspected: new TextEncoder().encode(html).length,
    };
  }
  throw new Error("Redirect limit exceeded");
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
    .select("id,name,official_url,source_evidence")
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

  let reachable = 0;
  let failed = 0;
  let needsReview = 0;
  const errors: string[] = [];

  for (const candidate of pending.data || []) {
    const start = allowedHttpsUrl(candidate.official_url);
    let evidence: Record<string, unknown> = {};
    let reason: string | null = null;
    let status: "needs_review" | "failed" = "needs_review";

    if (!start) {
      status = "failed";
      failed++;
      reason = "URL failed HTTPS and hostname safety checks";
    } else {
      try {
        evidence = await inspectHomepage(start);
        reachable++;
        needsReview++;
        reason = "Website is reachable, but product ownership and claims still require independent review";
      } catch (error) {
        status = "failed";
        failed++;
        reason = error instanceof Error ? error.message : String(error);
        errors.push(`${candidate.name}: ${reason}`);
      }
    }

    const existing = candidate.source_evidence && typeof candidate.source_evidence === "object"
      ? candidate.source_evidence as Record<string, unknown>
      : {};
    const update = await supabase.from("ai_tool_discoveries").update({
      verification_status: status,
      publication_status: status === "failed" ? "rejected" : "needs_review",
      source_evidence: { ...existing, homepage_check: evidence, checked_at: new Date().toISOString() },
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    }).eq("id", candidate.id).eq("verification_status", "pending");

    if (update.error) errors.push(`${candidate.name}: database update failed: ${update.error.message}`);
  }

  const finalStatus = errors.length ? (reachable + failed > 0 ? "partial" : "failed") : "completed";
  const runUpdate = await supabase.from("ai_tool_discovery_runs").update({
    status: finalStatus,
    run_finished_at: new Date().toISOString(),
    candidates_found: pending.data?.length || 0,
    verified_count: 0,
    rejected_count: failed,
    error_summary: errors.length ? errors.slice(0, 15).join("\n").slice(0, 4000) : null,
    metrics: {
      checked: pending.data?.length || 0,
      reachable_needs_review: needsReview,
      failed,
      note: "Reachability is not proof of official ownership; no candidate is auto-verified or published.",
    },
  }).eq("id", run.data.id);

  if (runUpdate.error) return json({ status: "partial", error: "Verification ran but metrics update failed" }, 500);

  return json({
    status: finalStatus,
    checked: pending.data?.length || 0,
    reachableNeedsReview: needsReview,
    failed,
    verified: 0,
    published: 0,
    errors: errors.slice(0, 10),
    note: "This conservative stage checks HTTPS reachability and homepage metadata only. It never auto-publishes or claims ownership verification.",
  });
});
