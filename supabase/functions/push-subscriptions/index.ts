import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Push service is not configured" }, 503);

  try {
    const body = await req.json();
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    if (body.action === "subscribe") {
      const sub = body.subscription;
      if (!sub?.endpoint || typeof sub.endpoint !== "string" ||
          !sub.endpoint.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
        return json({ error: "Invalid push subscription" }, 400);
      }
      const timezone = typeof body.timezone === "string" && body.timezone.length <= 80
        ? body.timezone : "Asia/Kolkata";
      const { error } = await admin.from("push_subscriptions").upsert({
        endpoint: sub.endpoint,
        subscription: sub,
        timezone,
        enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === "unsubscribe") {
      if (typeof body.endpoint !== "string" || !body.endpoint.startsWith("https://")) {
        return json({ error: "Invalid endpoint" }, 400);
      }
      const { error } = await admin.from("push_subscriptions")
        .delete().eq("endpoint", body.endpoint);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("push-subscriptions error", error);
    return json({ error: "Could not update notification subscription" }, 500);
  }
});
