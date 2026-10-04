import type { Tool } from "@/types/tool";

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const aliases: Record<string, string[]> = {
  study: ["education", "student", "research", "writing", "productivity"],
  student: ["education", "study", "research", "writing", "productivity"],
  school: ["education", "study", "student"],
  college: ["education", "study", "research"],
  exam: ["education", "study", "research"],
  homework: ["education", "study", "writing"],
  teacher: ["education", "presentation", "writing"],
  video: ["video", "video generation", "video editing"],
  reel: ["video", "social media", "video editing"],
  shorts: ["video", "social media", "video editing"],
  image: ["image", "design", "image generation"],
  photo: ["image", "design", "image editing"],
  thumbnail: ["image", "design", "video"],
  coding: ["coding", "developer", "programming"],
  code: ["coding", "developer", "programming"],
  programming: ["coding", "developer"],
  writing: ["writing", "copywriting", "content"],
  essay: ["writing", "education"],
  resume: ["career", "writing", "productivity"],
  cv: ["career", "writing", "productivity"],
  marketing: ["marketing", "seo", "social media"],
  seo: ["marketing", "seo"],
  business: ["business", "productivity", "marketing"],
  research: ["research", "education"],
  music: ["audio", "music"],
  voice: ["audio", "voice", "text to speech"],
  presentation: ["presentation", "design", "productivity"],
  powerpoint: ["presentation", "productivity"],
  pdf: ["document", "research", "productivity"],
  automation: ["automation", "productivity"],
};

const tokenize = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

function distance(a: string, b: string) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = next[j];
  }
  return prev[b.length];
}

export function rankTools(query: string, catalog: Tool[]): Tool[] {
  const q = normalize(query);
  if (!q) return catalog;

  const words = tokenize(q);
  const expanded = new Set(words);
  words.forEach(word => (aliases[word] || []).forEach(alias => tokenize(alias).forEach(x => expanded.add(x))));

  return catalog
    .map(tool => {
      const name = normalize(tool.name);
      const nameWords = tokenize(tool.name);
      const categories = tool.categories.map(normalize);
      const tags = tool.tags.map(normalize);
      const features = tool.features.map(normalize);
      const description = normalize(tool.description);
      const haystack = [name, ...categories, ...tags, ...features, description].join(" ");
      let score = 0;
      let matchedWords = 0;

      if (name === q) score += 400;
      else if (name.startsWith(q)) score += 220;
      else if (name.includes(q)) score += 150;
      else if (q.length >= 4 && nameWords.some(word => distance(word, q) <= 2)) score += 90;

      for (const word of words) {
        let matched = false;
        if (nameWords.some(n => n === word)) { score += 65; matched = true; }
        else if (nameWords.some(n => n.startsWith(word))) { score += 42; matched = true; }
        else if (name.includes(word)) { score += 28; matched = true; }
        if (categories.some(c => c.includes(word))) { score += 30; matched = true; }
        if (tags.some(t => t.includes(word))) { score += 24; matched = true; }
        if (features.some(f => f.includes(word))) { score += 16; matched = true; }
        if (description.includes(word)) { score += 9; matched = true; }
        if (!matched && word.length >= 4 && nameWords.some(n => distance(n, word) <= 2)) {
          score += 12;
          matched = true;
        }
        if (matched) matchedWords++;
      }

      for (const word of expanded) {
        if (!words.includes(word) && haystack.includes(word)) score += 3;
      }

      if (words.length > 1 && matchedWords === words.length) score += 55;
      if (tool.verificationStatus !== "link-only") score += 2;
      if (tool.rating != null) score += Math.min(5, tool.rating);

      return { tool, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map(item => item.tool);
}
