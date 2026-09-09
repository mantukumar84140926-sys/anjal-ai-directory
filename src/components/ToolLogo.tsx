import { useState } from "react";

function domainFromUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export function ToolLogo({ name, website, size = "md" }: { name: string; website: string; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const domain = domainFromUrl(website);
  const dims = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  if (failed || !domain) return <div className={`${dims} flex shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold text-teal-800 dark:bg-teal-950/50 dark:text-teal-200`}>{name.slice(0, 2).toUpperCase()}</div>;
  return <img className={`${dims} shrink-0 rounded-xl border border-line bg-white object-contain p-1.5 dark:border-line-dark`} src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`} alt={`${name} logo`} loading="lazy" onError={() => setFailed(true)} />;
}
