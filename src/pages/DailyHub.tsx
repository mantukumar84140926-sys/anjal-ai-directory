import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Copy, Flame, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/data/tools";
import { generatedPrompts } from "@/data/generatedPrompts";

const challenges = [
  { title: "Create one useful image with AI", detail: "Pick an image tool, write a clear prompt, and generate one visual you can actually use." },
  { title: "Turn one idea into a short video", detail: "Use an AI video tool to turn a simple idea into a 10–15 second clip." },
  { title: "Automate a repetitive task", detail: "Find one task you repeat every week and test an AI tool that can reduce the manual work." },
  { title: "Improve one old prompt", detail: "Take a prompt you already use and add context, constraints, output format, and quality checks." },
  { title: "Build a mini content plan", detail: "Use an AI assistant to turn one topic into three post ideas and a practical publishing plan." },
  { title: "Learn a new AI tool", detail: "Try a tool you have never used and note one real task it helps you complete." },
  { title: "Make a workflow with two AI tools", detail: "Pass the output of one tool into another and create a repeatable mini-workflow." }
];

const tips = [
  "Give AI a role, a goal, your context, and the exact format you want back.",
  "Ask AI to list assumptions before it creates a plan. Correcting assumptions early saves time.",
  "For better image results, describe subject, composition, lighting, lens, background, and what must stay unchanged.",
  "Use one AI tool for each clear job instead of asking one tool to do everything.",
  "Ask for three different approaches, compare them, then refine the strongest one.",
  "Save prompts that produce useful results and record what changed between versions.",
  "Verify important facts and links before publishing AI-generated content."
];

function localDateKey() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function dayNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export default function DailyHub() {
  const today = localDateKey();
  const index = dayNumber(today);
  const [copied, setCopied] = useState(false);
  const [completed, setCompleted] = useState(() => {
    try { return window.localStorage.getItem(`anjal-daily-challenge-${today}`) === "done"; }
    catch { return false; }
  });

  const dailyTools = useMemo(() => {
    const sorted = [...tools].sort((a, b) => a.slug.localeCompare(b.slug));
    if (!sorted.length) return [];
    return [0, 1, 2].map(offset => sorted[(index * 3 + offset * 11) % sorted.length]);
  }, [index]);

  const prompt = generatedPrompts[index % generatedPrompts.length];
  const challenge = challenges[index % challenges.length];
  const tip = tips[index % tips.length];

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const toggleChallenge = () => {
    const next = !completed;
    setCompleted(next);
    try {
      if (next) window.localStorage.setItem(`anjal-daily-challenge-${today}`, "done");
      else window.localStorage.removeItem(`anjal-daily-challenge-${today}`);
    } catch {
      // The daily hub remains usable when local storage is unavailable.
    }
  };

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
    <SEO title="Daily AI Hub — Tools, Prompts & Challenges | Anjal AI" description="Discover a fresh daily selection of AI tools, a practical prompt, one AI tip, and a small challenge to build your AI skills." canonical="/daily" jsonLd={{"@context":"https://schema.org","@type":"WebPage","name":"Daily AI Hub","description":"Daily AI tools, prompts, tips and challenges from Anjal AI.","url":"https://anjal-ai-directory.vercel.app/daily"}} />
    <section className="rounded-3xl border border-line bg-white p-6 shadow-card dark:border-line-dark dark:bg-surface-dark sm:p-9">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal"><CalendarDays className="h-4 w-4" /> Your daily AI reset <span className="rounded-full bg-teal/10 px-2.5 py-1 normal-case tracking-normal text-teal-700 dark:text-teal-300">{today}</span></div>
      <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_0.8fr] md:items-end">
        <div><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">One small AI discovery. Every day.</h1><p className="mt-4 max-w-2xl text-slate">A daily shortlist of tools, a ready-to-use prompt, and a practical challenge. Build your AI skills one useful experiment at a time.</p><div className="mt-6 flex flex-wrap gap-3"><Link to="/finder" className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white">Find an AI tool <ArrowRight className="h-4 w-4" /></Link><Link to="/prompts" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold dark:border-line-dark">Explore 5,000 prompts</Link></div></div>
        <div className="rounded-2xl bg-porcelain p-5 dark:bg-ink"><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-teal" /> Today's AI tip</div><p className="mt-3 text-sm leading-6 text-slate">{tip}</p><p className="mt-4 text-xs text-slate">Tip {index % tips.length + 1} · Rotates daily</p></div>
      </div>
    </section>

    <section className="mt-9">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Explore something useful</p><h2 className="mt-2 text-2xl font-semibold">Today's AI tool picks</h2><p className="mt-1 text-sm text-slate">Three picks rotate daily from the existing directory catalog.</p></div><Link to="/" className="text-sm font-medium text-teal hover:underline">Browse full directory</Link></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{dailyTools.map(tool => <ToolCard key={tool.id} tool={tool} />)}</div>
    </section>

    <section className="mt-9 grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-line bg-white p-5 dark:border-line-dark dark:bg-surface-dark sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal"><Target className="h-4 w-4" /> Daily challenge</div>
        <h2 className="mt-3 text-2xl font-semibold">{challenge.title}</h2><p className="mt-2 text-sm leading-6 text-slate">{challenge.detail}</p>
        <button onClick={toggleChallenge} className={`mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${completed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-teal text-white"}`}><CheckCircle2 className="h-4 w-4" />{completed ? "Challenge completed" : "Mark as completed"}</button>
        <p className="mt-3 text-xs text-slate">Your completion is saved on this device for today.</p>
      </article>
      <article className="rounded-2xl border border-line bg-white p-5 dark:border-line-dark dark:bg-surface-dark sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal"><Flame className="h-4 w-4" /> Prompt of the day</div>
        <h2 className="mt-3 text-2xl font-semibold">{prompt.title}</h2><p className="mt-2 text-sm text-slate">{prompt.description}</p>
        <div className="mt-4 rounded-xl bg-porcelain p-4 dark:bg-ink"><p className="whitespace-pre-wrap text-sm leading-6">{prompt.prompt}</p></div>
        <div className="mt-4 flex flex-wrap gap-3"><button onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-semibold text-white"><Copy className="h-4 w-4" />{copied ? "Copied!" : "Copy prompt"}</button><Link to="/prompts" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold dark:border-line-dark">Open Prompt Finder <ArrowRight className="h-4 w-4" /></Link></div>
      </article>
    </section>
    <p className="mt-6 text-center text-xs text-slate">Daily picks are rotated from the current catalog. Automated live research and publishing will be added in the next backend phase.</p>
  </main>;
}
