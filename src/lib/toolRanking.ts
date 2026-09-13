import type { Tool } from "@/types/tool";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const aliases: Record<string, string[]> = {
  study: ["education", "writing", "research", "productivity"],
  student: ["education", "research", "writing", "productivity"],
  video: ["video", "video generation", "video editing"],
  image: ["image", "design", "image generation"],
  coding: ["coding", "developer", "programming"],
  code: ["coding", "developer", "programming"],
  writing: ["writing", "copywriting", "content"],
  marketing: ["marketing", "seo", "social media"],
  business: ["business", "productivity", "marketing"],
  research: ["research", "education"],
  music: ["audio", "music"],
  voice: ["audio", "voice", "text to speech"],
};

export function rankTools(query: string, catalog: Tool[]): Tool[] {
  const q = normalize(query);
  if (!q) return catalog;
  const words = q.split(/\s+/).filter(Boolean);
  return catalog
    .map((tool) => {
      const haystack = normalize([tool.name, tool.description, ...tool.categories, ...tool.tags, ...tool.features].join(" "));
      let score = 0;
      if (normalize(tool.name) === q) score += 100;
      if (normalize(tool.name).includes(q)) score += 50;
      for (const word of words) {
        if (haystack.includes(word)) score += 8;
        for (const alias of aliases[word] || []) if (haystack.includes(normalize(alias))) score += 5;
      }
      if (tool.verificationStatus !== "link-only") score += 2;
      return { tool, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map((item) => item.tool);
}
