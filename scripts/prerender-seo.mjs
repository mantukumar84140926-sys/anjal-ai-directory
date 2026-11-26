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
const homeBody = `<main>
<header>
<h1>Find the right AI tool and ready-to-use prompt</h1>
<p>Anjal AI is an independent directory for discovering AI software and practical prompt templates. Explore tools for research, writing, coding, design, education, marketing, image and video creation, audio and everyday productivity. Start with the task you want to complete, compare relevant options, and use the provider's official website to confirm current features, pricing and terms.</p>
<p><a href="/finder">Find an AI tool</a> · <a href="/prompts">Browse the free AI prompt library</a></p>
</header>
<section>
<h2>Explore AI tool categories</h2>
<p>Different tasks need different kinds of software. Browse a focused category instead of relying on a generic list: AI assistants for conversation and planning; research tools for finding and checking sources; writing and coding tools for drafting or development; design, image, video and audio tools for creative work; and education, marketing and productivity tools for specialized workflows.</p>
<ul>${homeCategoryLinks}</ul>
</section>
<section>
<h2>Browse AI tools and compare options</h2>
<p>Use the directory to discover products and open their individual profiles. A profile can help you understand the product's category and find its official website. Before choosing a service, compare it against a real task you need to complete rather than assuming that the most popular product is automatically the best fit.</p>
<ul>${homeToolLinks}</ul>
<p>For a more focused shortlist, use the <a href="/finder">AI Tool Finder</a> and narrow your search by the work you want to do. Product features, free-plan limits, supported devices and regional availability can change, so confirm details with the provider before creating an account or paying.</p>
</section>
<section>
<h2>How to choose an AI tool</h2>
<ol>
<li><strong>Describe the job.</strong> Write down the output you need, who will use it and how often the task happens.</li>
<li><strong>Check task fit.</strong> Look for a tool that handles the specific workflow, not just a broad category that sounds relevant.</li>
<li><strong>Test with your own example.</strong> Try a small, low-risk task and note the quality of the result and the editing it needs.</li>
<li><strong>Compare practical limits.</strong> Review usage quotas, pricing, export options, language support, device compatibility and cancellation terms.</li>
<li><strong>Review privacy and reliability.</strong> Read the provider's data practices and test whether the service is dependable enough for your work.</li>
<li><strong>Verify important outputs.</strong> Check factual claims, code, citations, generated media rights and other consequential details before using the result.</li>
</ol>
</section>
<section>
<h2>Get better results with copy-ready AI prompts</h2>
<p>A useful prompt tells an AI assistant what you are trying to achieve, provides the context it needs, explains constraints and specifies the format of the answer. For example, a study prompt can state the subject, class level and topic; a writing prompt can identify the audience and tone; and a coding prompt can include the language, expected behavior and error message.</p>
<p>The <a href="/prompts">Anjal AI Prompt Library</a> offers editable starting points for common workflows. Replace placeholders with your own details, remove instructions that do not apply, and refine the prompt after reviewing the first response. Do not treat generated information as automatically correct.</p>
</section>
<section>
<h2>Using AI for learning and research</h2>
<p>AI tools can help explain a difficult concept, organize revision, create practice questions or suggest a research starting point. Use them to support your own thinking: attempt exercises yourself, compare explanations with trusted course material, open cited sources and check whether the evidence actually supports a claim. Students should follow their school's academic-integrity rules and avoid sharing unnecessary personal information.</p>
<p><a href="/category/education">Explore education AI tools</a> · <a href="/category/research">Explore research AI tools</a></p>
</section>
<section>
<h2>What Anjal AI does—and what it does not promise</h2>
<p>Anjal AI helps people discover AI products and prompt ideas. A directory listing is not a guarantee of product quality, availability, security, suitability or endorsement. Third-party products are operated by their respective providers. Always check the official product page, privacy policy, terms and current pricing before relying on a service or making a purchase.</p>
</section>
</main>`;
const homeJsonLd = {"@context":"https://schema.org","@graph":[{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`,description:homeDescription,potentialAction:{"@type":"SearchAction",target:{"@type":"EntryPoint",urlTemplate:`${origin}/?q={search_term_string}`},"query-input":"required name=search_term_string"}},{"@type":"Organization",name:"Anjal AI",url:`${origin}/`,logo:{"@type":"ImageObject",url:`${origin}/anjal-ai-mark.svg`,width:512,height:512}}]};
fs.writeFileSync(path.join(dist, "index.html"), render({title:homeTitle,description:homeDescription,canonical:`${origin}/`,body:homeBody,jsonLd:homeJsonLd}));

// Prerender the AI Tool Finder and legal pages so direct crawls receive route-specific HTML.
const finderTitle = "AI Tool Finder — Find the Best AI Tool | Anjal AI";
const finderDescription = "Compare AI tools by task, workflow, features, pricing, privacy and practical fit. Explore 1,000 AI tools and free prompts with Anjal AI.";
const finderCategoryLinks = categories.map(category => `<li><a href="/category/${category}">${escapeHtml(categoryNames[category] || "Other")} AI tools</a></li>`).join("");
const finderBody = `<main><nav><a href="/">Anjal AI</a> → <strong>AI Tool Finder</strong></nav>
<h1>Find the right AI tool for your task</h1>
<p>The Anjal AI Tool Finder helps you discover software for writing, coding, research, design, education, marketing, image creation, video, audio and everyday productivity. Start with the work you want to finish, then compare tools that fit your task instead of choosing a product only because it is popular.</p>
<section><h2>How to choose an AI tool</h2><ol>
<li><strong>Define the job.</strong> Write down the outcome you need, who will use it and how often you will use it.</li>
<li><strong>Shortlist by category.</strong> Browse the relevant category below and open the official provider website for current product details.</li>
<li><strong>Compare the real limits.</strong> Check free-plan quotas, paid tiers, usage caps, export formats, supported languages and regional availability.</li>
<li><strong>Test with your own example.</strong> Try a small, realistic task before moving important work into a new service.</li>
<li><strong>Review the result.</strong> Check accuracy, editing effort, reliability and whether the output can be used in your workflow.</li>
</ol></section>
<section><h2>Explore AI tool categories</h2><p>Use these categories to narrow your search. A tool may fit more than one workflow, so compare its current features before deciding.</p><ul>${finderCategoryLinks}</ul></section>
<section><h2>What should you compare?</h2><ul>
<li><strong>Capabilities:</strong> Does the product perform the exact task you need, or does it only offer a related feature?</li>
<li><strong>Ease of use:</strong> Can you get a useful result without a long setup or complicated workflow?</li>
<li><strong>Cost:</strong> Check the current subscription price, billing period, usage limits and cancellation terms on the provider's website.</li>
<li><strong>Privacy:</strong> Read how the provider handles prompts, uploaded files, account information and model-training preferences.</li>
<li><strong>Portability:</strong> Check whether you can export your work and use it with the other tools in your workflow.</li>
<li><strong>Accessibility:</strong> Confirm device support, language options and availability in your country.</li>
</ul></section>
<section><h2>Use prompts to get better results</h2><p>A good AI prompt gives the assistant a clear goal, relevant context, constraints and an expected output format. Add examples when useful, replace placeholders with your own details and review generated content before sharing or publishing it. Browse the <a href="/prompts">free AI prompt library</a> for editable starting points.</p></section>
<section><h2>Independent discovery, not a product guarantee</h2><p>Anjal AI is a discovery directory. Listings are provided to help you explore options; product features, prices, free plans and availability can change. Always confirm important details on the official provider website and review its terms before creating an account or making a purchase.</p></section>
<p><a href="/">Browse all AI tools</a> · <a href="/prompts">Open the AI Prompt Library</a> · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a></p></main>`;
const finderJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:finderTitle,description:finderDescription,url:`${origin}/finder`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const finderOut = path.join(dist, "finder", "index.html");
fs.mkdirSync(path.dirname(finderOut), { recursive: true });
fs.writeFileSync(finderOut, render({title:finderTitle,description:finderDescription,canonical:`${origin}/finder`,body:finderBody,jsonLd:finderJsonLd}));

const privacyTitle = "Privacy Policy: Data, Cookies & Your Choices | Anjal AI";
const privacyDescription = "Learn what information Anjal AI may process, why it is used, and how analytics, submissions and third-party links are handled.";
const privacyBody = `<main><article><nav><a href="/">Anjal AI</a> → <strong>Privacy Policy</strong></nav><h1>Privacy Policy</h1><p><strong>Last updated: November 26, 2026</strong></p>
<p>This policy explains privacy considerations when you visit the Anjal AI directory. The information actually processed can depend on which site features are enabled and which information you choose to submit.</p>
<section><h2>Information you provide</h2><p>If you use a tool submission, listing claim or other form, you may provide details such as a name, email address, website URL, listing information or message. Please provide only information needed for your request and do not submit passwords, payment-card details or sensitive personal information through directory forms.</p></section>
<section><h2>Information collected through site use</h2><p>When analytics or security features are enabled, the site or its service providers may process technical and usage information such as pages visited, referring pages, approximate device or browser details, timestamps and interactions with directory links. The exact data depends on the services configured at the time of your visit.</p></section>
<section><h2>How information may be used</h2><ul><li>To operate, maintain and protect the directory.</li><li>To review tool submissions, listing claims and messages.</li><li>To understand aggregate site usage and improve navigation and content.</li><li>To detect abuse, troubleshoot errors and maintain service security.</li><li>To respond to a request you have made, where a response channel is available.</li></ul></section>
<section><h2>Cookies and similar technologies</h2><p>The website or integrated services may use cookies or similar technologies for essential functionality, preferences, analytics or security where configured. You can manage cookies through your browser settings. Blocking some cookies may affect parts of a website or an embedded service.</p></section>
<section><h2>Service providers and third-party websites</h2><p>Hosting, analytics, form processing or other technical providers may process information to provide their services when those integrations are enabled. The directory also links to external AI tools. When you leave Anjal AI, the external provider's privacy policy and terms apply to your activity on that website. Review them before creating an account or sharing information.</p></section>
<section><h2>Retention and security</h2><p>Information should be kept only for as long as needed for the purpose for which it was collected, operational requirements or applicable obligations. No website or internet transmission can be guaranteed completely secure; avoid sending confidential information through public forms.</p></section>
<section><h2>Your choices and requests</h2><p>You can choose not to submit optional information and can use browser controls to manage cookies. If you have a privacy question or want to ask about information you submitted, use a contact method made available by the directory operator. A request may require enough detail to identify the relevant submission, but do not send passwords or identity documents unless a verified process specifically requires them.</p></section>
<section><h2>Children</h2><p>The directory is a general software-discovery resource and is not designed to collect personal information from children. A parent or guardian who believes a child has submitted personal information should contact the directory operator through an available contact channel.</p></section>
<section><h2>Changes to this policy</h2><p>This page may be updated when site features, service providers or privacy practices change. The revision date above indicates when this page was last updated. Please review it periodically.</p></section>
<p><a href="/">Return to Anjal AI</a> · <a href="/finder">AI Tool Finder</a> · <a href="/terms">Terms of Use</a></p></article></main>`;
const privacyJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:privacyTitle,description:privacyDescription,url:`${origin}/privacy`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const privacyOut = path.join(dist, "privacy", "index.html");
fs.mkdirSync(path.dirname(privacyOut), { recursive: true });
fs.writeFileSync(privacyOut, render({title:privacyTitle,description:privacyDescription,canonical:`${origin}/privacy`,body:privacyBody,jsonLd:privacyJsonLd}));

const termsTitle = "Terms of Use: Directory Rules & Submissions | Anjal AI";
const termsDescription = "Read the terms for browsing Anjal AI, using directory listings, submitting tools, and following links to third-party services.";
const termsBody = `<main><article><nav><a href="/">Anjal AI</a> → <strong>Terms of Use</strong></nav><h1>Terms of Use</h1><p><strong>Last updated: November 26, 2026</strong></p>
<p>These terms describe basic conditions for accessing and using the Anjal AI directory. By using the website, you agree to use it lawfully and responsibly. If you do not agree, please stop using the website.</p>
<section><h2>About the directory</h2><p>Anjal AI is an independent discovery directory that organizes links and information about third-party AI tools and provides prompt-library content. A listing is provided for discovery and does not, by itself, mean that a provider sponsors, endorses or is affiliated with Anjal AI.</p></section>
<section><h2>Accuracy and availability</h2><p>Tool names, descriptions, features, prices, free-plan limits and availability can change. Directory information may be incomplete or out of date. We do not promise that every listing or link is accurate, current, uninterrupted or suitable for a particular purpose. Verify important details directly with the provider before relying on them or making a purchase.</p></section>
<section><h2>Third-party products and websites</h2><p>Third-party tools are operated by their respective providers, not by this directory. Your use of those products is governed by the provider's own terms, privacy policy, pricing and service conditions. Anjal AI is not responsible for third-party products, transactions, content, support or service interruptions.</p></section>
<section><h2>Acceptable use</h2><p>You must not use the website to break the law, infringe another person's rights, distribute malware, interfere with site operation, attempt unauthorized access, submit deceptive information or abuse forms and services. Do not use directory information in a way that misrepresents an affiliation or endorsement.</p></section>
<section><h2>Tool submissions and listing claims</h2><p>Submitting a tool or requesting a listing claim does not guarantee publication, ownership verification, approval, a particular placement or a response time. Submit accurate information that you are authorized to share. Do not impersonate a provider or submit content that infringes another person's rights. Listings may be reviewed, edited, declined or removed to maintain directory quality.</p></section>
<section><h2>Prompts and user responsibility</h2><p>Prompt examples are starting points, not professional advice or guaranteed outputs. Adapt and test prompts for your own needs. Review AI-generated material for accuracy, rights, privacy and suitability before using, publishing or relying on it.</p></section>
<section><h2>Intellectual property</h2><p>Website branding, original directory text and site design belong to their respective rights holders. Third-party product names and marks belong to their owners. You may not copy or republish substantial parts of the directory in a misleading way or imply that you own another party's materials.</p></section>
<section><h2>Changes and site availability</h2><p>Features, listings and these terms may change as the directory evolves. Access may be limited or interrupted for maintenance, security, technical or operational reasons. Continued use after updated terms are posted means you accept the revised terms to the extent permitted by applicable law.</p></section>
<section><h2>Contact</h2><p>For questions about these terms or a directory listing, use a contact method made available by the directory operator. Do not send passwords or payment details in a general message.</p></section>
<p><a href="/">Return to Anjal AI</a> · <a href="/finder">AI Tool Finder</a> · <a href="/privacy">Privacy Policy</a></p></article></main>`;
const termsJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:termsTitle,description:termsDescription,url:`${origin}/terms`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const termsOut = path.join(dist, "terms", "index.html");
fs.mkdirSync(path.dirname(termsOut), { recursive: true });
fs.writeFileSync(termsOut, render({title:termsTitle,description:termsDescription,canonical:`${origin}/terms`,body:termsBody,jsonLd:termsJsonLd}));

for (const category of categories) {
  const name = categoryNames[category] || "Other";
  const matches = catalog.filter(x => mapCategory(x.category) === category);
  const canonical = `${origin}/category/${category}`;
  const title = category === "education" ? "Education AI Tools for Students & Teachers | Anjal AI" : category === "marketing" ? "Marketing AI Tools for SEO & Content | Anjal AI" : `${name} AI Tools | Anjal AI`;
  const description = category === "education" ? "Compare education AI tools for study, revision and teaching. Check learning value, accuracy, privacy, language support and free-plan limits." : `Explore ${matches.length} ${name} AI tools in the Anjal AI directory. Browse related tools and official websites.`;
  const items = matches.map((x, i) => `<li><a href="/tool/${encodeURIComponent(x.slug)}">${escapeHtml(x.name)}</a></li>`).join("");
  const categoryGuide = category === "marketing" ? `<section><h2>How to choose marketing AI tools</h2><p>Marketing tools can support research, content planning, search optimization, creative production, campaign operations and performance analysis. Start with one clear business goal—such as improving content quality, speeding up research or organizing campaign assets—then compare tools against the actual workflow and the people who will use them.</p><h2>What to evaluate before choosing</h2><ul><li><strong>Workflow fit:</strong> Check whether the tool solves a specific step or simply adds another dashboard to manage.</li><li><strong>Originality and brand voice:</strong> Review whether you can guide tone, audience, terminology and editorial standards.</li><li><strong>Evidence and accuracy:</strong> Verify research, statistics, product claims and SEO recommendations against reliable sources.</li><li><strong>Measurement:</strong> Understand which metrics the product reports and whether you can export or validate the underlying data.</li><li><strong>Privacy and rights:</strong> Check how customer data, campaign assets and uploaded content are handled, and review usage rights for generated outputs.</li><li><strong>Cost and integrations:</strong> Confirm current limits, billing, supported channels and compatibility with your existing tools.</li></ul><h2>A practical AI-assisted marketing workflow</h2><ol><li>Define the audience, campaign objective and success metric.</li><li>Gather first-party information and trustworthy research before drafting.</li><li>Use AI for outlines, variations or analysis—not as a substitute for editorial judgment.</li><li>Fact-check claims, review brand consistency and check legal or platform requirements.</li><li>Publish only after human review, then measure results and update the workflow.</li></ol><p>AI-generated copy, images and recommendations can contain errors or rights issues. Review every deliverable before publishing or spending campaign budget.</p></section>` : category === "education" ? `<section><h2>How to choose education AI tools</h2><p>Education software should support learning rather than replace it. Before choosing a tool, decide whether you need help explaining a difficult topic, creating revision material, practicing a language, organizing research or preparing classroom resources. Then check whether the tool is suitable for the learner's age and level, supports the required language, and makes its limitations clear.</p><h2>Useful ways to evaluate a study tool</h2><ul><li><strong>Accuracy:</strong> Compare explanations with textbooks, trusted academic material or teacher guidance.</li><li><strong>Learning value:</strong> Prefer tools that explain steps and encourage practice instead of only supplying answers.</li><li><strong>Privacy:</strong> Check what happens to student names, uploaded assignments, recordings and other personal data.</li><li><strong>Accessibility:</strong> Confirm language, device support and accessibility features before adopting it.</li><li><strong>Cost and limits:</strong> Verify current free-plan quotas, subscriptions and age requirements on the provider's website.</li></ul><h2>A responsible AI study workflow</h2><ol><li>Start with a specific learning objective and your class or exam level.</li><li>Ask for a simple explanation, worked example or short practice quiz.</li><li>Attempt the problem yourself before viewing a suggested solution.</li><li>Check important facts and answers against reliable course material.</li><li>Use feedback to identify what to revise next.</li></ol><p>AI-generated explanations can be incomplete or incorrect. Students should follow their school's academic-integrity rules and teachers or guardians should review tools before classroom or child use.</p><h2>Questions to ask before adopting an education tool</h2><h3>Can it replace a textbook or teacher?</h3><p>No. Treat it as a support tool for explanations and practice. Course materials and qualified teachers remain important sources for curriculum and assessment.</p><h3>Should students copy AI-generated answers?</h3><p>Students should follow their school's rules. A stronger learning approach is to use an explanation to understand the method, solve the task independently and cite or disclose AI assistance when required.</p><h3>What should parents and teachers check?</h3><p>Review age suitability, data collection, account requirements, advertising, moderation, language quality and whether a learner can use the tool safely without sharing unnecessary personal information.</p></section>` : "";
  const body = `<main><nav><a href="/">Anjal AI</a> → <strong>${escapeHtml(name)}</strong></nav><h1>${escapeHtml(name)} AI Tools</h1><p>${escapeHtml(description)}</p>${categoryGuide}<p><strong>${matches.length}</strong> tools listed in this category.</p><ul>${items}</ul><p><a href="/finder">Find an AI tool</a> · <a href="/">Browse all tools</a></p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"CollectionPage",name:title,description,url:canonical,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin}};
  const out = path.join(dist, "category", category, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({title,description,canonical,body,jsonLd}));
}

const curatedToolProfiles = {
  perplexity: {
    overview: "Perplexity is an AI answer engine designed around web research. It searches the web and presents synthesized answers with links to sources, so readers can inspect the material behind a response. Its official product information also describes deeper research workflows and access to multiple AI models; exact options can vary by plan and product updates.",
    bestFor: ["Starting research on a topic and collecting source links", "Comparing claims across multiple webpages before making a decision", "Building a first-pass summary that you can verify against original sources", "Following up on an answer to explore a narrower question"],
    workflow: ["Write a focused question and include a date range, location or audience when relevant.", "Open the cited pages rather than relying only on the generated summary.", "Check whether the source is primary, current and directly relevant to the claim.", "Ask a follow-up that tests uncertainty or requests a comparison table.", "Save useful source URLs and independently verify important facts."],
    considerations: ["AI summaries can omit context or misread a source; citations still need to be checked.", "A cited page may not support every sentence next to its citation.", "Research depth, model choices, file features and usage limits can depend on the current plan.", "Do not enter confidential data unless the provider's current privacy terms meet your requirements."],
    sourceLabel: "Perplexity official product overview",
    sourceUrl: "https://www.perplexity.ai/hub",
    faq: [
      { question: "What is Perplexity AI?", answer: "Perplexity describes itself as an AI answer engine that researches the open web and returns concise answers with citations. It can help you explore a topic, find source material and ask follow-up questions." },
      { question: "Can I use Perplexity for free?", answer: "Perplexity offers a Free plan for core search. Advanced searches, model access, file features and other capabilities have plan-specific limits that can change, so check the current official plan guide before subscribing." },
      { question: "Are Perplexity answers always accurate?", answer: "No AI answer should be treated as automatically correct. Open the cited sources, check whether they support the claim, compare important facts with primary material and look for missing context." },
      { question: "Who may find Perplexity useful?", answer: "Students, researchers, professionals and curious readers may use it to start research, collect sources and compare information. Follow school or workplace rules and verify important findings independently." }
    ],
    planGuideUrl: "https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you"
  },
  chatgpt: {
    overview: "ChatGPT is a conversational AI assistant for tasks such as learning, brainstorming, writing, planning, coding and working with information. Depending on the model, plan and enabled tools, it can also search the web, analyze uploaded files or images, and help create images. Availability and usage limits can differ across accounts and change over time.",
    bestFor: ["Explaining concepts and learning through follow-up questions", "Drafting, rewriting and organizing written material", "Planning projects and turning a broad goal into steps", "Getting help with code, debugging and technical explanations", "Analyzing supported files or images when those tools are available"],
    workflow: ["State the outcome you want and who the result is for.", "Provide relevant context, constraints and a sample of the desired format.", "Ask for assumptions or uncertain points to be identified.", "Review the response, test code and verify important facts with reliable sources.", "Refine the result with specific feedback instead of accepting the first draft."],
    considerations: ["ChatGPT can produce incorrect or outdated information; verify consequential claims.", "Search, file analysis, image tools and other capabilities may depend on plan, region and settings.", "Avoid sharing sensitive information unless you understand the applicable data controls.", "Check current plan details and limits on the official website before purchasing."],
    sourceLabel: "OpenAI ChatGPT capabilities overview",
    sourceUrl: "https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview"
  }
};

for (const tool of catalog) {
  const category = mapCategory(tool.category);
  const categoryName = categoryNames[category] || "Other";
  const canonical = `${origin}/tool/${tool.slug}`;
  const rawTitle = `${tool.name} — ${categoryName} AI Tool | Anjal AI`;
  const title = tool.slug === "perplexity" ? "Perplexity AI: Features, Uses & Free Search | Anjal AI" : rawTitle.length <= 60 ? rawTitle : `${tool.name} — AI Tool | Anjal AI`;
  const description = tool.slug === "perplexity" ? "Explore Perplexity AI for cited web research, source checking and follow-up questions. Compare use cases, limitations and official plan details." : `${tool.name} is an AI tool listed in Anjal AI under ${categoryName}. Explore its official website, category and directory information.`;
  const related = catalog.filter(x => x.slug !== tool.slug && mapCategory(x.category) === category).slice(0, 8);
  const relatedLinks = related.map(x => `<li><a href="/tool/${encodeURIComponent(x.slug)}">${escapeHtml(x.name)}</a></li>`).join("");
  const profile = curatedToolProfiles[tool.slug] || (tool.name.toLowerCase() === "chatgpt" ? curatedToolProfiles.chatgpt : null);
  const profileSections = profile ? `<section><h2>About ${escapeHtml(tool.name)}</h2><p>${escapeHtml(profile.overview)}</p></section>
<section><h2>What people use it for</h2><ul>${profile.bestFor.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
<section><h2>A practical way to evaluate it</h2><ol>${profile.workflow.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>
<section><h2>Things to check before relying on it</h2><ul>${profile.considerations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
${profile.faq ? `<section><h2>Frequently asked questions about ${escapeHtml(tool.name)}</h2>${profile.faq.map(item => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join("")}</section>` : ""}
<section><h2>Official product information</h2><p>Confirm current features, availability and terms with the provider: <a href="${escapeHtml(profile.sourceUrl)}" rel="nofollow noopener">${escapeHtml(profile.sourceLabel)}</a>${profile.planGuideUrl ? ` and <a href="${escapeHtml(profile.planGuideUrl)}" rel="nofollow noopener">its official plan guide</a>` : ""}.</p></section>` : "";;
  const body = `<main><nav><a href="/">AI Tools</a> → <a href="/category/${category}">${escapeHtml(categoryName)}</a> → <strong>${escapeHtml(tool.name)}</strong></nav><h1>${escapeHtml(tool.name)}</h1><p>${escapeHtml(description)}</p>${profileSections}<h2>Directory profile</h2><ul><li>Category: <a href="/category/${category}">${escapeHtml(categoryName)}</a></li><li>Platform: Web</li><li>Official website: <a href="${escapeHtml(tool.website)}" rel="nofollow">${escapeHtml(tool.name)}</a></li><li>Commercial details: not verified unless explicitly marked.</li></ul><h2>Related AI tools</h2><ul>${relatedLinks}</ul><p><a href="/finder">Use AI Tool Finder</a> · <a href="/">Browse all 1000 AI tools</a></p></main>`;
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
  const body = `<main><nav><a href="/">Anjal AI</a> → <a href="/prompts">AI Prompt Library</a> → <strong>${escapeHtml(prompt.title)}</strong></nav><h1>${escapeHtml(prompt.title)} Prompt</h1><p>${escapeHtml(description)}</p><p><strong>Category:</strong> ${escapeHtml(prompt.category)}</p>
<h2>What this AI prompt does</h2><p>${escapeHtml(prompt.description)} Use it as a starting point, replace bracketed placeholders with your own details, and review the AI response before publishing or relying on it.</p>
<h2>How to customize this ${escapeHtml(prompt.category.toLowerCase())} prompt</h2><ol><li>Replace every bracketed placeholder with specific information about your task, audience, source material or desired result.</li><li>Add relevant context such as your goal, experience level, preferred tone, format, length and any constraints the output must follow.</li><li>Keep instructions that protect important details, and remove any direction that does not apply to your use case.</li><li>Run the prompt once, inspect the result, then refine one instruction at a time if the answer is too broad, incomplete or inaccurate.</li></ol>
<h2>Copy-ready prompt</h2><pre>${escapeHtml(prompt.prompt)}</pre>
<h2>Tips for better results</h2><ul><li><strong>Be specific:</strong> replace vague requests with concrete requirements and examples.</li><li><strong>Set boundaries:</strong> state what must stay unchanged, what should be avoided and what information the AI must not invent.</li><li><strong>Choose an output format:</strong> ask for steps, a table, a checklist, a draft or another structure that is easy to review.</li><li><strong>Verify important details:</strong> check facts, names, figures, permissions and final quality before using the output.</li><li><strong>Protect private information:</strong> do not paste passwords, confidential records or personal data into an AI service unless you understand and accept its data practices.</li></ul>
<h2>Related topics</h2><ul>${tags}</ul><h2>Related AI prompts</h2><ul>${relatedLinks}</ul><p>Explore more ideas in the <a href="/prompts">free AI prompt library</a>, or use the <a href="/finder">AI tool finder</a> to discover software for your workflow.</p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"CreativeWork",name:prompt.title,description,url:canonical,genre:prompt.category,keywords:prompt.tags.join(", "),isPartOf:{"@type":"CollectionPage",name:"AI Prompt Library",url:`${origin}/prompts`}};
  const out = path.join(dist, "prompt", slug, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({title,description,canonical,body,jsonLd}));
}
fs.rmSync(promptManifestPath, { force: true });

console.log(`Prerendered ${catalog.length} tool pages, ${categories.length} category pages and ${curatedPrompts.length} curated prompt pages.`);
