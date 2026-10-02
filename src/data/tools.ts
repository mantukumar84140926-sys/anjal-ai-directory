import part1 from "./catalog/part1";
import part2 from "./catalog/part2";
import part3 from "./catalog/part3";
import part4 from "./catalog/part4";
import part5 from "./catalog/part5";
import part6 from "./catalog/part6";
import part7 from "./catalog/part7";
import part8 from "./catalog/part8";
import part9 from "./catalog/part9";
import part10 from "./catalog/part10";
import type { Tool } from "@/types/tool";

const raw = [...part1, ...part2, ...part3, ...part4, ...part5, ...part6, ...part7, ...part8, ...part9, ...part10];

const categoryMap: Record<string, string> = {
  "llm-chatbot": "ai-assistants",
  "general-other": "other",
  "creative-tools": "design",
  "video-image": "image-generation",
  "marketing-seo": "marketing",
  "productivity-automation": "productivity",
  "ai-writing": "writing",
  "ai-search": "research",
  "seo": "marketing",
  "healthcare": "other",
  "video-editing": "video-generation",
  "ai-tools": "other",
  "creative": "design",
  "audio": "audio-music",
  "music": "audio-music",
  "coding": "coding",
  "developer-tools": "developer-tools",
  "education": "education",
  "research": "research",
  "business": "business",
  "presentation": "presentation",
  "writing": "writing",
  "design": "design",
  "productivity": "productivity",
  "marketing": "marketing",
  "image-generation": "image-generation",
  "video-generation": "video-generation",
  "audio-music": "audio-music",
  "ai-assistants": "ai-assistants",
  "other": "other"
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const normalizeUrl = (value: string) => {
  try {
    const u = new URL(value);
    return (u.hostname + u.pathname).toLowerCase().replace(/\/+$/, "");
  } catch {
    return value.toLowerCase().trim();
  }
};

const seenNames = new Set<string>();
const seenUrls = new Set<string>();

export const tools: Tool[] = raw
  .filter((x: any) => {
    const name = normalize(String(x.name || ""));
    const url = normalizeUrl(String(x.website || ""));
    if (!name || !url || seenNames.has(name) || seenUrls.has(url)) return false;
    seenNames.add(name);
    seenUrls.add(url);
    return true;
  })
  .map((x: any) => {
    const rawCategory = String(x.category || "").toLowerCase();
    const category = categoryMap[rawCategory] || "other";
    return {
      id: x.id,
      name: x.name,
      slug: x.slug,
      logo: x.name.slice(0, 2).toUpperCase(),
      website: x.website,
      description: x.description || `Discover ${x.name}, an AI tool listed in the ${category.replace(/-/g, " ")} category on Anjal AI. Explore its official website and directory profile.`,
      categories: [category],
      pricingType: "Unknown",
      platforms: ["Web"],
      rating: null,
      reviewCount: 0,
      features: [],
      tags: [category],
      isTrending: false,
      isFeatured: false,
      isNew: false,
      verificationStatus: "link-only"
    };
  });
