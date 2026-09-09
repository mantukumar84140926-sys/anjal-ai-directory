import { useEffect } from "react";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { tools } from "@/data/tools";
import { ToolLogo } from "@/components/ToolLogo";
import { SEO } from "@/components/SEO";
import { AdSense } from "@/components/AdSense";
import { trackToolView, trackToolClick } from "@/lib/analytics";

export default function ToolDetail() {
  const { slug } = useParams();
  const tool = tools.find(t => t.slug === slug);
  useEffect(() => { if (tool) trackToolView(tool.slug); }, [tool]);
  if (!tool) return <div className="mx-auto max-w-5xl px-4 py-20"><h1 className="text-3xl font-semibold">Tool not found</h1><Link to="/" className="mt-4 inline-block text-teal">Back to directory</Link></div>;
  const canonical = `${window.location.origin}/tool/${tool.slug}`;
  const offers = tool.pricingType === "Free" ? { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free" } : undefined;
  const jsonLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: tool.name, description: tool.description, url: tool.website, applicationCategory: tool.categories[0], operatingSystem: tool.platforms.join(", "), offers };
  return <div className="mx-auto max-w-5xl px-4 py-10">
    <SEO title={`${tool.name} — AI Tool | Anjal AI`} description={`${tool.name}: ${tool.description} Explore pricing, category, platform information and the official website.`} canonical={canonical} jsonLd={jsonLd} />
    <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate hover:text-teal"><ArrowLeft className="h-4 w-4" /> All AI tools</Link>
    <section className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-card dark:border-line-dark dark:bg-surface-dark sm:p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ToolLogo name={tool.name} website={tool.website} size="lg" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">{tool.categories[0]}</span><span className="rounded-full bg-line/70 px-3 py-1 text-xs dark:bg-white/10">{tool.pricingType === "Unknown" ? "Pricing not verified" : tool.pricingType}</span></div><h1 className="mt-4 text-4xl font-semibold">{tool.name}</h1><p className="mt-4 max-w-3xl text-slate">{tool.description}</p>
          <div className="mt-6 flex flex-wrap gap-3"><a href={tool.website} target="_blank" rel="noopener noreferrer" onClick={() => trackToolClick(tool.slug)} className="inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-3 font-semibold text-white hover:opacity-90">Visit official website <ExternalLink className="h-4 w-4" /></a><Link to={`/claim/${tool.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 font-semibold hover:border-teal dark:border-line-dark">Claim this listing</Link></div>
        </div>
      </div>
      <AdSense />
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Pricing</p><p className="mt-1 font-semibold">{tool.pricingType === "Unknown" ? "Not verified" : tool.pricingType}</p></div><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Platforms</p><p className="mt-1 font-semibold">{tool.platforms.join(", ")}</p></div><div className="rounded-2xl bg-line/40 p-4 dark:bg-white/5"><p className="text-xs text-slate">Verification</p><p className="mt-1 flex items-center gap-1 font-semibold"><ShieldCheck className="h-4 w-4 text-teal" /> {tool.verificationStatus === "link-only" ? "Website verified" : tool.verificationStatus}</p></div></div>
      <div className="mt-8"><h2 className="text-xl font-semibold">About this listing</h2><p className="mt-3 text-sm leading-7 text-slate">Anjal AI provides an independent discovery listing for {tool.name}. Commercial details are only displayed when verified; otherwise they are clearly marked as unavailable. Use the official website for the latest product information.</p></div>
    </section>
  </div>;
}
