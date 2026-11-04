import fs from "node:fs";
import path from "node:path";

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
const escapeJson = value => JSON.stringify(value).replace(/</g, "\\u003c");
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

function render({ title, description, canonical, body, jsonLd }) {
  let html = template;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  const head = `
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Anjal AI">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<script type="application/ld+json">${escapeJson(jsonLd)}</script>`;
  html = html.replace("</head>", `${head}</head>`);
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


// Give the Prompt Library a crawlable HTML entry point instead of relying only
// on client-side React rendering. Keep this page aligned with the live route.
{
  const canonical = `${origin}/prompts`;
  const title = "Free AI Prompts for Images, Video, Reels & More | Anjal AI";
  const description = "Explore practical AI prompts for image editing, video creation, social media, design, writing, education and coding. Copy a prompt and adapt it to your task.";
  const promptCategories = [
    ["Image", "Photo enhancement, cinematic edits, portraits and product photography"],
    ["Video", "Video scenes, camera movement, storyboards and short-form video"],
    ["Social Media", "Reel scripts, hooks, captions and content planning"],
    ["Design", "Thumbnails, logos, posters and visual concepts"],
    ["Writing", "SEO outlines, rewriting and translation"],
    ["Education", "Study notes, explanations and revision flashcards"],
    ["Coding", "Debugging and practical developer workflows"]
  ];
  const categoryItems = promptCategories.map(([name, summary]) =>
    `<li><strong>${escapeHtml(name)}:</strong> ${escapeHtml(summary)}</li>`
  ).join("");
  const body = `<main><nav><a href="/">Anjal AI</a> → <strong>Prompt Library</strong></nav>
    <h1>Free AI Prompt Library</h1>
    <p>Find practical prompts for common creative, learning and work tasks. Each prompt is a starting point: replace the bracketed details with your own topic, audience or requirements, then review the result before using it.</p>
    <h2>Explore prompt categories</h2><ul>${categoryItems}</ul>
    <h2>How to use the prompts</h2><ol><li>Choose a prompt that matches your task.</li><li>Replace placeholders such as [TOPIC], [AUDIENCE] or [DURATION].</li><li>Paste it into your preferred AI tool.</li><li>Check the output and refine the prompt with specific feedback.</li></ol>
    <p><a href="/prompts">Open the interactive Prompt Library</a> · <a href="/finder">Find an AI tool</a> · <a href="/">Browse all AI tools</a></p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"CollectionPage",name:title,description,url:canonical,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin}};
  const out = path.join(dist, "prompts", "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({ title, description, canonical, body, jsonLd }));
}

console.log(`Prerendered ${catalog.length} tool pages and ${categories.length} category pages.`);
