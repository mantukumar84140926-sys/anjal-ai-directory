import { useEffect } from "react";
import { ArrowLeft, ExternalLink, ShieldCheck, Tag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { tools } from "@/data/tools";
import { ToolLogo } from "@/components/ToolLogo";
import { SEO } from "@/components/SEO";
import { AdSense } from "@/components/AdSense";
import { trackToolView } from "@/lib/analytics";

export default function ToolDetail() {
  const { slug } = useParams();
  const tool = tools.find(t => t.slug === slug);
  useEffect(() => { if (tool) trackToolView(tool.slug); }, [tool]);
  if (!tool) return <div className="mx-auto max-w-5xl px-4 py-20"><SEO title="Tool not found — Anjal AI" description="The requested AI tool was not found." noindex/><h1 className="text-3xl font-semibold">Tool not found</h1><Link to="/" className="mt-4 inline-block text-teal">Back to directory</Link></div>;
  const canonical = `${window.location.origin}/tool/${tool.slug}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: tool.name, description: tool.description, url: tool.website, applicationCategory: tool.categories[0], operatingSystem: tool.platforms.join(", ") };
  const pricingLabel = tool.pricingType === "Unknown" ? "Not verified" : tool.pricingType;
  return <div className="mx-auto max-w-5xl px-4 py-10">
    <SEO title={`${tool.name} — AI Tool | Anjal AI`} description={`${tool.name}: ${tool.description} Explore category, platform information and the official website.`} canonical={canonical} jsonLd={jsonLd} />
    <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate hover:text-teal"><ArrowLeft className="h-4 w-4" /> All AI tools</Link>
    <section className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-card dark:border-line-dark dark:bg-surface-dark sm:p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ToolLogo name={tool.name} website={tool.website} size="lg" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">{tool.categories[0]}</span><span className="rounded-full bg-line/70 px-3 py-1 text-xs dark:bg-white/10">{pricingLabel}</span></div><h1 className="mt-4 break-words text-4xl font-semibold">{tool.name}</h1><p className="mt-4 max-w-3xl text-slate">{tool.description}</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link to={`/go/${tool.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-3 font-semibold text-white hover:opacity-90">Visit official website <ExternalLink className="h-4 w-4" /></Link><Link to={`/claim/${tool.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold hover:border-teal dark:border-line-dark">Claim this listing</Link></div>
        </div>
      </div>
      <AdSense />
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Pricing</p><p className="mt-1 font-semibold">{pricingLabel}</p></div><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Platforms</p><p className="mt-1 font-semibold">{tool.platforms.join(", ")}</p></div><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Verification</p><p className="mt-1 flex items-center gap-1 font-semibold"><ShieldCheck className="h-4 w-4 text-teal" /> {tool.verificationStatus === "link-only" ? "Website link checked" : tool.verificationStatus}</p></div></div>
      <div className="mt-8"><h2 className="text-xl font-semibold">About this listing</h2><p className="mt-3 text-sm leading-7 text-slate">Anjal AI is an independent discovery directory. We show commercial details only when supported by reliable data; otherwise they are explicitly marked as not verified. Always use the official website for current pricing and product capabilities.</p>{tool.tags.length>0&&<div className="mt-4 flex flex-wrap gap-2">{tool.tags.map(tag=><span key={tag} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs dark:border-line-dark"><Tag className="h-3 w-3"/>{tag}</span>)}</div>}</div>
    </section>
  </div>;
}
