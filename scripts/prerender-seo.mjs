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
    ["meta", "property", "og:image", `<meta property="og:image" content="${origin}/anjal-ai-mark.svg">`],
    ["meta", "name", "twitter:image", `<meta name="twitter:image" content="${origin}/anjal-ai-mark.svg">`],
    ["meta", "name", "twitter:card", `<meta name="twitter:card" content="summary">`],
    ["meta", "name", "twitter:title", `<meta name="twitter:title" content="${escapeHtml(title)}">`],
    ["meta", "name", "twitter:description", `<meta name="twitter:description" content="${escapeHtml(description)}">`]
  ];
  for (const [tagName, attribute, value, replacement] of headTags) {
    html = setHeadTag(html, tagName, attribute, value, replacement);
  }

  // Fail the build if a prerendered route ever ships duplicate or incorrect SEO head tags.
  const canonicalTags = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi) || [];
  const descriptionTags = html.match(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi) || [];
  const titleTags = html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || [];
  if (canonicalTags.length !== 1 || !canonicalTags[0].includes(`href="${escapeHtml(canonical)}"`)) {
    throw new Error(`Expected exactly one self canonical for ${canonical}`);
  }
  if (descriptionTags.length !== 1 || !descriptionTags[0].includes(`content="${escapeHtml(description)}"`)) {
    throw new Error(`Expected exactly one route-specific meta description for ${canonical}`);
  }
  if (titleTags.length !== 1 || !titleTags[0].includes(escapeHtml(title))) {
    throw new Error(`Expected exactly one route-specific title for ${canonical}`);
  }

  html = html.replace("</head>", `<script type="application/ld+json">${escapeJson(jsonLd)}</script></head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

const categories = [...new Set(catalog.map(x => mapCategory(x.category)))];

// Prerender the homepage so crawlers receive meaningful HTML before React loads.
const homeTitle = "Anjal AI — AI Tools & Ready-to-Use Prompts";
const homeDescription = "Discover useful AI tools and copy-ready prompts for writing, coding, design, research, education, marketing and productivity.";
const homeCategoryLinks = categories.map(category => `<li><a href="/category/${category}">${escapeHtml(categoryNames[category] || "Other")}</a></li>`).join("");
const homeToolLinks = catalog.slice(0, 24).map(tool => `<li><a href="/tool/${encodeURIComponent(tool.slug)}">${escapeHtml(tool.name)}</a></li>`).join("");
const homeBody = `<main><header><h1>Find the right AI tool and ready-to-use prompt</h1><p>Explore a curated directory of AI tools and practical prompts for everyday work, learning and creativity. Compare categories, visit official tool websites, and copy prompt templates you can customize for your own projects.</p><p><a href="/finder">Find an AI tool</a> · <a href="/prompts">Browse free AI prompts</a></p></header><section><h2>Explore AI tool categories</h2><p>Start with the task you need help with. Browse tools for AI assistants, image and video creation, audio, writing, coding, design, productivity, marketing, education and research. Each listing links to the tool website so you can check its current features and terms directly.</p><ul>${homeCategoryLinks}</ul></section><section><h2>Browse AI tools</h2><p>Use the directory to discover options, then compare them against your actual workflow. Before signing up or paying, verify current pricing, free-plan limits, supported regions, privacy terms and export options on the provider’s own website. Features and plans can change.</p><ul>${homeToolLinks}</ul></section><section><h2>Make better use of AI with practical prompts</h2><p>A useful prompt explains your goal, audience, context, constraints and the format you want back. The Anjal AI prompt library provides editable starting points for common tasks. Replace bracketed placeholders with your own details, test the result, and refine it rather than treating one response as final.</p><p><a href="/prompts">Explore copy-ready AI prompts</a> · <a href="/category/education">Explore education AI tools</a></p></section></main>`;
const homeJsonLd = {"@context":"https://schema.org","@graph":[{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`,description:homeDescription,potentialAction:{"@type":"SearchAction",target:{"@type":"EntryPoint",urlTemplate:`${origin}/?q={search_term_string}`},"query-input":"required name=search_term_string"}},{"@type":"Organization",name:"Anjal AI",url:`${origin}/`,logo:{"@type":"ImageObject",url:`${origin}/anjal-ai-mark.svg`,width:512,height:512}}]};
fs.writeFileSync(path.join(dist, "index.html"), render({title:homeTitle,description:homeDescription,canonical:`${origin}/`,body:homeBody,jsonLd:homeJsonLd}));

// Prerender the AI Tool Finder and legal pages so direct crawls receive route-specific HTML.
const finderTitle = "AI Tool Finder — Find the Best AI Tool | Anjal AI";
const finderDescription = "Find AI tools for writing, coding, design, research, education, marketing, video and productivity using practical recommendations.";
const finderCategoryLinks = categories.map(category => `<li><a href="/category/${category}">${escapeHtml(categoryNames[category] || "Other")} AI tools</a></li>`).join("");
const finderBody = `<main><nav><a href="/">Anjal AI</a> → <strong>AI Tool Finder</strong></nav><h1>Find the right AI tool for your task</h1><p>Use the Anjal AI Finder to explore a directory of 1,000 AI tools across writing, coding, design, research, education, marketing, productivity, image and video creation, and more. Search by the job you need to complete rather than by product name alone.</p><section><h2>How to choose an AI tool</h2><ol><li>Describe your task and the result you need.</li><li>Compare tools in the relevant category and check their official websites.</li><li>Verify current pricing, free-plan limits, supported regions, privacy terms and export options before signing up.</li><li>Test a tool with a real example and review the output before relying on it.</li></ol></section><section><h2>Explore AI tool categories</h2><ul>${finderCategoryLinks}</ul></section><section><h2>Explore practical AI prompts</h2><p>Prompts help you give an AI assistant the goal, context, constraints and output format it needs. Browse the <a href="/prompts">free AI prompt library</a> for editable starting points.</p></section><p><a href="/">Browse all AI tools</a> · <a href="/prompts">Open the AI Prompt Library</a></p></main>`;
const finderJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:finderTitle,description:finderDescription,url:`${origin}/finder`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const finderOut = path.join(dist, "finder", "index.html");
fs.mkdirSync(path.dirname(finderOut), { recursive: true });
fs.writeFileSync(finderOut, render({title:finderTitle,description:finderDescription,canonical:`${origin}/finder`,body:finderBody,jsonLd:finderJsonLd}));

const privacyTitle = "Privacy Policy — Anjal AI";
const privacyDescription = "Read how Anjal AI handles basic site analytics, tool submissions, listing claims and links to third-party services.";
const privacyBody = `<main><article><h1>Privacy Policy</h1><p>Last updated: September 10, 2026</p><section><h2>What we collect</h2><p>Anjal AI may record basic page views, tool views and outbound tool clicks when analytics is configured. Tool submissions and listing claims may include the contact information you choose to provide.</p></section><section><h2>How we use information</h2><p>We use submitted information to review directory listings and claims, and aggregate analytics to understand which parts of the directory are useful.</p></section><section><h2>Third-party services</h2><p>Tool links take you to third-party websites. Their privacy practices are governed by their own policies. Advertising may be provided by advertising partners after publisher configuration and approval.</p></section><section><h2>Contact</h2><p>For privacy or listing questions, use the contact method provided by the Anjal AI Directory operator.</p></section></article></main>`;
const privacyJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:privacyTitle,description:privacyDescription,url:`${origin}/privacy`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const privacyOut = path.join(dist, "privacy", "index.html");
fs.mkdirSync(path.dirname(privacyOut), { recursive: true });
fs.writeFileSync(privacyOut, render({title:privacyTitle,description:privacyDescription,canonical:`${origin}/privacy`,body:privacyBody,jsonLd:privacyJsonLd}));

const termsTitle = "Terms of Use — Anjal AI";
const termsDescription = "Review the terms for using Anjal AI Directory, including listings, third-party websites, submissions and availability.";
const termsBody = `<main><article><h1>Terms of Use</h1><p>Last updated: September 10, 2026</p><section><h2>Directory listings</h2><p>Anjal AI is an independent discovery directory. Listings are provided for discovery and may change over time. Commercial details are marked as not verified when reliable pricing data is unavailable.</p></section><section><h2>Third-party websites</h2><p>Anjal AI does not operate the third-party tools listed in the directory. Use each provider's official website and terms for purchases, accounts, subscriptions and product capabilities.</p></section><section><h2>Submissions and claims</h2><p>Submitting a tool or claiming a listing does not guarantee publication, verification or approval. We may reject, edit or remove listings to maintain directory quality.</p></section><section><h2>Availability</h2><p>The directory is provided on an as-available basis. We do not guarantee that every listed tool, link, price or feature will remain available or accurate at all times.</p></section></article></main>`;
const termsJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:termsTitle,description:termsDescription,url:`${origin}/terms`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const termsOut = path.join(dist, "terms", "index.html");
fs.mkdirSync(path.dirname(termsOut), { recursive: true });
fs.writeFileSync(termsOut, render({title:termsTitle,description:termsDescription,canonical:`${origin}/terms`,body:termsBody,jsonLd:termsJsonLd}));

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

// Give the prompt-library hub its own crawlable content and internal links.
const promptHubTitle = "Free AI Prompt Library | Copy-Ready Prompts | Anjal AI";
const promptHubDescription = "Browse free copy-ready AI prompts for writing, coding, images, productivity, education and more. Customize templates for your favorite AI tools.";
const promptCategories = [...new Set(curatedPrompts.map(prompt => prompt.category))].sort();
const promptCategoryList = promptCategories.map(category => `<li>${escapeHtml(category)}</li>`).join("");
const promptHubLinks = curatedPrompts.map(prompt => {
  const slug = prompt.command.replace(/^\//, "").toLowerCase();
  return `<li><a href="/prompt/${encodeURIComponent(slug)}">${escapeHtml(prompt.title)} Prompt</a> — ${escapeHtml(prompt.description)}</li>`;
}).join("");
const promptHubBody = `<main><nav><a href="/">Anjal AI</a> → <strong>AI Prompt Library</strong></nav><h1>Free AI Prompt Library</h1><p>Find practical, copy-ready prompts for image editing, video creation, writing, coding, education, business and productivity. Choose a prompt, replace its placeholders with your details, and adapt the result to your preferred AI assistant.</p><section><h2>Browse prompt categories</h2><ul>${promptCategoryList}</ul></section><section><h2>Copy-ready AI prompts</h2><ul>${promptHubLinks}</ul></section><p>New to AI prompts? Start with a clear goal, provide useful context, and review generated results before using them.</p></main>`;
const promptHubJsonLd = {"@context":"https://schema.org","@type":"CollectionPage",name:promptHubTitle,description:promptHubDescription,url:`${origin}/prompts`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const promptHubOut = path.join(dist, "prompts", "index.html");
fs.mkdirSync(path.dirname(promptHubOut), { recursive: true });
fs.writeFileSync(promptHubOut, render({title:promptHubTitle,description:promptHubDescription,canonical:`${origin}/prompts`,body:promptHubBody,jsonLd:promptHubJsonLd}));

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
