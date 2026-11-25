import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = process.cwd();
const dist = path.join(root, "dist");
const catalogDir = path.join(root, "src", "data", "catalog");
const categoryNames = {
  "ai-assistants":"AI Assistants","image-generation":"Image Generation","video-generation":"Video Generation",
  "audio-music":"Audio & Music","writing":"Writing","coding":"Coding","design":"Design",
  "productivity":"Productivity","marketing":"Marketing","education":"Education","research":"Research",
  "business":"Business","presentation":"Presentation","developer-tools":"Developer Tools","other":"Other"
};
const categoryMap = {
  "llm-chatbot":"ai-assistants","general-other":"other","creative-tools":"design","video-image":"image-generation",
  "marketing-seo":"marketing","productivity-automation":"productivity","ai-writing":"writing","ai-search":"research",
  "seo":"marketing","healthcare":"other","video-editing":"video-generation","ai-tools":"other","creative":"design",
  "audio":"audio-music","music":"audio-music","coding":"coding","developer-tools":"developer-tools",
  "education":"education","research":"research","business":"business","presentation":"presentation",
  "writing":"writing","design":"design","productivity":"productivity","marketing":"marketing",
  "image-generation":"image-generation","video-generation":"video-generation","audio-music":"audio-music",
  "ai-assistants":"ai-assistants","other":"other"
};
const mapCategory = raw => categoryMap[String(raw || "").toLowerCase()] || "other";
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const escapeJson = value => JSON.stringify(value).replace(/</g, "\u003c");
const origin = (process.env.VITE_SITE_URL || "https://anjal-ai-directory.vercel.app").replace(/\/$/, "");

if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("dist/index.html not found; prerender must run after vite build.");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");

const entries = [];
for (const file of fs.readdirSync(catalogDir).filter(f => f.endsWith(".ts")).sort()) {
  const text = fs.readFileSync(path.join(catalogDir, file), "utf8");
  entries.push(...JSON.parse(text.replace(/^export default /, "").replace(/;\s*$/, "")));
}
const catalog = [...new Map(entries.filter(x => x?.slug).map(x => [x.slug, x])).values()];
if (catalog.length !== 1000) throw new Error(`Expected 1000 catalog entries, found ${catalog.length}`);

function setHeadTag(html, tagName, attribute, value, replacement) {
  const marker = `${attribute}="${value}"`;
  let firstStart = -1;
  let firstEnd = -1;
  let cursor = 0;
  while (true) {
    const start = html.indexOf(`<${tagName}`, cursor);
    if (start < 0) break;
    const end = html.indexOf(">", start);
    if (end < 0) break;
    const currentTag = html.slice(start, end + 1);
    if (currentTag.includes(marker) || currentTag.includes(`${attribute}='${value}'`)) {
      if (firstStart < 0) { firstStart = start; firstEnd = end + 1; cursor = end + 1; }
      else { html = html.slice(0, start) + html.slice(end + 1); cursor = start; }
    } else cursor = end + 1;
  }
  if (firstStart >= 0) return html.slice(0, firstStart) + replacement + html.slice(firstEnd);
  return html.replace("</head>", `${replacement}</head>`);
}

function render({ title, description, canonical, body, jsonLd }) {
  let html = template;
  const titleStart = html.indexOf("<title>");
  const titleEnd = html.indexOf("</title>", titleStart);
  if (titleStart >= 0 && titleEnd >= 0) {
    html = html.slice(0, titleStart) + `<title>${escapeHtml(title)}</title>` + html.slice(titleEnd + "</title>".length);
  }
  // Replace the template homepage tags; never leave its canonical on route pages.
  const headTags = [
    ["meta", "name", "description", `<meta name="description" content="${escapeHtml(description)}">`],
    ["meta", "name", "robots", `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`],
    ["link", "rel", "canonical", `<link rel="canonical" href="${escapeHtml(canonical)}">`],
    ["meta", "property", "og:title", `<meta property="og:title" content="${escapeHtml(title)}">`],
    ["meta", "property", "og:description", `<meta property="og:description" content="${escapeHtml(description)}">`],
    ["meta", "property", "og:type", `<meta property="og:type" content="website">`],
    ["meta", "property", "og:site_name", `<meta property="og:site_name" content="Anjal AI">`],
    ["meta", "property", "og:url", `<meta property="og:url" content="${escapeHtml(canonical)}">`],
    ["meta", "property", "og:locale", `<meta property="og:locale" content="en_GB">`],
    ["meta", "name", "twitter:card", `<meta name="twitter:card" content="summary">`],
    ["meta", "name", "twitter:title", `<meta name="twitter:title" content="${escapeHtml(title)}">`],
    ["meta", "name", "twitter:description", `<meta name="twitter:description" content="${escapeHtml(description)}">`]
  ];
  for (const [tagName, attribute, value, replacement] of headTags) {
    html = setHeadTag(html, tagName, attribute, value, replacement);
  }
  html = html.replace("</head>", `<script type="application/ld+json">${escapeJson(jsonLd)}</script></head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

const categories = [...new Set(catalog.map(x => mapCategory(x.category)))];

for (const category of categories) {
  const name = categoryNames[category] || "Other";
  const matches = catalog.filter(x => mapCategory(x.category) === category);
  const canonical = `${origin}/category/${category}`;
  const title = `${name} AI Tools | Anjal AI`;
  const description = `Explore ${matches.length} ${name} AI tools in the Anjal AI directory. Browse related tools and official websites.`;
  const items = matches.map((x, i) => `<li><a href="/tool/${encodeURIComponent(x.slug)}">${escapeHtml(x.name)}</a></li>`).join("");
  const body = `<main><nav><a href="/">Anjal AI</a> → <strong>${escapeHtml(name)}</strong></nav><h1>${escapeHtml(name)} AI Tools</h1><p>${escapeHtml(description)}</p><p><strong>${matches.length}</strong> tools listed in this category.</p><ul>${items}</ul><p><a href="/finder">Find an AI tool</a> · <a href="/">Browse all tools</a></p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"CollectionPage",name:title,description,url:canonical,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin}};
  const out = path.join(dist, "category", category, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({title,description,canonical,body,jsonLd}));
}

for (const tool of catalog) {
  const category = mapCategory(tool.category);
  const categoryName = categoryNames[category] || "Other";
  const canonical = `${origin}/tool/${tool.slug}`;
  const rawTitle = `${tool.name} — ${categoryName} AI Tool | Anjal AI`;
  const title = rawTitle.length <= 60 ? rawTitle : `${tool.name} — AI Tool | Anjal AI`;
  const description = `${tool.name} is an AI tool listed in Anjal AI under ${categoryName}. Explore its official website, category and directory information.`;
  const related = catalog.filter(x => x.slug !== tool.slug && mapCategory(x.category) === category).slice(0, 8);
  const relatedLinks = related.map(x => `<li><a href="/tool/${encodeURIComponent(x.slug)}">${escapeHtml(x.name)}</a></li>`).join("");
  const body = `<main><nav><a href="/">AI Tools</a> → <a href="/category/${category}">${escapeHtml(categoryName)}</a> → <strong>${escapeHtml(tool.name)}</strong></nav><h1>${escapeHtml(tool.name)}</h1><p>${escapeHtml(description)}</p><h2>Directory profile</h2><ul><li>Category: <a href="/category/${category}">${escapeHtml(categoryName)}</a></li><li>Platform: Web</li><li>Official website: <a href="${escapeHtml(tool.website)}" rel="nofollow">${escapeHtml(tool.name)}</a></li><li>Commercial details: not verified unless explicitly marked.</li></ul><h2>Related AI tools</h2><ul>${relatedLinks}</ul><p><a href="/finder">Use AI Tool Finder</a> · <a href="/">Browse all 1000 AI tools</a></p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"SoftwareApplication",name:tool.name,description,url:tool.website,applicationCategory:categoryName,operatingSystem:"Web",isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin},mainEntityOfPage:{"@type":"WebPage","@id":canonical},sameAs:[tool.website]};
  const out = path.join(dist, "tool", tool.slug, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({title,description,canonical,body,jsonLd}));
}


const promptManifestPath = path.join(dist, ".prompt-data.mjs");
await build({
  entryPoints: [path.join(root, "scripts", "prompt-data-entry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  alias: { "@": path.join(root, "src") },
  define: { "import.meta.env": JSON.stringify({ VITE_SITE_URL: origin }) },
  outfile: promptManifestPath
});
const { prompts } = await import(pathToFileURL(promptManifestPath).href);
const curatedPrompts = prompts.filter(prompt => !prompt.command.startsWith("/prompt-"));
for (const prompt of curatedPrompts) {
  const slug = prompt.command.replace(/^\//, "").toLowerCase();
  const canonical = `${origin}/prompt/${slug}`;
  const title = `${prompt.title} Prompt — ${prompt.category} AI | Anjal AI`.slice(0, 60);
  const description = `${prompt.description} Copy this free ${prompt.category.toLowerCase()} AI prompt, customize the placeholders, and use it with your preferred AI tool.`.slice(0, 158);
  const related = curatedPrompts.filter(item => item.command !== prompt.command && item.category === prompt.category).slice(0, 5);
  const relatedLinks = related.map(item => `<li><a href="/prompt/${encodeURIComponent(item.command.replace(/^\//, ""))}">${escapeHtml(item.title)}</a></li>`).join("");
  const tags = prompt.tags.map(tag => `<li>${escapeHtml(tag)}</li>`).join("");
  const body = `<main><nav><a href="/">Anjal AI</a> → <a href="/prompts">AI Prompt Library</a> → <strong>${escapeHtml(prompt.title)}</strong></nav><h1>${escapeHtml(prompt.title)} Prompt</h1><p>${escapeHtml(description)}</p><p><strong>Category:</strong> ${escapeHtml(prompt.category)}</p><h2>What this AI prompt does</h2><p>${escapeHtml(prompt.description)} Use it as a starting point, replace bracketed placeholders with your own details, and review the AI response before publishing or relying on it.</p><h2>Copy-ready prompt</h2><pre>${escapeHtml(prompt.prompt)}</pre><h2>Related topics</h2><ul>${tags}</ul><h2>Related AI prompts</h2><ul>${relatedLinks}</ul><p><a href="/prompts">Browse the complete AI prompt library</a></p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"CreativeWork",name:prompt.title,description,url:canonical,genre:prompt.category,keywords:prompt.tags.join(", "),isPartOf:{"@type":"CollectionPage",name:"AI Prompt Library",url:`${origin}/prompts`}};
  const out = path.join(dist, "prompt", slug, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({title,description,canonical,body,jsonLd}));
}
fs.rmSync(promptManifestPath, { force: true });

console.log(`Prerendered ${catalog.length} tool pages, ${categories.length} category pages and ${curatedPrompts.length} curated prompt pages.`);
