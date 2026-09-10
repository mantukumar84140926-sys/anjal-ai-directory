import { useEffect } from "react";

type SEOProps = { title: string; description: string; canonical?: string; noindex?: boolean; jsonLd?: Record<string, unknown> };

export function SEO({ title, description, canonical, noindex = false, jsonLd }: SEOProps) {
  useEffect(() => {
    document.title = title;
    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = content;
    };
    setMeta("description", description);
    setMeta("robots", noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large");
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:site_name", "Anjal AI", "property");
    if (canonical) {
      setMeta("og:url", canonical, "property");
      let link = document.head.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
      if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
      link.href = canonical;
    }
    let script = document.getElementById("anjal-jsonld") as HTMLScriptElement | null;
    if (jsonLd) {
      if (!script) { script = document.createElement("script"); script.id = "anjal-jsonld"; script.type = "application/ld+json"; document.head.appendChild(script); }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) script.remove();
    return () => { document.getElementById("anjal-jsonld")?.remove(); };
  }, [title, description, canonical, noindex, jsonLd]);
  return null;
}
