import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type FeedSource = { name: string; url: string };
type Candidate = {
  title: string;
  url: string;
  articleUrl: string;
  description: string;
  sourceUrl: string;
  sourceName: string;
};

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
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
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
  } catch {
    return null;
  }
}

async function readFeed(source: FeedSource): Promise<Candidate[]> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "AnjalAI-DirectoryBot/1.0 (+https://anjal-ai-directory.vercel.app)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`);

  const xml = await res.text();
  const items = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)\s*>/gi)].slice(0, 30);
  const candidates: Candidate[] = [];

  for (const match of items) {
    const item = match[1];
    const title = tag(item, "title").slice(0, 180);
    const articleUrl = safeUrl(tag(item, "link"));
    const descriptionRaw = tag(item, "description") || tag(item, "summary") || tag(item, "content");
    const description = descriptionRaw.slice(0, 1200);
    if (!title || !articleUrl) continue;

    // The article URL is evidence, not the product homepage. Require a distinct
    // external HTTPS link so a publisher article is never mislabeled as a tool.
    const sourceHost = new URL(source.url).hostname.replace(/^www\./, "");
    const ignoredHosts = /(^|\.)(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com)$/i;
    const hrefs = [...item.matchAll(/href=["'](https:\/\/[^"'\s<>]+)["']/gi)].map((entry) => entry[1]);
    const productUrl = hrefs.map(safeUrl).find((candidate) =>
      candidate &&
      candidate.hostname.replace(/^www\./, "") !== sourceHost &&
      !ignoredHosts.test(candidate.hostname) &&
      !candidate.hostname.endsWith(".google.com")
    );
    if (!productUrl) continue;

    candidates.push({
      title,
      url: productUrl.toString(),
      articleUrl: articleUrl.toString(),
      description,
      sourceUrl: source.url,
      sourceName: source.name,
    });
  }
  return candidates;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("AUTOPILOT_CRON_SECRET");
  const supplied = req.headers.get("x-autopilot-secret");
  if (!cronSecret || !supplied || supplied !== cronSecret) {
    return response({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return response({ error: "Server configuration incomplete" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const runStartedAt = new Date().toISOString();
  const runInsert = await supabase.from("ai_tool_discovery_runs").insert({
    status: "running",
    run_started_at: runStartedAt,
    sources_checked: DEFAULT_FEEDS.length,
  }).select("id").single();

  if (runInsert.error || !runInsert.data?.id) {
    return response({ error: "Could not create discovery run log" }, 500);
  }

  const runId = runInsert.data.id;
  let candidatesFound = 0;
  let recordsInserted = 0;
  let duplicateOrSkipped = 0;
  const errors: string[] = [];

  for (const source of DEFAULT_FEEDS) {
    try {
      const entries = await readFeed(source);
      candidatesFound += entries.length;

      for (const entry of entries) {
        const url = safeUrl(entry.url);
        if (!url) {
          duplicateOrSkipped++;
          continue;
        }

        const domain = url.hostname.toLowerCase().replace(/^www\./, "");
        const slug = entry.title.toLowerCase().normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
        if (!slug) {
          duplicateOrSkipped++;
          continue;
        }

        const { data, error } = await supabase.from("ai_tool_discoveries").insert({
          name: entry.title,
          slug,
          official_url: url.toString(),
          normalized_domain: domain,
          source_url: entry.sourceUrl,
          short_description: entry.description.slice(0, 300) || `Candidate discovered from ${entry.sourceName}.`,
          full_description: entry.description || null,
          source_evidence: {
            feed: entry.sourceName,
            feed_url: entry.sourceUrl,
            item_url: entry.articleUrl,
            candidate_url: entry.url,
            discovered_by: "rss",
          },
          verification_status: "pending",
          publication_status: "discovered",
        }, { onConflict: "normalized_domain", ignoreDuplicates: true }).select("id");

        if (error) {
          errors.push(`${entry.title}: ${error.message}`);
        } else if (data?.length) {
          recordsInserted += data.length;
        } else {
          duplicateOrSkipped++;
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const runStatus = errors.length
    ? (recordsInserted > 0 ? "partial" : "failed")
    : "completed";

  const runUpdate = await supabase.from("ai_tool_discovery_runs").update({
    status: runStatus,
    run_finished_at: new Date().toISOString(),
    candidates_found: candidatesFound,
    error_summary: errors.length ? errors.slice(0, 20).join("\\n").slice(0, 4000) : null,
    metrics: {
      records_inserted: recordsInserted,
      duplicates_or_skipped: duplicateOrSkipped,
      feeds_checked: DEFAULT_FEEDS.length,
    },
  }).eq("id", runId);

  if (runUpdate.error) {
    return response({
      status: "partial",
      runId,
      error: "Discovery finished but run metrics could not be saved",
      recordsInserted,
    }, 500);
  }

  return response({
    status: runStatus,
    runId,
    feedsChecked: DEFAULT_FEEDS.length,
    candidatesFound,
    recordsInserted,
    duplicatesOrSkipped: duplicateOrSkipped,
    errors: errors.slice(0, 10),
    note: "Candidates remain unverified. This function does not publish tools or create indexable pages.",
  });
});
