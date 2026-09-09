import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, SlidersHorizontal, X, Moon, Sun, Menu } from "lucide-react";
import { Link, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { tools } from "@/data/tools";
import { categories } from "@/data/categories";
import { ToolCard } from "@/components/ToolCard";
import { ToolLogo } from "@/components/ToolLogo";
import { SEO } from "@/components/SEO";
import { AdSense } from "@/components/AdSense";
import { trackPageView } from "@/lib/analytics";
import { useTheme } from "@/context/ThemeContext";
import Finder from "@/pages/Finder";
import ToolDetail from "@/pages/ToolDetail";
import Submit from "@/pages/Submit";
import Claim from "@/pages/Claim";
import Go from "@/pages/Go";

function Shell({ children }: { children: React.ReactNode }) {
  const { dark, toggle } = useTheme();
  const location = useLocation();
  useEffect(() => { trackPageView(); }, [location.pathname]);
  return <div className="min-h-screen"><header className="sticky top-0 z-30 border-b border-line bg-porcelain/95 backdrop-blur dark:border-line-dark dark:bg-ink/95"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3"><Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-xs font-bold text-white">AI</span>Anjal AI</Link><nav className="hidden items-center gap-5 text-sm text-slate md:flex"><Link to="/finder" className="hover:text-teal">AI Finder</Link><Link to="/submit" className="hover:text-teal">Submit tool</Link></nav><button onClick={toggle} className="rounded-lg border border-line p-2 dark:border-line-dark" aria-label="Toggle theme">{dark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}</button></div></header>{children}<footer className="mt-16 border-t border-line px-4 py-8 dark:border-line-dark"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate sm:flex-row sm:items-center sm:justify-between"><span>© 2026 Anjal AI Directory</span><div className="flex gap-4"><Link to="/finder" className="hover:text-teal">Finder</Link><Link to="/submit" className="hover:text-teal">Submit</Link></div></div></footer></div>;
}

function Home(){
  const [params,setParams]=useSearchParams();
  const [q,setQ]=useState(params.get("q")||"");
  const [cat,setCat]=useState(params.get("category")||"");
  const [pricing,setPricing]=useState(params.get("pricing")||"Any");
  const [platform,setPlatform]=useState(params.get("platform")||"Any");
  const [sort,setSort]=useState("Popular");
  const [showFilters,setShowFilters]=useState(false);
  const update=(next:Record<string,string>)=>{const p=new URLSearchParams(params);Object.entries(next).forEach(([k,v])=>v?p.set(k,v):p.delete(k));setParams(p,{replace:true});};
  useEffect(()=>{setQ(params.get("q")||"");setCat(params.get("category")||"");setPricing(params.get("pricing")||"Any");setPlatform(params.get("platform")||"Any")},[params]);
  const platforms=useMemo(()=>Array.from(new Set(tools.flatMap(t=>t.platforms))).sort(),[]);
  const filtered=useMemo(()=>{let list=tools.filter(t=>(!q||`${t.name} ${t.description} ${t.categories.join(" ")} ${t.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))&&(!cat||t.categories.includes(cat))&& (pricing==="Any"||t.pricingType.toLowerCase().includes(pricing.toLowerCase())) && (platform==="Any"||t.platforms.includes(platform)));if(sort==="A-Z")list.sort((a,b)=>a.name.localeCompare(b.name));if(sort==="Newest")list.sort((a,b)=>Number(b.isNew)-Number(a.isNew));if(sort==="Rated")list.sort((a,b)=>(b.rating??-1)-(a.rating??-1));return list;},[q,cat,pricing,platform,sort]);
  const clear=()=>{setQ("");setCat("");setPricing("Any");setPlatform("Any");setParams({},{replace:true});};
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12"><SEO title="Anjal AI — Discover 500+ AI Tools" description="Discover 500+ AI tools for writing, coding, design, research, marketing, education and productivity. Compare categories and visit official websites." canonical={window.location.origin} />
    <section className="mx-auto max-w-4xl text-center"><span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-teal-700 dark:border-line-dark dark:bg-surface-dark"><Sparkles className="h-3.5 w-3.5"/>500 AI tools indexed</span><h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">Find the right AI tool.</h1><p className="mt-4 text-slate">Search, filter and explore AI tools. Official links are provided; unverified commercial fields are clearly marked.</p><div className="mt-7 flex items-center gap-2 rounded-2xl border border-line bg-white p-2 shadow-card dark:border-line-dark dark:bg-surface-dark"><Search className="ml-2 h-5 w-5 text-slate"/><input className="w-full bg-transparent px-2 py-3 outline-none" placeholder="Search AI tools..." value={q} onChange={e=>{setQ(e.target.value);update({q:e.target.value})}}/><Link to="/finder" className="hidden shrink-0 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white sm:block">AI Finder</Link></div></section>
    <AdSense />
    <section className="mt-8 rounded-2xl border border-line bg-white p-4 dark:border-line-dark dark:bg-surface-dark"><div className="flex items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><button onClick={()=>{setCat("");update({category:""})}} className={`rounded-full border px-3 py-1.5 text-xs ${!cat?"border-teal bg-teal-50 text-teal-700":"border-line dark:border-line-dark"}`}>All</button>{categories.map(c=><button key={c.slug} onClick={()=>{setCat(c.slug);update({category:c.slug})}} className={`rounded-full border px-3 py-1.5 text-xs ${cat===c.slug?"border-teal bg-teal-50 text-teal-700":"border-line dark:border-line-dark"}`}>{c.name}</button>)}</div><button onClick={()=>setShowFilters(v=>!v)} className="flex shrink-0 items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs dark:border-line-dark"><SlidersHorizontal className="h-3.5 w-3.5"/>Filters</button></div>{showFilters&&<div className="mt-4 grid gap-3 border-t border-line pt-4 dark:border-line-dark sm:grid-cols-3"><label className="text-xs text-slate">Pricing<select value={pricing} onChange={e=>{setPricing(e.target.value);update({pricing:e.target.value})}} className="mt-1 w-full rounded-lg border border-line bg-transparent p-2 text-sm text-inherit dark:border-line-dark"><option>Any</option><option>Free</option><option>Freemium</option><option>Paid</option><option>Unknown</option></select></label><label className="text-xs text-slate">Platform<select value={platform} onChange={e=>{setPlatform(e.target.value);update({platform:e.target.value})}} className="mt-1 w-full rounded-lg border border-line bg-transparent p-2 text-sm text-inherit dark:border-line-dark"><option>Any</option>{platforms.map(p=><option key={p}>{p}</option>)}</select></label><label className="text-xs text-slate">Sort<select value={sort} onChange={e=>setSort(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-transparent p-2 text-sm text-inherit dark:border-line-dark"><option>Popular</option><option>A-Z</option><option>Rated</option><option>Newest</option></select></label></div>}</section>
    <div className="mt-6 flex items-center justify-between"><p className="text-sm text-slate">{filtered.length} tools found</p>{(q||cat||pricing!=="Any"||platform!=="Any")&&<button onClick={clear} className="flex items-center gap-1 text-sm text-teal"><X className="h-4 w-4"/>Clear</button>}</div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{filtered.slice(0,100).map(t=><ToolCard key={t.id} tool={t}/>)}</div>{filtered.length>100&&<p className="mt-8 text-center text-sm text-slate">Showing the first 100 matches. Refine your search to explore more.</p>}
  </main>
}

function App(){return <Shell><Routes><Route path="/" element={<Home/>}/><Route path="/finder" element={<Finder/>}/><Route path="/tool/:slug" element={<ToolDetail/>}/><Route path="/go/:slug" element={<Go/>}/><Route path="/submit" element={<Submit/>}/><Route path="/claim/:slug" element={<Claim/>}/><Route path="*" element={<Home/>}/></Routes></Shell>}
export default App;
