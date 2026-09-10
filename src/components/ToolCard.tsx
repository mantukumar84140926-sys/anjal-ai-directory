import { ExternalLink, ArrowUpRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tool } from "@/types/tool";
import { ToolLogo } from "./ToolLogo";

export function ToolCard({ tool }: { tool: Tool }) {
  return <article className="group rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg dark:border-line-dark dark:bg-surface-dark">
    <div className="flex items-start justify-between gap-3">
      <ToolLogo name={tool.name} website={tool.website} />
      <Link to={`/go/${tool.slug}`} className="rounded-lg p-2 text-slate hover:bg-line/50 hover:text-teal" aria-label={`Visit ${tool.name}`}><ExternalLink className="h-4 w-4" /></Link>
    </div>
    <Link to={`/tool/${tool.slug}`} className="block">
      <h2 className="mt-4 text-lg font-semibold group-hover:text-teal">{tool.name}</h2>
      <p className="mt-2 line-clamp-2 text-sm text-slate">{tool.description}</p>
    </Link>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-line/70 px-2 py-1 text-[11px] dark:bg-white/10">{tool.categories[0]}</span>
      <span className="rounded-full bg-line/70 px-2 py-1 text-[11px] dark:bg-white/10">{tool.pricingType === "Unknown" ? "Pricing not verified" : tool.pricingType}</span>
      {tool.rating ? <span className="ml-auto flex items-center gap-1 text-[11px] text-slate"><Star className="h-3 w-3 fill-current" />{tool.rating.toFixed(1)}</span> : <span className="ml-auto text-[11px] text-slate">Official link</span>}
    </div>
    <Link to={`/tool/${tool.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal">View details <ArrowUpRight className="h-3.5 w-3.5" /></Link>
  </article>;
}
