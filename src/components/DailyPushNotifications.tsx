import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type PushState = "unsupported" | "unconfigured" | "off" | "on" | "denied";

export default function DailyPushNotifications() {
  const [state, setState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (!VAPID_PUBLIC_KEY || !supabase) {
      setState("unconfigured");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    let active = true;
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setState(subscription ? "on" : "off");
      })
      .catch(() => {
        if (active) setMessage("Notification setup abhi available nahi hai. Thodi der baad try karein.");
      });
    return () => { active = false; };
  }, []);

  const enable = async () => {
    if (!supabase || !VAPID_PUBLIC_KEY) return;
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        setMessage("Daily notification ke liye browser permission allow karni hogi.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });
      const { error } = await supabase.functions.invoke("push-subscriptions", {
        body: {
          action: "subscribe",
          subscription: subscription.toJSON(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
        }
      });
      if (error) throw error;
      setState("on");
      setMessage("Notifications on! Ab aapko daily AI discovery mil sakti hai. 🔔");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Subscription save nahi ho paya. Please dobara try karein.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { error } = await supabase.functions.invoke("push-subscriptions", {
          body: { action: "unsubscribe", endpoint: subscription.endpoint }
        });
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Daily notifications band kar diye gaye hain.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notifications band nahi ho paye.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="mt-8 rounded-2xl border border-line bg-white p-5 dark:border-line-dark dark:bg-surface-dark sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal"><Bell className="h-5 w-5" /></span>
        <div>
          <h2 className="text-lg font-semibold">Daily AI notification</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate">Roz ek useful AI tool, prompt ya creator trick ki reminder paayein. Aap kabhi bhi band kar sakte hain.</p>
        </div>
      </div>
      {state === "on" ? <button onClick={disable} disabled={busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold dark:border-line-dark disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />} Turn off</button> : <button onClick={enable} disabled={busy || state === "unsupported" || state === "unconfigured" || state === "denied"} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Enable daily notifications</button>}
    </div>
    {state === "unsupported" && <p className="mt-3 text-xs text-slate">Is browser mein web push supported nahi hai. Android par Chrome use karein.</p>}
    {state === "unconfigured" && <p className="mt-3 text-xs text-slate">Notification service backend setup hone ke baad yahan enable ho jayega.</p>}
    {state === "denied" && <p className="mt-3 text-xs text-slate">Browser settings mein Anjal AI ke notifications allow karke page reload karein.</p>}
    {message && <p role="status" className="mt-3 text-xs text-slate">{message}</p>}
  </section>;
}
