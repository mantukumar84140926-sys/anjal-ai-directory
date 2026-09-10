import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { tools } from "@/data/tools";
import { categories } from "@/data/categories";
import { ToolCard } from "@/components/ToolCard";
import { SEO } from "@/components/SEO";

const useCases = ["Writing", "Coding", "Design", "Marketing", "Research", "Education", "Productivity", "Video", "Audio & Music"];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const matchesUseCase = (category: string, useCase: string) => normalize(category).includes(normalize(useCase)) || (useCase === "Video" && normalize(category).includes("videogeneration")) || (useCase === "Audio & Music" && normalize(category).includes("audiomusic"));

export default function Finder() {
  const [useCase, setUseCase] = useState("");
  const [budget, setBudget] = useState("Any");
  const [skill, setSkill] = useState("Any");
  const matches = useMemo(() => {
    const scored = tools.map(tool => {
      let score = 0;
      if (useCase && tool.categories.some(c => matchesUseCase(c, useCase))) score += 5;
      if (budget !== "Any" && tool.pricingType.toLowerCase().includes(budget.toLowerCase())) score += 4;
      if (skill === "Beginner" && !tool.categories.some(c => /developer|coding/i.test(c))) score += 2;
      if (skill === "Advanced" && tool.categories.some(c => /developer|coding|research/i.test(c))) score += 2;
      return { tool, score };
    }).filter(({ tool, score }) => (!useCase || score >= 5) && (budget === "Any" || tool.pricingType.toLowerCase().includes(budget.toLowerCase())) && (skill === "Any" || score > (useCase ? 5 : 0)));
    return scored.sort((a,b)=>b.score-a.score || a.tool.name.localeCompare(b.tool.name)).slice(0,24).map(x=>x.tool);
  }, [useCase, budget, skill]);
  return <div className="mx-auto max-w-7xl px-4 py-10"><SEO title="AI Tool Finder — Find the Best AI Tool | Anjal AI" description="Answer a few questions and discover AI tools for writing, coding, design, research, education, marketing and productivity." canonical={`${window.location.origin}/finder`} />
    <section className="mx-auto max-w-4xl rounded-3xl border border-line bg-white p-7 text-center shadow-card dark:border-line-dark dark:bg-surface-dark"><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800"><Sparkles className="h-3.5 w-3.5" /> AI Tool Finder</span><h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Tell us what you need.</h1><p className="mx-auto mt-3 max-w-2xl text-slate">Use practical filters to narrow all {tools.length} catalog entries. Recommendations are ranked from directory metadata, not paid placement.</p>
      <div className="mt-8 grid gap-4 text-left md:grid-cols-3"><label className="text-sm font-medium">Use case<select value={useCase} onChange={e=>setUseCase(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"><option value="">Any use case</option>{useCases.map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm font-medium">Budget<select value={budget} onChange={e=>setBudget(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"><option>Any</option><option>Free</option><option>Freemium</option><option>Paid</option><option>Unknown</option></select></label><label className="text-sm font-medium">Skill level<select value={skill} onChange={e=>setSkill(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"><option>Any</option><option>Beginner</option><option>Advanced</option></select></label></div>
    </section><div className="mt-10 flex items-center justify-between"><h2 className="text-2xl font-semibold">Recommended tools</h2><Link to="/" className="inline-flex items-center gap-1 text-sm text-teal">Browse all <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{matches.map(t=><ToolCard key={t.id} tool={t}/>)}</div>{!matches.length&&<p className="mt-8 text-center text-sm text-slate">No exact matches yet. Try a broader use case or budget.</p>}<div className="mt-10 flex flex-wrap gap-2">{categories.slice(0,10).map(c=><Link key={c.slug} to={`/?category=${c.slug}`} className="rounded-full border border-line px-3 py-1.5 text-xs dark:border-line-dark">{c.name}</Link>)}</div>
  </div>;
}
