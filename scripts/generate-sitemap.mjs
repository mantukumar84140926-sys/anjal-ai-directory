import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogDir = path.join(root, "src", "data", "catalog");
const files = fs.readdirSync(catalogDir).filter(f => f.endsWith(".ts")).sort();
const slugs = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(catalogDir, file), "utf8");
  for (const match of text.matchAll(/(?:["']slug["']|\bslug)\s*:\s*["']([^"']+)["']/g)) slugs.push(match[1]);
}
const uniqueSlugs = [...new Set(slugs)];
if (uniqueSlugs.length !== 500) throw new Error(`Expected 500 unique catalog slugs, found ${uniqueSlugs.length}`);
const origin = (process.env.VITE_SITE_URL || "https://anjal-ai-directory.vercel.app").replace(/\/$/, "");
const urls = ["/", "/finder", "/submit", ...uniqueSlugs.map(slug => `/tool/${slug}`)];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${origin}${url}</loc></url>`).join("\n")}\n</urlset>\n`;
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "sitemap.xml"), xml);
console.log(`Generated sitemap with ${urls.length} URLs`);
