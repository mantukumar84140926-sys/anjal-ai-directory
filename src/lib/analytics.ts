import { supabase } from "./supabase";

export async function track(event: string, toolSlug?: string, metadata: Record<string, unknown> = {}) {
  if (!supabase) return;
  try {
    await supabase.from("tool_events").insert({
      event,
      tool_slug: toolSlug || null,
      path: window.location.pathname,
      referrer: document.referrer || null,
      metadata,
    });
  } catch {
    // Analytics must never block the user experience.
  }
}

export function trackPageView() { void track("page_view"); }
export function trackToolView(slug: string) { void track("tool_view", slug); }
export function trackToolClick(slug: string) { void track("tool_click", slug); }
