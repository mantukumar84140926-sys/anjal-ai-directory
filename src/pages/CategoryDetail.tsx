import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { tools } from "@/data/tools";
import { categories } from "@/data/categories";
import { ToolCard } from "@/components/ToolCard";
import { SEO } from "@/components/SEO";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://anjal-ai-directory.vercel.app").replace(/\/$/, "");

export default function CategoryDetail() {
  const { category: slug } = useParams();
  const category = categories.find(c => c.slug === slug);

  const matches = useMemo(() => {
    if (!category) return [];
    return tools.filter(t => t.categories.includes(category.slug));
  }, [category]);

  if (!category) {
    return <main className="mx-auto max-w-5xl px-4 py-20"><SEO title="AI category not found — Anjal AI" description="The requested AI tools category was not found." noindex /><h1 className="text-3xl font-semibold">Category not found</h1><Link to="/" className="mt-4 inline-block text-teal">Back to AI tools</Link></main>;
  }

  const canonical = `${SITE_URL}/category/${category.slug}`;
  const description = `Explore ${matches.length} ${category.name} AI tools in the Anjal AI directory. Browse independent listings, compare related tools and visit official tool websites.`;
  const itemList = matches.slice(0, 50).map((tool, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: tool.name,
    url: `${SITE_URL}/tool/${tool.slug}`
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${category.name} AI Tools | Anjal AI`,
        description,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: "Anjal AI", url: SITE_URL }
      },
      {
        "@type": "ItemList",
        name: `${category.name} AI tools`,
        numberOfItems: matches.length,
        itemListElement: itemList
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "AI Tools", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: category.name, item: canonical }
        ]
      }
    ]
  };

  return <main className="mx-auto max-w-7xl px-4 py-10">
    <SEO title={`${category.name} AI Tools | Anjal AI`} description={description} canonical={canonical} jsonLd={jsonLd} />
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate">
      <Link to="/" className="hover:text-teal">AI Tools</Link><span>›</span><span className="font-medium text-ink dark:text-white">{category.name}</span>
    </nav>
    <section className="mt-6 rounded-3xl border border-line bg-white p-7 shadow-card dark:border-line-dark dark:bg-surface-dark">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate hover:text-teal"><ArrowLeft className="h-4 w-4" /> All AI tools</Link>
      <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">{category.name} AI Tools</h1>
      <p className="mt-4 max-w-3xl text-slate">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate"><span>{matches.length} tools in this category</span><Link to="/finder" className="text-teal hover:underline">Find a tool</Link><Link to="/" className="text-teal hover:underline">Browse all tools</Link></div>
    </section>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {matches.map(tool => <ToolCard key={tool.id} tool={tool} />)}
    </div>
  </main>;
}
