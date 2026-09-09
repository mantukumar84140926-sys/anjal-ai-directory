import { useEffect } from "react";

export function AdSense() {
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
  useEffect(() => {
    if (!client || document.getElementById("adsense-script")) return;
    const script = document.createElement("script");
    script.id = "adsense-script";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(script);
  }, [client]);
  return client ? <div className="my-6 min-h-[90px] overflow-hidden rounded-2xl border border-line/70 dark:border-line-dark" aria-label="Advertisement" /> : null;
}
