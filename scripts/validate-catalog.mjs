import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "src", "data", "catalog");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".ts")).sort();
const entries = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  const re = /\{\s*["']?id["']?\s*:\s*["']([^"']+)["']\s*,\s*["']?name["']?\s*:\s*["']([^"']+)["']\s*,\s*["']?slug["']?\s*:\s*["']([^"']+)["']\s*,\s*["']?website["']?\s*:\s*["']([^"']+)["']\s*,\s*["']?category["']?\s*:\s*["']([^"']+)["']\s*\}/g;
  for (const m of text.matchAll(re)) entries.push({ id:m[1], name:m[2], slug:m[3], website:m[4], category:m[5] });
}
const errors = [];
const ids = new Set(); const slugs = new Set(); const names = new Set();
for (const e of entries) {
  if (ids.has(e.id)) errors.push(`duplicate id: ${e.id}`); ids.add(e.id);
  if (slugs.has(e.slug)) errors.push(`duplicate slug: ${e.slug}`); slugs.add(e.slug);
  if (names.has(e.name.toLowerCase())) errors.push(`duplicate name: ${e.name}`); names.add(e.name.toLowerCase());
  if (!/^https:\/\//.test(e.website)) errors.push(`non-HTTPS website: ${e.name}`);
  if (!e.category.trim()) errors.push(`missing category: ${e.name}`);
}
console.log(`Catalog entries: ${entries.length}`);
console.log(`Unique IDs: ${ids.size}`);
console.log(`Unique slugs: ${slugs.size}`);
console.log(`Unique names: ${names.size}`);
if (entries.length !== 500 || ids.size !== 500 || slugs.size !== 500) errors.push("catalog must contain exactly 500 unique entries, IDs and slugs");
if (errors.length) {
  console.error(`Catalog validation failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Catalog validation passed.");
