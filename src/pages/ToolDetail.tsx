import { useEffect, useMemo } from "react";
import { ArrowLeft, ExternalLink, ShieldCheck, Tag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { tools } from "@/data/tools";
import { ToolLogo } from "@/components/ToolLogo";
import { SEO } from "@/components/SEO";
import { AdSense } from "@/components/AdSense";
import { trackToolView } from "@/lib/analytics";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://anjal-ai-directory.vercel.app").replace(/\/$/, "");

export default function ToolDetail() {
  const { slug } = useParams();
  const tool = tools.find(t => t.slug === slug);
  useEffect(() => { if (tool) trackToolView(tool.slug); }, [tool]);
  if (!tool) return <div className="mx-auto max-w-5xl px-4 py-20"><SEO title="AI tool not found — Anjal AI" description="The requested AI tool listing was not found." noindex/><h1 className="text-3xl font-semibold">Tool not found</h1><Link to="/" className="mt-4 inline-block text-teal">Back to AI tools directory</Link></div>;

  const category = tool.categories[0] || "AI Tools";
  const canonical = `${SITE_URL}/tool/${tool.slug}`;
  const related = useMemo(() => tools.filter(t => t.id !== tool.id && t.categories.some(c => tool.categories.includes(c))).slice(0, 6), [tool]);
  const pricingLabel = tool.pricingType === "Unknown" ? "Not verified" : tool.pricingType;
  const description = `${tool.name} is listed in Anjal AI's ${category} collection. Explore its official website, platform information, tags and available directory metadata.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description,
    url: tool.website,
    applicationCategory: category,
    operatingSystem: tool.platforms.join(", "),
    isPartOf: { "@type": "WebSite", name: "Anjal AI", url: SITE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };

  return <div className="mx-auto max-w-5xl px-4 py-10">
    <SEO title={`${tool.name} — ${category} AI Tool | Anjal AI`} description={description} canonical={canonical} jsonLd={jsonLd} />
    <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate hover:text-teal"><ArrowLeft className="h-4 w-4" /> All AI tools</Link>
    <section className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-card dark:border-line-dark dark:bg-surface-dark sm:p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ToolLogo name={tool.name} website={tool.website} size="lg" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">{category}</span><span className="rounded-full bg-line/70 px-3 py-1 text-xs dark:bg-white/10">{pricingLabel}</span></div><h1 className="mt-4 break-words text-4xl font-semibold">{tool.name}</h1><p className="mt-4 max-w-3xl text-slate">{description}</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link to={`/go/${tool.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-3 font-semibold text-white hover:opacity-90">Visit official website <ExternalLink className="h-4 w-4" /></Link><Link to={`/claim/${tool.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold hover:border-teal dark:border-line-dark">Claim this listing</Link></div>
        </div>
      </div>
      <AdSense />
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Pricing</p><p className="mt-1 font-semibold">{pricingLabel}</p></div><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Platforms</p><p className="mt-1 font-semibold">{tool.platforms.join(", ")}</p></div><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Verification</p><p className="mt-1 flex items-center gap-1 font-semibold"><ShieldCheck className="h-4 w-4 text-teal" /> {tool.verificationStatus === "link-only" ? "Website link checked" : tool.verificationStatus}</p></div></div>
      <div className="mt-8"><h2 className="text-xl font-semibold">About {tool.name}</h2><p className="mt-3 text-sm leading-7 text-slate">Anjal AI is an independent AI tools directory. This listing helps visitors discover {tool.name} and reach its official website. Pricing and product capabilities are only presented as verified when reliable data is available.</p>{tool.tags.length>0&&<div className="mt-4 flex flex-wrap gap-2">{tool.tags.map(tag=><span key={tag} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs dark:border-line-dark"><Tag className="h-3 w-3"/>{tag}</span>)}</div>}</div>
      {related.length > 0 && <section className="mt-10 border-t border-line pt-8 dark:border-line-dark"><h2 className="text-xl font-semibold">More {category} AI tools</h2><p className="mt-2 text-sm text-slate">Explore related tools in the same category.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{related.map(t=><Link key={t.id} to={`/tool/${t.slug}`} className="rounded-2xl border border-line p-4 transition hover:border-teal dark:border-line-dark"><span className="font-semibold">{t.name}</span><span className="mt-1 block text-xs text-slate">{t.categories[0] || "AI Tool"}</span></Link>)}</div></section>}
    </section>
  </div>;
}
