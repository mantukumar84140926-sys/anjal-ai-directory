import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { SEO } from "@/components/SEO";
import { prompts } from "@/pages/PromptLibrary";

export default function PromptDetail() {
  const { slug = "" } = useParams();
  const prompt = prompts.find(item => item.command.replace(/^\\//, "").toLowerCase() === slug.toLowerCase());
  const [copied, setCopied] = useState(false);
  const generated = prompt?.command.startsWith("/prompt-") ?? true;
  const related = useMemo(() => prompt ? prompts.filter(item => item.command !== prompt.command && item.category === prompt.category && !item.command.startsWith("/prompt-")).slice(0, 6) : [], [prompt]);
  if (!prompt) return <main className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-3xl font-semibold">Prompt not found</h1><p className="mt-3 text-slate">This prompt may have moved. Browse the prompt library to find another one.</p><Link className="mt-5 inline-block text-teal underline" to="/prompts">Browse AI prompts</Link></main>;
  const title = `${prompt.title} Prompt — ${prompt.category} AI | Anjal AI`.slice(0, 60);
  const description = `${prompt.description} Copy this free ${prompt.category.toLowerCase()} AI prompt and customize it for your task.`.slice(0, 158);
  async function copy() {
    try { await navigator.clipboard.writeText(prompt.prompt); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  }
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
    <SEO title={title} description={description} canonical={`https://anjal-ai-directory.vercel.app/prompt/${slug}`} noindex={generated} jsonLd={{"@context":"https://schema.org","@type":"CreativeWork",name:prompt.title,description,url:`https://anjal-ai-directory.vercel.app/prompt/${slug}`,genre:prompt.category,keywords:prompt.tags.join(", ")}} />
    <nav className="text-sm text-slate"><Link to="/">Home</Link> / <Link to="/prompts">Prompt Library</Link> / {prompt.title}</nav>
    <span className="mt-6 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:bg-teal/15 dark:text-teal-300">{prompt.category}</span>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">{prompt.title} Prompt</h1>
    <p className="mt-4 text-lg text-slate">{prompt.description}</p>
    <section className="mt-8 rounded-2xl border border-line bg-white p-5 dark:border-line-dark dark:bg-surface-dark">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Copy-ready AI prompt</h2><button onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white">{copied ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}{copied ? "Copied" : "Copy prompt"}</button></div>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-porcelain p-4 text-sm leading-6 text-ink dark:bg-ink dark:text-porcelain">{prompt.prompt}</pre>
      <p className="mt-3 text-sm text-slate">Tip: replace every bracketed placeholder with your own details before using the prompt.</p>
    </section>
    <section className="mt-8"><h2 className="text-xl font-semibold">Prompt keywords</h2><div className="mt-3 flex flex-wrap gap-2">{prompt.tags.map(tag => <span key={tag} className="rounded-full border border-line px-3 py-1 text-sm text-slate dark:border-line-dark">{tag}</span>)}</div></section>
    {related.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Related {prompt.category} prompts</h2><ul className="mt-3 grid gap-2 sm:grid-cols-2">{related.map(item => <li key={item.command}><Link className="text-teal hover:underline" to={`/prompt/${item.command.replace(/^\\//, "")}`}>{item.title}</Link></li>)}</ul></section>}
    <p className="mt-8"><Link className="font-semibold text-teal hover:underline" to="/prompts">← Browse all AI prompts</Link></p>
  </main>;
}
