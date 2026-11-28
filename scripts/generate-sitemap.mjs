import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const categoryMap = {"llm-chatbot":"ai-assistants","general-other":"other","creative-tools":"design","video-image":"image-generation","marketing-seo":"marketing","productivity-automation":"productivity","ai-writing":"writing","ai-search":"research","seo":"marketing","healthcare":"other","video-editing":"video-generation","ai-tools":"other","creative":"design","audio":"audio-music","music":"audio-music","coding":"coding","developer-tools":"developer-tools","education":"education","research":"research","business":"business","presentation":"presentation","writing":"writing","design":"design","productivity":"productivity","marketing":"marketing","image-generation":"image-generation","video-generation":"video-generation","audio-music":"audio-music","ai-assistants":"ai-assistants","other":"other"};
const mapCategory = raw => categoryMap[String(raw || "").toLowerCase()] || "other";
const curatedPromptSlugs = ["enhance","cinematic","danger","studio","product","anime","background","cinematic-video","reels","thumbnail","logo","poster","caption","hooks","blog","rewrite","translate","study","flashcards","explain","debug","review","sql","business-plan","productivity","research","email","story","ad-copy","resume"];
const dir = path.join(root, "src", "data", "catalog");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".ts")).sort();
const slugs = [];
const rawCategories = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  const json = text.replace(/^export default /, "").replace(/;\s*$/, "");
  for (const item of JSON.parse(json)) { if (item?.slug) slugs.push(item.slug); if (item?.category) rawCategories.push(item.category); }
}
const excludedToolSlugs = new Set(["atonce","experai","cheatography","perplexity-ai"]);
const uniqueSlugs = [...new Set(slugs)].filter(slug => !excludedToolSlugs.has(slug));
const categorySlugs = [...new Set(rawCategories.map(mapCategory))].sort();
if (uniqueSlugs.length !== 996) throw new Error(`Expected 996 indexable catalog slugs after excluding 3 unverified listings and 1 duplicate URL, found ${uniqueSlugs.length}`);

const origin = (process.env.VITE_SITE_URL || "https://anjal-ai-directory.vercel.app").replace(/\/$/, "");
const urls = ["/", "/finder", "/prompts", "/submit", ...categorySlugs.map(slug => `/category/${slug}`), ...uniqueSlugs.map(slug => `/tool/${slug}`), ...curatedPromptSlugs.map(slug => `/prompt/${slug}`)];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${origin}${url}</loc></url>`).join("\n")}\n</urlset>\n`;
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "sitemap.xml"), xml);
console.log(`Generated sitemap with ${urls.length} URLs, including ${curatedPromptSlugs.length} curated prompt pages`);
