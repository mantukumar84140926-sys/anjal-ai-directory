import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type FeedSource = { name: string; url: string };
const DEFAULT_FEEDS: FeedSource[] = [
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
  { name: "Google Research Blog", url: "https://blog.research.google/feeds/posts/default?alt=rss" },
  { name: "OpenAI News", url: "https://openai.com/news/rss.xml" },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://anjal-ai-directory.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-autopilot-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(item: string, name: string): string {
  const match = item.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}\\s*>`, "i"));
  if (match) return decodeXml(match[1]);
  if (name === "link") {
    const attr = item.match(/<(?:[\w.-]+:)?link\b[^>]*href=["']([^"']+)["']/i);
    return attr?.[1] || "";
  }
  return "";
}

function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch { return null; }
}

async function readFeed(source: FeedSource) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "AnjalAI-DirectoryBot/1.0 (+https://anjal-ai-directory.vercel.app)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)\s*>/gi)].slice(0, 30);
  return items.map(([_, item]) => {
    const title = tag(item, "title").slice(0, 180);
    const link = tag(item, "link");
    const description = tag(item, "description") || tag(item, "summary") || tag(item, "content");
    const url = safeUrl(link);
    if (!title || !url) return null;
    return { title, url: url.toString(), description: description.slice(0, 1200), sourceUrl: source.url, sourceName: source.name };
  }).filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("AUTOPILOT_CRON_SECRET");
  const supplied = req.headers.get("x-autopilot-secret");
  if (!cronSecret || !supplied || supplied !== cronSecret) return response({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return response({ error: "Server configuration incomplete" }, 503);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runStarted = new Date().toISOString();
  const runInsert = await supabase.from("ai_tool_discovery_runs").insert({
    status: "running", started_at: runStarted, source_count: DEFAULT_FEEDS.length,
  }).select("id").single();
  const runId = runInsert.data?.id ?? null;

  let candidates = 0;
  let inserted = 0;
  const errors: string[] = [];
  for (const source of DEFAULT_FEEDS) {
    try {
      const entries = await readFeed(source);
      candidates += entries.length;
      for (const entry of entries) {
        const url = safeUrl(entry.url);
        if (!url) continue;
        const domain = url.hostname.toLowerCase().replace(/^www\./, "");
        const slugBase = entry.title.toLowerCase().normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
        if (!slugBase) continue;
        const { error } = await supabase.from("ai_tool_discoveries").upsert({
          name: entry.title,
          slug: slugBase,
          official_url: url.toString(),
          normalized_domain: domain,
          source_url: entry.sourceUrl,
          short_description: entry.description.slice(0, 300) || `Candidate discovered from ${entry.sourceName}.`,
          full_description: entry.description || null,
          source_evidence: {
            feed: entry.sourceName,
            feed_url: entry.sourceUrl,
            item_url: entry.url,
            discovered_by: "rss",
          },
          verification_status: "pending",
          publication_status: "discovered",
        }, { onConflict: "normalized_domain", ignoreDuplicates: true });
        if (error) errors.push(`${entry.title}: ${error.message}`);
        else inserted++;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (runId) {
    await supabase.from("ai_tool_discovery_runs").update({
      status: errors.length ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      candidates_found: candidates,
      records_inserted: inserted,
      error_summary: errors.slice(0, 20),
    }).eq("id", runId);
  }
  return response({
    status: "completed",
    runId,
    feedsChecked: DEFAULT_FEEDS.length,
    candidatesFound: candidates,
    recordsInserted: inserted,
    errors: errors.slice(0, 10),
    note: "Candidates are stored as unverified discoveries only. No tool is published by this function.",
  });
});
