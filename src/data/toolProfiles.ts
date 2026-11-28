export type ToolProfile = {
  seoTitle?: string;
  seoDescription?: string;
  overview: string;
  bestFor: string[];
  workflow: string[];
  considerations: string[];
  sourceLabel: string;
  sourceUrl: string;
  faq?: { question: string; answer: string }[];
};

export const toolProfiles: Record<string, ToolProfile> = {
  perplexity: {
    seoTitle: "Perplexity AI — Cited Search & Research | Anjal AI",
    seoDescription: "Explore Perplexity AI for cited web search, Pro Search, Deep Research, Computer workflows and developer APIs.",
    overview: "Perplexity is an AI answer engine designed around web research. It searches the web and presents synthesized answers with links to sources, so readers can inspect the material behind a response. Its official product information also describes deeper research workflows and access to multiple AI models; exact options can vary by plan and product updates.",
    bestFor: [
      "Starting research on a topic and collecting source links",
      "Comparing claims across multiple webpages before making a decision",
      "Building a first-pass summary that you can verify against original sources",
      "Following up on an answer to explore a narrower question"
    ],
    workflow: [
      "Write a focused question and include a date range, location or audience when relevant.",
      "Open the cited pages rather than relying only on the generated summary.",
      "Check whether each source is primary, current and directly relevant to the claim.",
      "Ask a follow-up that tests uncertainty or requests a comparison.",
      "Save useful source URLs and independently verify important facts."
    ],
    considerations: [
      "AI summaries can omit context or misread a source; citations still need to be checked.",
      "A cited page may not support every sentence next to its citation.",
      "Research depth, model choices, file features and usage limits can depend on the current plan.",
      "Do not enter confidential data unless the provider's current privacy terms meet your requirements."
    ],
    sourceLabel: "Perplexity official product overview",
    sourceUrl: "https://www.perplexity.ai/hub",
    faq: [
      { question: "What is Perplexity AI?", answer: "Perplexity describes itself as an AI answer engine that researches the open web and returns concise answers with citations. It can help explore a topic, find source material and ask follow-up questions." },
      { question: "Are Perplexity answers always accurate?", answer: "No AI answer should be treated as automatically correct. Open the cited sources, check whether they support the claim, compare important facts with primary material and look for missing context." }
    ]
  },
  make: {
    seoTitle: "Make.com — Workflow Automation & AI | Anjal AI",
    seoDescription: "Explore Make.com for visual workflow automation, app integrations, AI-powered scenarios and business process orchestration.",
    overview: "Make is a visual automation platform for connecting apps, data sources and AI models into repeatable workflows. Users can build scenarios with a drag-and-drop canvas, describe an automation in natural language, or start from an AI chat and refine the result visually. It is designed for individuals and teams that want to coordinate work across connected services without writing every integration from scratch.",
    bestFor: [
      "Connecting business apps so information moves between them automatically",
      "Automating repetitive steps such as lead routing, notifications and data updates",
      "Building workflows that include AI models alongside ordinary app actions",
      "Making multi-step processes visible so teams can inspect each run"
    ],
    workflow: [
      "Write down the trigger, the information entering the workflow and the final outcome.",
      "Check Make's integration catalogue for the apps involved and confirm supported actions.",
      "Build a small scenario with one trigger and one action before adding branches or AI steps.",
      "Test normal, missing-data and failure cases; inspect each module's input and output.",
      "Add error handling, usage monitoring and access controls before production use."
    ],
    considerations: [
      "Incorrect filters or mappings can send or change the wrong data.",
      "Usage is measured through plan-specific credits and limits; check current pricing before scaling.",
      "Some apps or actions may require custom API connections, permissions or paid plans.",
      "Review data access, retention and security before connecting business or customer information."
    ],
    sourceLabel: "Make official platform overview",
    sourceUrl: "https://www.make.com/"
  },
  "digital-first-ai": {
    seoTitle: "DFIRST AI (formerly Digital First AI) | Anjal AI",
    seoDescription: "Digital First AI is now DFIRST AI, a creative workspace for brand campaigns, content and visual production.",
    overview: "Digital First AI has rebranded to DFIRST AI. The current product presents itself as a creative workspace for brand and marketing teams, bringing research, copy, images, video and website or campaign assets into connected workflows. Its feature pages describe multi-model orchestration, brand-voice guidance, reusable references, real-time research and tools for producing campaign variations. The current product and access model may differ from older listings.",
    bestFor: [
      "Planning a product launch campaign from source material and brand assets",
      "Creating and adapting marketing copy, images and short videos",
      "Keeping campaign outputs aligned with brand references and voice",
      "Researching trends or competitor information to inform creative work",
      "Coordinating multiple creative deliverables in one workspace"
    ],
    workflow: [
      "Open the current DFIRST website and confirm the product access available to your account.",
      "Provide a clear campaign brief, target audience, product details and approved brand assets.",
      "Use research and generation tools to develop a small set of concepts.",
      "Review text, visuals and factual claims before approving any output.",
      "Check connected apps, permissions and data controls before linking company information."
    ],
    considerations: [
      "Digital First AI is now presented as DFIRST AI; older links or product descriptions may be outdated.",
      "The current website may limit workspace access or introduce features through a waitlist.",
      "Generated campaign assets and research require human review for accuracy, brand safety and rights.",
      "Review current pricing, availability, integrations and privacy terms directly with DFIRST."
    ],
    sourceLabel: "DFIRST official product and feature overview",
    sourceUrl: "https://dfirst.ai/"
  },
  "surfer-ai": {
    seoTitle: "Surfer AI — SEO & AI Search Visibility | Anjal AI",
    seoDescription: "Explore Surfer's SEO and AI search visibility platform, including Content Editor, Surfer AI, Topical Map, Content Audit and AI Tracker.",
    overview: "Surfer is an SEO and AI search visibility platform that combines content research, writing and optimization with monitoring for how brands appear in AI-generated answers. Its official product information describes tools such as Content Editor, Surfer AI, Content Audit, Topical Map, keyword research and AI Tracker. Teams can use it to plan content, improve existing pages and monitor visibility across supported search and AI surfaces.",
    bestFor: [
      "Planning topic clusters and content briefs from keyword and competitor research",
      "Writing or editing articles with SEO and AI-search optimization guidance",
      "Generating long-form article drafts with Surfer AI and then editing them",
      "Auditing existing pages to find content refresh opportunities",
      "Tracking brand mentions and citations across supported AI search experiences"
    ],
    workflow: [
      "Choose a target topic, audience, location and language for the content task.",
      "Use keyword research or Topical Map to organize related topics and identify gaps.",
      "Create a Content Editor and decide whether to write manually or generate a draft.",
      "Review the outline, source context, facts, brand voice and internal links before publishing.",
      "Use Content Audit and available visibility reports to prioritize future updates."
    ],
    considerations: [
      "Surfer provides optimization guidance, not a guarantee of Google rankings or AI citations.",
      "Generated drafts need human editing, source verification and original expertise before publication.",
      "AI visibility features, tracked engines and usage limits depend on the current plan.",
      "Content scores are guidance signals; do not add irrelevant keywords just to increase a score.",
      "Check provider terms, integrations and data controls before connecting a production website."
    ],
    sourceLabel: "Surfer official product and documentation",
    sourceUrl: "https://surfer.ai/"
  }
};
