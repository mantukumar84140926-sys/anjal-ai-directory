import { useEffect } from "react";

export function SEO({ title, description, canonical, noindex = false, jsonLd }: { title: string; description: string; canonical?: string; noindex?: boolean; jsonLd?: Record<string, unknown> }) {
  useEffect(() => {
    document.title = title;
    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = content;
    };
    setMeta("description", description);
    setMeta("robots", noindex ? "noindex,nofollow" : "index,follow");
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", "website", "property");
    if (canonical) {
      let link = document.head.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
      if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
      link.href = canonical;
    }
    let script = document.getElementById("anjal-jsonld");
    if (jsonLd) {
      if (!script) { script = document.createElement("script"); script.id = "anjal-jsonld"; script.type = "application/ld+json"; document.head.appendChild(script); }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) script.remove();
    return () => { const current = document.getElementById("anjal-jsonld"); if (current) current.remove(); };
  }, [title, description, canonical, noindex, jsonLd]);
  return null;
}
