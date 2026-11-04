import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  const expected = Deno.env.get("PUSH_CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@anjal.ai";
  if (!url || !serviceKey || !publicKey || !privateKey) {
    return json({ error: "Daily push sender is not configured" }, 503);
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: subscriptions, error } = await admin
      .from("push_subscriptions").select("id, subscription").eq("enabled", true).limit(5000);
    if (error) throw error;

    const payload = JSON.stringify({
      title: "Anjal AI — Aaj ki AI discovery ✨",
      body: "Naya AI tool, ready-to-use prompt aur creator trick explore karein.",
      url: "/daily",
    });
    let sent = 0;
    let expired = 0;
    for (const row of subscriptions || []) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          expired++;
        } else {
          console.error("Push delivery failed", statusCode || "unknown");
        }
      }
    }
    return json({ ok: true, sent, expired, total: subscriptions?.length || 0 });
  } catch (error) {
    console.error("send-daily-push error", error);
    return json({ error: "Daily notification delivery failed" }, 500);
  }
});
