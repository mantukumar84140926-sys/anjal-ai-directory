import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { tools } from "@/data/tools";
import { trackToolClick } from "@/lib/analytics";
import { SEO } from "@/components/SEO";

export default function Go(){const{slug}=useParams();const tool=tools.find(t=>t.slug===slug);useEffect(()=>{if(tool){trackToolClick(tool.slug);const timer=window.setTimeout(()=>window.location.replace(tool.website),450);return()=>window.clearTimeout(timer);}},[tool]);if(!tool)return <div className="mx-auto max-w-xl px-4 py-20 text-center"><SEO title="Tool not found — Anjal AI" description="The requested AI tool was not found." noindex/><h1 className="text-3xl font-semibold">Tool not found</h1><Link to="/" className="mt-4 inline-block text-teal">Back to directory</Link></div>;return <div className="mx-auto max-w-xl px-4 py-24 text-center"><SEO title={`Opening ${tool.name} — Anjal AI`} description={`Opening the official ${tool.name} website.`} noindex/><div className="rounded-3xl border border-line bg-white p-8 shadow-card dark:border-line-dark dark:bg-surface-dark"><p className="text-sm text-slate">Taking you to the official website…</p><h1 className="mt-2 text-2xl font-semibold">{tool.name}</h1><a href={tool.website} className="mt-5 inline-block text-teal">Continue manually</a></div></div>}
