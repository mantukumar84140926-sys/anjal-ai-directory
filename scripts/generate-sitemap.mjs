import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const categorySlugs = [
  "ai-assistants","image-generation","video-generation","audio-music","writing",
  "coding","design","productivity","marketing","education","research","business",
  "presentation","developer-tools","other"
];
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

const dir = path.join(root, "src", "data", "catalog");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".ts")).sort();
const entries = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  const json = text.replace(/^export default /, "").replace(/;\s*$/, "");
  try {
    entries.push(...JSON.parse(json));
  } catch {
    throw new Error(`Could not parse catalog file: ${file}`);
  }
}

const unique = new Map();
for (const item of entries) {
  if (item?.slug && !unique.has(item.slug)) unique.set(item.slug, item);
}
const catalog = [...unique.values()];
if (catalog.length !== 1000) throw new Error(`Expected 1000 unique catalog slugs, found ${catalog.length}`);

const origin = (process.env.VITE_SITE_URL || "https://anjal-ai-directory.vercel.app").replace(/\/$/, "");
const publicDir = path.join(root, "public");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const mapCategory = raw => categoryMap[String(raw || "").toLowerCase()] || "other";

function pageHtml({ title, description, canonical, body, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:site_name" content="Anjal AI">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<main>${body}</main>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
}

const urls = ["/", "/finder", "/submit"];
for (const categorySlug of categorySlugs) {
  const categoryName = categoryNames[categorySlug];
  const matches = catalog.filter(t => mapCategory(t.category) === categorySlug);
  const canonical = `${origin}/category/${categorySlug}`;
  const title = `${categoryName} AI Tools | Anjal AI`;
  const description = `Explore ${matches.length} ${categoryName} AI tools in the Anjal AI directory. Browse tools, open official websites and discover related AI software.`;
  const jsonLd = {
    "@context":"https://schema.org","@type":"CollectionPage",name:title,description,url:canonical,
    isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin}
  };
  const links = matches.slice(0, 40).map(t => `<li><a href="/tool/${encodeURIComponent(t.slug)}">${escapeHtml(t.name)}</a></li>`).join("");
  const body = `<nav><a href="/">Anjal AI</a> → <strong>${escapeHtml(categoryName)}</strong></nav>
<h1>${escapeHtml(categoryName)} AI Tools</h1>
<p>${escapeHtml(description)}</p>
<p><strong>${matches.length}</strong> tools in this category. <a href="/finder">Use the AI Tool Finder</a> or <a href="/">browse all AI tools</a>.</p>
<ul>${links}</ul>`;
  const out = path.join(publicDir, "category", categorySlug, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pageHtml({title,description,canonical,body,jsonLd}));
  urls.push(`/category/${categorySlug}`);
}

for (const tool of catalog) {
  const category = mapCategory(tool.category);
  const categoryName = categoryNames[category];
  const canonical = `${origin}/tool/${tool.slug}`;
  const titleRaw = `${tool.name} — ${categoryName} AI Tool | Anjal AI`;
  const title = titleRaw.length <= 60 ? titleRaw : `${tool.name} — AI Tool | Anjal AI`;
  const description = `${tool.name} is an AI tool listed in Anjal AI under ${categoryName}. Explore its official website, category, platform and directory information.`;
  const jsonLd = {
    "@context":"https://schema.org","@type":"SoftwareApplication",name:tool.name,description,url:tool.website,
    applicationCategory:categoryName,operatingSystem:"Web",isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin},
    mainEntityOfPage:{"@type":"WebPage","@id":canonical},
    sameAs:[tool.website]
  };
  const body = `<nav><a href="/">AI Tools</a> → <a href="/category/${category}">${escapeHtml(categoryName)}</a> → <strong>${escapeHtml(tool.name)}</strong></nav>
<h1>${escapeHtml(tool.name)}</h1>
<p>${escapeHtml(description)}</p>
<h2>About this listing</h2>
<ul>
<li>Category: <a href="/category/${category}">${escapeHtml(categoryName)}</a></li>
<li>Platform: Web</li>
<li>Official website: <a href="${escapeHtml(tool.website)}" rel="nofollow">Visit ${escapeHtml(tool.name)}</a></li>
<li>Directory status: Independent listing; commercial details are not verified unless explicitly marked.</li>
</ul>
<p>Explore more AI tools in the <a href="/finder">${escapeHtml(categoryName)} category</a> or return to the <a href="/">Anjal AI directory</a>.</p>`;
  const out = path.join(publicDir, "tool", tool.slug, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pageHtml({title,description,canonical,body,jsonLd}));
  urls.push(`/tool/${tool.slug}`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${origin}${url}</loc></url>`).join("\n")}
</urlset>
`;
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml);
console.log(`Generated sitemap with ${urls.length} URLs and pre-rendered ${catalog.length} tool pages.`);
