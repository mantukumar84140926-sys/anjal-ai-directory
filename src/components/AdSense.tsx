import { useEffect } from "react";

export function AdSense() {
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
  const slot = import.meta.env.VITE_ADSENSE_SLOT as string | undefined;
  useEffect(() => {
    if (!client || document.getElementById("adsense-script")) return;
    const script = document.createElement("script");
    script.id = "adsense-script";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(script);
  }, [client]);
  if (!client) return null;
  if (!slot) return <div className="my-6 rounded-2xl border border-dashed border-line p-4 text-center text-xs text-slate dark:border-line-dark">Ad space · AdSense publisher configuration pending</div>;
  return <div className="my-6 min-h-[90px] overflow-hidden rounded-2xl border border-line/70 dark:border-line-dark" aria-label="Advertisement">
    <ins className="adsbygoogle block" style={{ display: "block", minHeight: 90 }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    <AdSenseLoader />
  </div>;
}

function AdSenseLoader() {
  useEffect(() => {
    try { (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle || []; (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle?.push({}); } catch { /* AdSense may be blocked or unavailable. */ }
  }, []);
  return null;
}
