import type { Tool } from "@/types/tool";

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const aliases: Record<string, string[]> = {
  study: ["education", "student", "research", "writing", "productivity"],
  student: ["education", "study", "research", "writing", "productivity"],
  school: ["education", "study", "student"],
  college: ["education", "study", "research"],
  exam: ["education", "study", "research"],
  video: ["video", "video generation", "video editing"],
  reel: ["video", "social media", "video editing"],
  image: ["image", "design", "image generation"],
  photo: ["image", "design", "image editing"],
  coding: ["coding", "developer", "programming"],
  code: ["coding", "developer", "programming"],
  programming: ["coding", "developer"],
  writing: ["writing", "copywriting", "content"],
  essay: ["writing", "education"],
  marketing: ["marketing", "seo", "social media"],
  seo: ["marketing", "seo"],
  business: ["business", "productivity", "marketing"],
  research: ["research", "education"],
  music: ["audio", "music"],
  voice: ["audio", "voice", "text to speech"],
  presentation: ["presentation", "design", "productivity"],
  powerpoint: ["presentation", "productivity"],
  pdf: ["document", "research", "productivity"],
  resume: ["career", "writing", "productivity"],
  cv: ["career", "writing", "productivity"],
};

const tokenize = (value: string) =>
  normalize(value).split(/\s+/).filter(Boolean);

export function rankTools(query: string, catalog: Tool[]): Tool[] {
  const q = normalize(query);
  if (!q) return catalog;

  const words = tokenize(q);
  const expanded = new Set(words);
  words.forEach(word => (aliases[word] || []).forEach(alias => tokenize(alias).forEach(x => expanded.add(x))));

  return catalog
    .map(tool => {
      const name = normalize(tool.name);
      const categories = tool.categories.map(normalize);
      const tags = tool.tags.map(normalize);
      const features = tool.features.map(normalize);
      const description = normalize(tool.description);
      const haystack = [name, ...categories, ...tags, ...features, description].join(" ");
      let score = 0;

      if (name === q) score += 300;
      else if (name.startsWith(q)) score += 180;
      else if (name.includes(q)) score += 120;

      const matchedWords = new Set<string>();
      for (const word of words) {
        if (name.split(" ").includes(word)) { score += 55; matchedWords.add(word); }
        else if (name.includes(word)) { score += 30; matchedWords.add(word); }
        if (categories.some(c => c.includes(word))) { score += 28; matchedWords.add(word); }
        if (tags.some(t => t.includes(word))) { score += 22; matchedWords.add(word); }
        if (features.some(f => f.includes(word))) { score += 14; matchedWords.add(word); }
        if (description.includes(word)) { score += 8; matchedWords.add(word); }
      }

      for (const word of expanded) {
        if (!words.includes(word) && haystack.includes(word)) score += 3;
      }

      if (words.length > 1 && matchedWords.size === words.length) score += 45;
      if (tool.verificationStatus !== "link-only") score += 2;
      if (tool.rating != null) score += Math.min(5, tool.rating);

      return { tool, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map(item => item.tool);
}
