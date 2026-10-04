import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { tools } from "@/data/tools";
import { categories } from "@/data/categories";
import { ToolCard } from "@/components/ToolCard";
import { SEO } from "@/components/SEO";
import { rankTools } from "@/lib/toolRanking";

const useCases = ["Writing", "Coding", "Design", "Marketing", "Research", "Education", "Productivity", "Video", "Audio & Music"];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const matchesUseCase = (category: string, useCase: string) => normalize(category).includes(normalize(useCase)) || (useCase === "Video" && normalize(category).includes("videogeneration")) || (useCase === "Audio & Music" && normalize(category).includes("audiomusic"));

export default function Finder() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [useCase, setUseCase] = useState(params.get("use") || "");
  const [budget, setBudget] = useState(params.get("budget") || "Any");
  const [skill, setSkill] = useState(params.get("skill") || "Any");
  const matches = useMemo(() => {
    let list = query.trim() ? rankTools(query, tools) : tools;
    list = list.filter(tool => (!useCase || tool.categories.some(c => matchesUseCase(c, useCase))) && (budget === "Any" || tool.pricingType.toLowerCase().includes(budget.toLowerCase())) && (skill === "Any" || (skill === "Beginner" ? !tool.categories.some(c => /developer|coding/i.test(c)) : tool.categories.some(c => /developer|coding|research/i.test(c)))));
    return list.slice(0, 24);
  }, [query, useCase, budget, skill]);
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  return <div className="mx-auto max-w-7xl px-4 py-10"><SEO title="AI Tool Finder — Find the Best AI Tool | Anjal AI" description="Find AI tools for writing, coding, design, research, education, marketing, video and productivity using practical recommendations." canonical={`${window.location.origin}/finder`} />
    <section className="mx-auto max-w-4xl rounded-3xl border border-line bg-white p-7 text-center shadow-card dark:border-line-dark dark:bg-surface-dark"><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800"><Sparkles className="h-3.5 w-3.5" /> AI Tool Finder</span><h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Find the right AI tool.</h1><p className="mx-auto mt-3 max-w-2xl text-slate">Search all {tools.length} tools using task words, then narrow results by use case, budget and skill level.</p>
      <div className="mt-7 flex items-center gap-2 rounded-2xl border border-line bg-white p-2 dark:border-line-dark dark:bg-surface-dark"><Search className="ml-2 h-5 w-5 text-slate" /><input aria-label="Search the AI tool finder" className="w-full bg-transparent px-2 py-3 outline-none" placeholder="Try: free AI for study, thumbnails, coding..." value={query} onChange={e=>{setQuery(e.target.value);update("q",e.target.value)}} /></div><div className="mt-5 grid gap-4 text-left md:grid-cols-3"><label className="text-sm font-medium">Use case<select value={useCase} onChange={e=>{setUseCase(e.target.value);update("use",e.target.value)}} className="mt-2 w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"><option value="">Any use case</option>{useCases.map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm font-medium">Budget<select value={budget} onChange={e=>{setBudget(e.target.value);update("budget",e.target.value)}} className="mt-2 w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"><option>Any</option><option>Not verified</option></select></label><label className="text-sm font-medium">Skill level<select value={skill} onChange={e=>{setSkill(e.target.value);update("skill",e.target.value)}} className="mt-2 w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"><option>Any</option><option>Beginner</option><option>Advanced</option></select></label></div>
    </section><div className="mt-10 flex items-center justify-between"><h2 className="text-2xl font-semibold">Recommended tools</h2><Link to="/" className="inline-flex items-center gap-1 text-sm text-teal">Browse all <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{matches.map(t=><ToolCard key={t.id} tool={t}/>)}</div>{!matches.length&&<p className="mt-8 text-center text-sm text-slate">No exact matches yet. Try a broader use case or budget.</p>}<div className="mt-10 flex flex-wrap gap-2">{categories.slice(0,16).map(c=><Link key={c.slug} to={`/category/${c.slug}`} className="rounded-full border border-line px-3 py-1.5 text-xs dark:border-line-dark">{c.name}</Link>)}</div>
  </div>;
}
