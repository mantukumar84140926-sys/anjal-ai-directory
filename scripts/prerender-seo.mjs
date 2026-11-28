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
const toolCategoryOverrides = {"word-spinner":"writing","spinbot":"writing","subpals":"marketing"};
const categoryForTool = tool => toolCategoryOverrides[tool.slug] || mapCategory(tool.category);
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

function render({ title, description, canonical, body, jsonLd, robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" }) {
  let html = template;
  const titleStart = html.indexOf("<title>");
  const titleEnd = html.indexOf("</title>", titleStart);
  if (titleStart >= 0 && titleEnd >= 0) {
    html = html.slice(0, titleStart) + `<title>${escapeHtml(title)}</title>` + html.slice(titleEnd + "</title>".length);
  }
  // Replace the template homepage tags; never leave its canonical on route pages.
  const headTags = [
    ["meta", "name", "description", `<meta name="description" content="${escapeHtml(description)}">`],
    ["meta", "name", "robots", `<meta name="robots" content="${escapeHtml(robots)}">`],
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

const categoryGuides = {
  "ai-assistants": "<section><h2>How to choose an AI assistant</h2><p>AI assistants can help with conversation, writing, reasoning, coding, search, file analysis and everyday planning. Start by defining the task: a quick explanation, a source-backed research answer, a long document review or a multi-step workflow may need different capabilities. A general chatbot is not automatically the best choice for every job.</p><h2>What to compare</h2><ul><li><strong>Answer quality:</strong> Test the assistant with realistic questions from your own work and check whether it follows instructions consistently.</li><li><strong>Fresh information:</strong> Confirm whether web search is available and whether answers include links that support the claims.</li><li><strong>Files and media:</strong> Check the file types, image or audio support and size limits you actually need.</li><li><strong>Model choice:</strong> Compare reasoning, speed, context limits and available models rather than relying on a single benchmark.</li><li><strong>Privacy:</strong> Review retention, training controls, workspace permissions and data-processing terms before sharing sensitive material.</li><li><strong>Cost:</strong> Check message caps, model-specific usage, API billing and team seats.</li></ul><h2>A reliable assistant workflow</h2><ol><li>State the goal, audience, constraints and expected output format.</li><li>Give only the context needed for the task.</li><li>Ask the assistant to separate verified facts, assumptions and uncertainty.</li><li>Open cited sources and test code or calculations independently.</li><li>Review the final result before using or sharing it.</li></ol><p>AI assistants can make factual and reasoning mistakes. Use them as support for human judgment, not as the only authority for important decisions.</p></section>",
  "image-generation": "<section><h2>How to choose an AI image generator</h2><p>Image tools vary in how they interpret prompts, preserve details, edit existing pictures and support commercial workflows. Decide whether you need concept art, product imagery, social graphics, photo editing, background removal or consistent visual assets before comparing products.</p><h2>Features worth checking</h2><ul><li><strong>Prompt control:</strong> Look for useful controls for composition, aspect ratio, style, lighting and negative instructions.</li><li><strong>Image editing:</strong> Check whether the tool supports inpainting, outpainting, image-to-image workflows or reference images.</li><li><strong>Consistency:</strong> Test whether it can keep a subject, product or visual identity consistent across variations.</li><li><strong>Output quality:</strong> Review resolution, upscaling, export formats, watermarks and generation speed.</li><li><strong>Rights and safety:</strong> Read the provider's rules for commercial use, uploaded reference images, likenesses and generated content.</li><li><strong>Cost:</strong> Compare credit systems, queue priority and limits for high-resolution outputs.</li></ul><h2>A practical image workflow</h2><ol><li>Describe the subject, purpose, audience and required aspect ratio.</li><li>Generate a small set of concepts before spending credits on refinements.</li><li>Use reference images only when you have permission to use them.</li><li>Inspect text, hands, logos and small details manually.</li><li>Export the correct size and keep a record of any required attribution or usage terms.</li></ol></section>",
  "video-generation": "<section><h2>How to choose an AI video generator</h2><p>AI video products may turn text prompts or still images into motion, extend clips, create avatars, add voiceovers or assemble edited scenes. The best fit depends on whether you need cinematic shots, product demonstrations, explainers, social clips or repeatable production templates.</p><h2>What to evaluate</h2><ul><li><strong>Input modes:</strong> Check text-to-video, image-to-video, video editing and reference-image support.</li><li><strong>Continuity:</strong> Test whether characters, clothing, products, locations and camera direction remain consistent across shots.</li><li><strong>Control:</strong> Compare camera motion, timing, keyframes, scene extension and editing controls.</li><li><strong>Audio:</strong> Confirm whether speech, sound effects, music and lip synchronization are included or require separate tools.</li><li><strong>Output:</strong> Review clip length, resolution, aspect ratios, watermarking and export formats.</li><li><strong>Rights:</strong> Check commercial permissions and restrictions on real people, copyrighted material and uploaded footage.</li></ul><h2>A dependable production workflow</h2><ol><li>Write a shot list and lock the visual style before generating clips.</li><li>Use one reference frame or character description consistently across related shots.</li><li>Generate short tests and review motion artifacts before creating a full sequence.</li><li>Join clips in an editor, then check continuity, sound and pacing.</li><li>Review every frame and confirm rights before publishing.</li></ol></section>",
  "audio-music": "<section><h2>How to choose an AI audio or music tool</h2><p>Audio products cover several different jobs: music composition, voice generation, speech transcription, voice cleanup, sound effects, mastering and audio editing. Decide whether you need an original track, a narration, a transcript or a finished mix; tools designed for one job may not be suitable for another.</p><h2>What to compare</h2><ul><li><strong>Audio task:</strong> Confirm whether the product generates music, speech, effects or transcripts, and which languages it supports.</li><li><strong>Creative control:</strong> Look for controls over genre, mood, tempo, duration, lyrics, voice style or editing.</li><li><strong>Quality:</strong> Listen for pronunciation, artifacts, timing, mix balance and consistency across longer outputs.</li><li><strong>Export:</strong> Check formats, sample rates, stems, editing options and download limits.</li><li><strong>Rights and consent:</strong> Review commercial licensing and never clone or imitate a real person's voice without appropriate permission.</li><li><strong>Usage limits:</strong> Check credits, generation caps and whether uploads or advanced tools require a paid plan.</li></ul><h2>A safe audio workflow</h2><ol><li>Write a brief describing the intended use, audience, duration and mood.</li><li>Generate a short draft and listen on more than one device.</li><li>Correct names, pronunciation, lyrics and timing before publishing.</li><li>Keep proof of rights for source audio, samples and voice recordings.</li><li>Check the provider's current licence for monetized or client work.</li></ol></section><section><h2>Music and voice rights matter</h2><p>Before using generated audio in a public video, podcast, advertisement or client project, read the provider's current commercial-use terms. Keep proof of permission for source recordings and samples, and obtain consent before using a real person's voice or likeness. A technically usable download is not automatically cleared for every distribution or monetization purpose.</p></section>",
  "writing": "<section><h2>How to choose an AI writing tool</h2><p>Writing assistants can help with drafting, rewriting, grammar, summaries, translation, tone and long-form editing. Choose a product based on the stage of writing you need help with: planning, first drafts, line editing, fact-checking or publishing. A rewriting tool is not a substitute for subject knowledge or original reporting.</p><h2>What to evaluate</h2><ul><li><strong>Editing depth:</strong> Check whether it explains grammar and style suggestions or simply replaces words.</li><li><strong>Voice and tone:</strong> Test whether it preserves your meaning, terminology and intended audience.</li><li><strong>Long documents:</strong> Check context limits, document imports, comments and collaboration features.</li><li><strong>Language support:</strong> Test the languages and regional variants you actually write in.</li><li><strong>Privacy:</strong> Review how drafts, manuscripts and uploaded documents are stored and used.</li><li><strong>Integrity:</strong> Do not use paraphrasing or AI-detection scores as proof of authorship or as a way to bypass academic or editorial rules.</li></ul><h2>A responsible editing workflow</h2><ol><li>Write the core ideas and factual claims yourself or provide trusted source material.</li><li>Ask for a specific edit, such as clarity, structure or tone, rather than a vague rewrite.</li><li>Compare the revised draft with the original to catch changed meaning.</li><li>Verify quotations, statistics, citations and technical details.</li><li>Make the final editorial decision yourself and disclose AI assistance when required.</li></ol></section>",
  "coding": "<section><h2>How to choose an AI coding assistant</h2><p>Coding assistants range from chat-based explainers to IDE autocomplete, repository-aware agents, code review tools and test generators. Choose one that fits your development workflow and the languages, frameworks and repositories you actually use.</p><h2>What to compare</h2><ul><li><strong>Context:</strong> Check whether the tool can understand multiple files, repository structure, documentation and project conventions.</li><li><strong>IDE support:</strong> Confirm compatibility with your editor, terminal, Git provider and development environment.</li><li><strong>Control:</strong> Review whether proposed edits are shown as diffs and require approval before they are applied.</li><li><strong>Testing:</strong> See whether it can run tests, explain failures and suggest targeted fixes.</li><li><strong>Security:</strong> Inspect generated dependencies, authentication logic, secrets handling and vulnerable patterns.</li><li><strong>Data policy:</strong> Review how source code and prompts are retained, used for training or shared with providers.</li></ul><h2>A safer coding workflow</h2><ol><li>Describe the bug or feature and provide the smallest relevant code context.</li><li>Ask for a plan before requesting broad changes.</li><li>Review every diff and keep changes small enough to understand.</li><li>Run tests, linting and security checks locally or in CI.</li><li>Commit only after reviewing the final behavior and rollback path.</li></ol><p>AI-generated code can contain bugs, insecure assumptions or incompatible licences. Treat it as a draft that must be reviewed and tested.</p></section>",
  "design": "<section><h2>How to choose an AI design tool</h2><p>Design products may generate graphics, create layouts, edit images, produce presentations or help maintain a visual identity. Start with the deliverable you need and the people who must edit or approve it, then compare tools for control and export quality.</p><h2>What to evaluate</h2><ul><li><strong>Design task:</strong> Confirm whether the tool handles brand assets, layouts, presentations, graphics or image editing.</li><li><strong>Brand control:</strong> Check reusable colors, fonts, logos, templates and brand guidelines.</li><li><strong>Editing:</strong> See whether you can adjust individual elements after generation or only export a flattened result.</li><li><strong>Collaboration:</strong> Review comments, shared libraries, approvals and team permissions.</li><li><strong>Accessibility:</strong> Check contrast, readable typography, alt text and language support.</li><li><strong>Rights:</strong> Understand ownership and commercial use rules for templates, fonts, stock assets and generated images.</li></ul><h2>A practical design workflow</h2><ol><li>Define the audience, message, channel and output dimensions.</li><li>Prepare approved brand assets and a clear content brief.</li><li>Generate concepts, then refine the strongest option manually.</li><li>Check text, layout, contrast and mobile readability.</li><li>Export the correct format and retain editable source files when possible.</li></ol></section>",
  "productivity": "<section><h2>How to choose an AI productivity tool</h2><p>Productivity tools can help organize tasks, summarize information, automate repetitive work, manage meetings or connect business applications. Choose based on the workflow you want to improve, not the number of AI features on a product page.</p><h2>What to compare</h2><ul><li><strong>Workflow fit:</strong> Identify the exact repetitive task and the people involved.</li><li><strong>Integrations:</strong> Confirm that the apps, calendars, files and databases you use are supported.</li><li><strong>Automation control:</strong> Check approval steps, error handling, logs and the ability to undo changes.</li><li><strong>Reliability:</strong> Test what happens when an app is unavailable or data is missing.</li><li><strong>Security:</strong> Review permissions, data retention and access controls for connected accounts.</li><li><strong>Cost:</strong> Compare task, credit, user and API limits at the scale you expect.</li></ul><h2>A practical automation workflow</h2><ol><li>Map the current process from trigger to outcome.</li><li>Start with a small test using non-sensitive data.</li><li>Require human approval for payments, external messages or important record changes.</li><li>Test failure cases and monitor each run.</li><li>Document ownership and a manual fallback before depending on automation.</li></ol></section><section><h2>Measure whether automation helps</h2><p>Compare the time, error rate and handoff quality of the original process with the automated version. Keep a manual fallback for outages, and make sure someone owns the workflow when integrations or permissions change. For actions that send external messages, alter customer records or spend money, add explicit approval and an audit trail.</p></section><section><h2>Plan for ownership and change</h2><p>Every automated workflow needs an owner who can update credentials, review failed runs and respond when an integrated app changes its API. Document what the automation is allowed to do, which actions require approval and how to pause it quickly. Revisit the workflow after process changes rather than assuming an automation remains correct forever.</p></section>",
  "research": "<section><h2>How to choose an AI research tool</h2><p>Research assistants can search the web, read documents, compare sources, summarize findings or produce longer reports. Their value depends on the quality of the sources and how clearly they show where claims came from. Choose a tool that matches the depth and evidence standard of your research.</p><h2>What to evaluate</h2><ul><li><strong>Source coverage:</strong> Check whether it searches the open web, selected databases, uploaded files or a defined corpus.</li><li><strong>Citations:</strong> Open links and confirm that each source supports the sentence it is attached to.</li><li><strong>Freshness:</strong> Check publication dates and whether the tool can distinguish current information from older material.</li><li><strong>Research depth:</strong> Compare quick answers with multi-step research, document extraction and report exports.</li><li><strong>Transparency:</strong> Look for source lists, quotes, uncertainty and a way to inspect the underlying material.</li><li><strong>Privacy:</strong> Review how uploaded documents and queries are handled.</li></ul><h2>A reliable research workflow</h2><ol><li>Turn the topic into a specific question and define the time period.</li><li>Ask for a source list before requesting a final summary.</li><li>Prioritize primary sources, official documents and original research.</li><li>Compare conflicting claims and record what remains uncertain.</li><li>Keep citations and notes so another person can reproduce the work.</li></ol></section><section><h2>Keep a reproducible research trail</h2><p>Record the exact question, date searched, source URLs and any filters used. Separate primary evidence from commentary, and do not treat a generated citation as proof until you open the linked page. For business, health, legal or financial topics, confirm conclusions with authoritative sources and qualified professionals.</p></section><section><h2>Build a source hierarchy</h2><p>For a research task, decide in advance which evidence should carry the most weight. Official documentation, original datasets, academic papers and regulatory publications usually provide stronger support than summaries or social posts. Keep secondary commentary separate from primary evidence, and note when a source is outdated or conflicts with another source. A useful AI research report should make it possible for another reader to retrace the evidence and understand what remains uncertain.</p></section>",
  "other": "<section><h2>How to evaluate an AI tool</h2><p>Tools in this collection cover different tasks, so start by checking the product's actual purpose and whether it uses AI for the workflow you need. A clear use case is more useful than a long feature list. Try to identify the input you provide, the output you receive and the amount of human review required.</p><h2>Questions to ask before choosing</h2><ul><li><strong>Purpose:</strong> What specific task does the product perform, and who is it designed for?</li><li><strong>Evidence:</strong> Can you test the core feature and verify the result?</li><li><strong>Compatibility:</strong> Does it work with your devices, files, languages and existing tools?</li><li><strong>Privacy:</strong> What data do you upload, and how does the provider handle it?</li><li><strong>Commercial terms:</strong> Are pricing, usage limits, ownership and cancellation rules clear?</li><li><strong>Support:</strong> Is there current documentation and a way to get help?</li></ul><h2>Before relying on an AI result</h2><p>Test a real example, compare the result with a trusted source and check what happens when the input is incomplete or unusual. AI-generated material can be inaccurate or unsuitable. Keep a human review step for decisions, public content and sensitive information.</p></section><section><h2>Test before you commit</h2><p>Use a realistic example rather than relying only on a product demo. Check whether the result is editable, exportable and repeatable, and whether the provider explains its data handling and support process. If the tool is not actually AI-powered or its official website cannot be verified, treat the listing cautiously and do not assume it belongs in an AI workflow.</p></section>",
  "education": "<section><h2>How to choose education AI tools</h2><p>Education software should support learning rather than replace it. Decide whether you need help understanding a difficult topic, making revision material, practicing a language, organizing research or preparing classroom resources. Check that a tool suits the learner's age and level, supports the required language and explains its limitations.</p><h2>What students, parents and teachers should evaluate</h2><ul><li><strong>Accuracy:</strong> Compare explanations with textbooks, course materials and teacher guidance.</li><li><strong>Learning value:</strong> Prefer tools that explain steps and encourage practice rather than only supplying final answers.</li><li><strong>Privacy:</strong> Review how student names, assignments, recordings and uploaded files are handled.</li><li><strong>Accessibility:</strong> Confirm language, device support and accessibility options.</li><li><strong>Age suitability:</strong> Check minimum-age rules, moderation, advertising and whether adult supervision is recommended.</li><li><strong>Cost:</strong> Verify free-plan quotas, subscription limits and classroom licences.</li></ul><h2>A responsible AI study workflow</h2><ol><li>Start with a specific learning objective and the student's class or exam level.</li><li>Ask for a simple explanation, a worked example or a short practice quiz.</li><li>Try the problem independently before reviewing a suggested solution.</li><li>Check important facts and answers against trusted course material.</li><li>Use mistakes to decide what to revise next.</li></ol><h2>Questions to ask before adopting a study tool</h2><h3>Can AI replace a textbook or teacher?</h3><p>No. Treat AI as a support for explanations and practice; course materials and qualified teachers remain important sources for curriculum and assessment.</p><h3>Should students copy AI-generated answers?</h3><p>Students should follow their school's academic-integrity rules. A better approach is to use explanations to understand the method, solve tasks independently and disclose AI assistance when required.</p><h3>What should families and schools check?</h3><p>Review age requirements, data collection, account setup, advertising, moderation, language quality and whether learners can use the tool safely without sharing unnecessary personal information.</p></section>",
  "marketing": "<section><h2>How to choose marketing AI tools</h2><p>Marketing tools can support audience research, content planning, search optimization, copywriting, creative production, campaign operations and performance analysis. Start with one measurable business goal—such as improving content quality, speeding up research or organizing campaign assets—then compare products against the actual workflow and the people who will use them.</p><h2>What to evaluate before choosing</h2><ul><li><strong>Workflow fit:</strong> Check whether the product solves a specific step or simply adds another dashboard to manage.</li><li><strong>Originality and brand voice:</strong> Review whether you can guide tone, audience, terminology and editorial standards.</li><li><strong>Evidence and accuracy:</strong> Verify research, statistics, product claims and SEO recommendations against reliable sources.</li><li><strong>Measurement:</strong> Understand which metrics the product reports and whether you can export or validate the underlying data.</li><li><strong>Privacy and rights:</strong> Check how customer data, campaign assets and uploaded content are handled, including usage rights for generated outputs.</li><li><strong>Integrations:</strong> Confirm supported channels, analytics systems, CRM connections and export options.</li><li><strong>Cost:</strong> Compare seats, credits, automation runs, API usage and plan limits at your expected scale.</li></ul><h2>A practical AI-assisted marketing workflow</h2><ol><li>Define the audience, campaign objective and success metric before generating content.</li><li>Gather first-party information and trustworthy research before drafting.</li><li>Use AI for outlines, variations or analysis—not as a substitute for editorial judgment.</li><li>Fact-check claims, review brand consistency and check legal or platform requirements.</li><li>Publish only after human review, then measure results and update the workflow.</li></ol><h2>Common mistakes to avoid</h2><p>Do not publish unverified claims, keyword-stuffed copy or generic generated posts at scale. Search visibility depends on usefulness and relevance, not simply on how much content a tool can produce. Review every deliverable before publishing or spending campaign budget.</p></section>"
};

for (const category of Object.keys(categoryNames)) {
  const name = categoryNames[category] || "Other";
  const matches = catalog.filter(x => categoryForTool(x) === category);
  const canonical = `${origin}/category/${category}`;
  const categoryTitleOverrides = {"ai-assistants":"AI Assistants & Chatbots | Anjal AI","image-generation":"AI Image Generation Tools | Anjal AI","video-generation":"AI Video Generation Tools | Anjal AI","audio-music":"AI Audio & Music Tools | Anjal AI","writing":"AI Writing Tools for Drafting & Editing | Anjal AI","coding":"AI Coding Tools for Developers | Anjal AI","design":"AI Design Tools for Creative Work | Anjal AI","productivity":"AI Productivity & Automation Tools | Anjal AI","marketing":"AI Marketing Tools for SEO & Content | Anjal AI","education":"AI Tools for Students & Teachers | Anjal AI","research":"AI Research Tools for Search & Analysis | Anjal AI","other":"More AI Tools for Specialized Tasks | Anjal AI"};
  const title = categoryTitleOverrides[category] || `${name} AI Tools | Anjal AI`;
  const description = matches.length === 0 ? `${name} AI tools are being organized in the Anjal AI directory. Explore related categories and official product listings while this collection is expanded.` : category === "education" ? "Compare education AI tools for study, revision and teaching. Check learning value, accuracy, privacy, language support and free-plan limits." : `Explore ${matches.length} ${name} AI tools in the Anjal AI directory. Browse related tools and official websites.`;
  const items = matches.map((x, i) => `<li><a href="/tool/${encodeURIComponent(x.slug)}">${escapeHtml(x.name)}</a></li>`).join("");
  const categoryGuide = categoryGuides[category] || "";
  const emptyCategoryGuide = matches.length === 0 ? `<section><h2>Explore related AI tools</h2><p>This category does not yet have a dedicated tool collection. Many business workflows can be supported by tools in marketing, productivity, coding and design. Browse those collections to compare relevant products and confirm their current features on the official provider websites.</p><ul><li><a href="/category/marketing">Marketing AI tools</a></li><li><a href="/category/productivity">Productivity AI tools</a></li><li><a href="/category/coding">Coding AI tools</a></li><li><a href="/category/design">Design AI tools</a></li></ul></section>` : "";
  const body = `<main><nav><a href="/">Anjal AI</a> → <strong>${escapeHtml(name)}</strong></nav><h1>${escapeHtml(name)} AI Tools</h1><p>${escapeHtml(description)}</p>${categoryGuide}${matches.length ? `<p><strong>${matches.length}</strong> tools listed in this category.</p><ul>${items}</ul>` : emptyCategoryGuide}<p><a href="/finder">Find an AI tool</a> · <a href="/">Browse all tools</a></p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"CollectionPage",name:title,description,url:canonical,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin}};
  const out = path.join(dist, "category", category, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({title,description,canonical,body,jsonLd,robots:matches.length ? undefined : "noindex,follow"}));
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
  },

  make: {
    seoTitle: "Make.com — Workflow Automation & AI | Anjal AI",
    overview: "Make is a visual automation platform for connecting apps, data sources and AI models into repeatable workflows. Users can build scenarios with a drag-and-drop canvas, describe an automation in natural language, or start from an AI chat and refine the result visually. It is designed for individuals and teams that want to coordinate work across connected services without writing every integration from scratch.",
    bestFor: ["Connecting business apps so information moves between them automatically", "Automating repetitive steps such as lead routing, notifications and data updates", "Building workflows that include AI models alongside ordinary app actions", "Making multi-step processes visible so teams can inspect how each run behaves"],
    workflow: ["Write down the trigger, the information that enters the workflow and the final outcome you want.", "Search Make's integration catalogue for the apps involved and confirm the actions each connector supports.", "Build a small scenario with one trigger and one action before adding branches or AI steps.", "Test normal, missing-data and failure cases; inspect each module's input and output.", "Add error handling, usage monitoring and access controls before relying on the workflow in production."],
    considerations: ["A visual builder still requires careful logic: incorrect filters or mappings can send or change the wrong data.", "Usage is measured through plan-specific credits and limits; check current pricing and quotas before scaling.", "Some apps or actions may require custom API connections, permissions or paid plans.", "Review data access, retention and security requirements before connecting business or customer information."],
    sourceLabel: "Make official platform overview",
    sourceUrl: "https://www.make.com/",
    faq: [
      { question: "What is Make.com used for?", answer: "Make is a visual automation platform that connects apps, data sources and AI services into multi-step workflows called scenarios." },
      { question: "Can Make connect AI models to business workflows?", answer: "Yes. Make supports workflows that combine AI models with app integrations, data transformations and approval steps. Available modules depend on the connected service." }
    ]
  },
  poe: {
    seoTitle: "Poe AI — Multi-Model Chatbots & Bots | Anjal AI",
    overview: "Poe is a platform for using a range of AI bots in one place. Its help centre describes bots powered by different third-party model providers, alongside image, video and audio tools and user-created bots. Poe also lets people create custom bots, including prompt-based bots and API-connected bots, so the experience can be adapted to a particular task.",
    bestFor: ["Trying different AI models through one interface", "Comparing how multiple bots respond to the same question", "Exploring specialist bots for writing, learning, research or creative tasks", "Creating and sharing a custom prompt bot or an API-backed bot"],
    workflow: ["Open the bot directory and choose a bot suited to the task rather than assuming all bots behave alike.", "Give the bot the same clear context and constraints you would provide any AI assistant.", "For comparisons, ask several bots the same question and check their answers against reliable sources.", "Review the point cost shown for a bot before using it repeatedly, especially for image or other media generation.", "If building a custom bot, define its purpose, instructions and boundaries, then test it with realistic prompts."],
    considerations: ["Bots may be powered by third-party providers, so capabilities and behavior differ between bots.", "Responses consume points; free and paid accounts have different point allowances and access.", "A custom bot's output still needs human review for accuracy, privacy and suitability.", "Check Poe's current terms and privacy information before uploading sensitive files or personal data."],
    sourceLabel: "Poe official FAQs and bot guide",
    sourceUrl: "https://help.poe.com/hc/en-us/articles/19944206309524-Poe-FAQs",
    faq: [
      { question: "Can Poe use different AI models?", answer: "Yes. Poe provides access to bots powered by multiple third-party AI providers. The available bots and their capabilities can change, so check the bot details in Poe." },
      { question: "Can I create my own Poe bot?", answer: "Poe supports prompt bots and API bots. Prompt bots use written instructions, while API bots can connect custom code to respond to messages." }
    ]
  },
  grok: {
    seoTitle: "Grok AI — xAI Assistant, Search & Creation | Anjal AI",
    overview: "Grok is a conversational AI assistant from xAI for chat, search, reasoning and content creation. Its official product information describes web and X search, voice conversations, coding assistance, file and image understanding, and image or video generation. Which capabilities and usage limits are available can depend on the account, plan, region and current product release.",
    bestFor: ["Exploring current topics with web search and X-related context", "Drafting, summarizing and brainstorming through conversational follow-ups", "Getting explanations or assistance with code", "Working with supported files, images and creative-generation features"],
    workflow: ["Choose whether the task needs current search, deeper reasoning, coding help or creative generation.", "State the goal, relevant context, date range and preferred answer format.", "For current events or factual research, open the cited sources and verify key claims independently.", "For code, test the suggested changes in a safe environment before using them.", "Review generated images, video and text for accuracy, rights and suitability before publishing."],
    considerations: ["AI responses can be wrong, incomplete or missing context; verify consequential information.", "Search results and social posts may be biased, unrepresentative or outdated.", "Image, video, voice, file and advanced reasoning features may have separate plan limits.", "Do not upload confidential material unless the provider's current privacy terms and controls meet your needs."],
    sourceLabel: "xAI official Grok overview",
    sourceUrl: "https://x.ai/grok",
    faq: [
      { question: "What can Grok help with?", answer: "xAI describes Grok as an assistant for chat, search, reasoning and creation, including writing, research, coding, voice and supported image or video tasks." },
      { question: "Does Grok provide live information?", answer: "Grok's official product page describes web and X search for current information. Always open and verify sources for important or time-sensitive claims." }
    ]
  },
  "microsoft-copilot": {
    seoTitle: "Microsoft Copilot — AI Assistant & 365 Tools | Anjal AI",
    overview: "Microsoft Copilot is an AI assistant for asking questions, drafting and rewriting content, summarizing information and working with supported Microsoft experiences. Microsoft's Copilot Chat information describes web-grounded chat and features such as voice, read-aloud, dictation and chat history. A Microsoft 365 Copilot licence adds deeper integration with apps such as Word, Excel, PowerPoint, Outlook and Teams, depending on the plan and organization setup.",
    bestFor: ["Getting help with everyday questions, explanations and brainstorming", "Rewriting text for clarity, tone or a specific audience", "Summarizing supported documents, PDFs, webpages or conversations", "Working with Microsoft 365 apps and organizational content when the right licence is available"],
    workflow: ["Sign in with the account type appropriate for personal, school or work use.", "Describe the task and specify the audience, tone, length and output format.", "When using web-grounded answers, open sources and verify important details.", "For Microsoft 365 work, confirm which apps and features are included in your organization's licence.", "Review drafts, summaries and generated files before sharing or relying on them."],
    considerations: ["Microsoft Copilot and Microsoft 365 Copilot are not identical products; features depend on account and licence.", "Work-grounded features may require an eligible Microsoft 365 plan and organizational configuration.", "AI-generated text, summaries and analysis can contain errors and should be checked.", "Follow your organization's data, privacy and AI-use policies when using a work or school account."],
    sourceLabel: "Microsoft Copilot Chat features and plans",
    sourceUrl: "https://www.microsoft.com/en/copilot/features/chat",
    faq: [
      { question: "Is Microsoft Copilot the same as Microsoft 365 Copilot?", answer: "No. Microsoft describes Copilot Chat as web-grounded AI chat, while a Microsoft 365 Copilot licence adds deeper work-context and app integrations. Exact features depend on the eligible plan." },
      { question: "Can Copilot help with Word, Excel and PowerPoint?", answer: "Microsoft lists Copilot experiences across apps such as Word, Excel, PowerPoint, Outlook and Teams for eligible Microsoft 365 Copilot users. Check your account's licence and feature availability." }
    ]
  },
  "chatiq": {
    "seoTitle": "ChatIQ — AI Customer Support Chatbot | Anjal AI",
    "overview": "ChatIQ is an AI-powered customer-support and ticketing workspace. Its official website describes a chatbot trained on company information that can answer common customer questions, draft replies, prioritize incoming support tickets and hand conversations to a human when needed. Businesses can add knowledge from website pages, PDFs or plain text and embed a branded chat widget on their site.",
    "bestFor": [
      "Answering common website support questions using company-specific information",
      "Drafting responses to incoming customer support tickets",
      "Prioritizing tickets using the context of company data",
      "Capturing leads and routing conversations to a human team",
      "Adding a branded AI chat widget to a marketing or product website"
    ],
    "workflow": [
      "Collect approved FAQs, support documents and product pages that the chatbot should use.",
      "Upload or connect the source material using the options available in the current plan.",
      "Set the bot's role, response tone, brand appearance and escalation rules.",
      "Test common questions, unclear requests and cases where a human should take over.",
      "Monitor conversations and ticket outcomes, then update the knowledge base when policies or products change."
    ],
    "considerations": [
      "A chatbot can misunderstand a question or use outdated source material; review its replies and update the knowledge base.",
      "Keep a clear human handoff for complaints, account-specific issues and questions the bot cannot answer safely.",
      "Review data retention, customer privacy and access permissions before uploading support conversations or internal documents.",
      "Current plans, message limits and feature availability should be checked on the provider's official website."
    ],
    "sourceLabel": "ChatIQ official product overview and FAQs",
    "sourceUrl": "https://www.chatiq.ai/"
  },
  "surfer-ai": {
    "seoTitle": "Surfer AI — SEO & AI Search Visibility | Anjal AI",
    "overview": "Surfer is an SEO and AI search visibility platform that combines content research, writing and optimization with monitoring for how brands appear in AI-generated answers. Its official product information describes tools such as Content Editor, Surfer AI, Content Audit, Topical Map, keyword research and AI Tracker. Teams can use it to plan content, improve existing pages and monitor visibility across supported search and AI surfaces.",
    "bestFor": [
      "Planning topic clusters and content briefs from keyword and competitor research",
      "Writing or editing articles with live SEO and AI-search optimization guidance",
      "Generating long-form article drafts with Surfer AI and then editing them",
      "Auditing existing pages to find content refresh opportunities",
      "Tracking brand mentions and citations across supported AI search experiences"
    ],
    "workflow": [
      "Choose a target topic, audience, location and language for the content task.",
      "Use keyword research or Topical Map to organize related topics and identify gaps.",
      "Create a Content Editor and decide whether to write manually or generate a draft with Surfer AI.",
      "Review the outline, source context, facts, brand voice and internal links before publishing.",
      "Use Content Audit and available visibility reports to prioritize future updates."
    ],
    "considerations": [
      "Surfer provides optimization guidance, not a guarantee of Google rankings or AI citations.",
      "Generated drafts need human editing, source verification and original expertise before publication.",
      "AI visibility features, tracked engines and usage limits depend on the current plan.",
      "Content scores are guidance signals; do not write unnaturally or add irrelevant keywords just to increase a score.",
      "Check the current provider terms, integrations and data controls before connecting a production website."
    ],
    "sourceLabel": "Surfer official product and documentation",
    "sourceUrl": "https://surfer.ai/",
    "faq": [
      {
        "question": "Is Surfer AI only an article generator?",
        "answer": "No. Surfer's current product suite also includes content optimization, keyword research, topical planning, content auditing and AI search visibility tracking."
      },
      {
        "question": "Does Surfer guarantee search rankings?",
        "answer": "No. Optimization tools can help structure and improve content, but search rankings and AI citations depend on many factors outside any one tool's control."
      }
    ]
  },
  "openrouter": {
    "overview": "OpenRouter provides a unified API for accessing models from many AI providers. Developers can use one integration to compare and call models for text, image, video, audio and other tasks. Its routing layer can select among providers for a requested model and can account for factors such as price, speed, availability and provider failures.",
    "bestFor": [
      "Building applications that need to switch between multiple model providers",
      "Comparing model availability, pricing and context limits in one catalogue",
      "Routing requests across providers with fallback behavior",
      "Prototyping model-backed products without maintaining a separate integration for every provider"
    ],
    "workflow": [
      "Choose the model or model family that fits the task and inspect its current context and modality support.",
      "Create an API key and follow the official quickstart for the integration style you use.",
      "Set model, provider and routing preferences explicitly when reliability or cost matters.",
      "Log usage and inspect returned model/provider metadata so you can understand how requests were served.",
      "Add budget controls, retries and tests for provider failures before production use."
    ],
    "considerations": [
      "Model availability, pricing and provider support can change; check the live model catalogue before estimating costs.",
      "Different providers may have different latency, rate limits, data policies and model behavior.",
      "A unified API does not remove the need to secure API keys or monitor application usage.",
      "Review the current privacy and data-retention terms for the provider route selected for each request."
    ],
    "sourceLabel": "OpenRouter official platform and routing documentation",
    "sourceUrl": "https://openrouter.ai/"
  },
  "word-spinner": {
    "overview": "Word Spinner is an AI writing assistant with tools for rewriting, humanizing, grammar checking, detecting AI-like text, summarizing, translating and drafting common content such as emails. It is aimed at people who want to revise or reshape existing text as well as create a first draft. Its own product information emphasizes keeping the writer involved in reviewing the result.",
    "bestFor": [
      "Rephrasing a draft while trying to preserve its original meaning",
      "Checking grammar and improving clarity before publication",
      "Summarizing or translating text for a different audience",
      "Creating an initial email or short-form content draft",
      "Exploring alternate wording and tone for marketing or general writing"
    ],
    "workflow": [
      "Start with your own notes or a draft that you have permission to edit.",
      "Choose a specific task such as grammar correction, rephrasing or summarization.",
      "Compare the output with the original to catch changed facts, tone or nuance.",
      "Restore citations and verify any factual statements that were altered during rewriting.",
      "Edit the final text yourself and follow the rules of your school, employer or publisher."
    ],
    "considerations": [
      "A humanizer or AI detector cannot reliably prove who wrote a text or guarantee that it will pass a detector.",
      "Paraphrasing does not remove the need to cite sources or respect copyright.",
      "Review privacy terms before pasting unpublished, confidential or personal material.",
      "Check current free and paid usage limits directly with the provider."
    ],
    "sourceLabel": "Word Spinner official product overview",
    "sourceUrl": "https://word-spinner.com/about"
  },
  "basmo": {
    "overview": "Basmo is a reading companion rather than a general-purpose chatbot. Its product information describes a place to organize books, track reading sessions and keep notes, with AI-assisted features for exploring book ideas and returning to saved passages. Readers can also use supported imports and mobile apps, although exact features can differ by platform and subscription.",
    "bestFor": [
      "Keeping a personal record of books and reading sessions",
      "Saving passages, notes and ideas from books",
      "Returning to important ideas through personal recaps",
      "Exploring a book's themes or deciding what to read next",
      "Building a regular reading habit with simple goals"
    ],
    "workflow": [
      "Add the books you are reading and set a realistic reading goal.",
      "Record sessions and save notes or passages that matter to you.",
      "Use AI-assisted exploration to ask questions about selected ideas or notes.",
      "Check any generated explanation against the original book or your saved passage.",
      "Review the provider's privacy information before sending notes or text to remote AI features."
    ],
    "considerations": [
      "Basmo does not provide a library of full ebooks or licensed audiobooks; it helps organize your reading life and notes.",
      "AI answers can be imperfect, so keep the original passage or source close by.",
      "Basic tracking and advanced AI or audio features may have different plan requirements.",
      "Availability and feature parity can differ between iOS, Android and app versions."
    ],
    "sourceLabel": "Basmo official product and FAQ",
    "sourceUrl": "https://basmo.app/faq/"
  },
  "switchboard-ai": {
    "overview": "Switchboard Canvas is a template-driven image production platform. Teams can design reusable visual templates and generate images through an API by supplying changing text, image and other values. The product is suited to repeatable creative operations such as producing branded assets in multiple sizes, rather than only generating one-off pictures from a text prompt.",
    "bestFor": [
      "Generating batches of branded graphics from reusable templates",
      "Creating multiple image sizes from one API request",
      "Producing localized visuals with translated text",
      "Connecting image production to spreadsheets, Airtable or automation services",
      "Building repeatable image workflows for agencies and content teams"
    ],
    "workflow": [
      "Create a responsive template and define the text, image and layout fields that should change.",
      "Test one output manually and confirm that text, images and dimensions render correctly.",
      "Use the API to provide replacement values and request the required sizes.",
      "Connect the workflow to approved data sources or automation tools only after testing permissions.",
      "Review every output for brand consistency, text overflow and image rights before publishing."
    ],
    "considerations": [
      "Switchboard Canvas is template-led; it is not the same as a free-form text-to-image generator.",
      "API calls, batch sizes, translation and integrations depend on the selected plan.",
      "Template design quality and source assets strongly affect the final output.",
      "Check the current API documentation, pricing and data-handling terms before production use."
    ],
    "sourceLabel": "Switchboard Canvas official image generation API",
    "sourceUrl": "https://www.switchboard.ai/canvas/image-generation-api/"
  },
  "you-com": {
    "overview": "You.com currently presents AI search and inference infrastructure for developers and organizations. Its product suite includes web search, answer, extract, research and finance research APIs, alongside an inference router for calling supported models through a unified interface. This makes the platform relevant to teams building AI applications that need fresh web information or model routing.",
    "bestFor": [
      "Adding real-time web search to an AI application",
      "Extracting content from webpages or PDF URLs",
      "Generating cited answers or multi-step research outputs",
      "Routing model requests through a unified API",
      "Building agent workflows that need web data and inference together"
    ],
    "workflow": [
      "Decide whether the application needs search results, page extraction, a cited answer, research or model inference.",
      "Read the matching API quickstart and choose the response format your application expects.",
      "Create an API key and test a small request with representative queries.",
      "Inspect citations, source freshness, latency and usage costs before scaling.",
      "Set rate limits, logging and data-retention controls for the production workflow."
    ],
    "considerations": [
      "You.com has expanded from a consumer search experience into an API and inference platform; check the current product pages for the exact service you need.",
      "Each API can have different pricing, response formats and usage limits.",
      "Search results and generated answers still require source review for high-stakes use.",
      "Review the provider's security and data-retention options before sending customer or confidential information."
    ],
    "sourceLabel": "You.com official APIs and quickstart",
    "sourceUrl": "https://you.com/docs/quickstart"
  },
  "deepseek": {
    "overview": "DeepSeek offers conversational AI and model services for users and developers. Its official materials describe chat, coding and model APIs, while recent API documentation explains built-in web search, multi-step deep-thinking search, file input and URL reading for supported models. Available models and capabilities change over time, so users should check the official app and documentation rather than rely on old model names.",
    "bestFor": [
      "Asking questions and exploring ideas in the official chat",
      "Getting help with coding and technical explanations",
      "Using supported web search and URL reading in AI conversations",
      "Building applications with DeepSeek model APIs",
      "Providing supported documents or images as context for a task"
    ],
    "workflow": [
      "Use the official DeepSeek chat or developer platform rather than a similarly named third-party service.",
      "Choose the model and interface appropriate for a consumer conversation or API integration.",
      "For research, enable supported search features and inspect the returned sources.",
      "For file-based questions, confirm that the uploaded format is supported and review extracted content.",
      "Test API behavior, costs and safety controls before deploying an application."
    ],
    "considerations": [
      "Model names, API endpoints and supported capabilities are updated; follow current official documentation.",
      "Search and generated answers can still be incomplete or inaccurate; verify important claims.",
      "API tool usage may add costs beyond standard model token charges.",
      "Do not upload sensitive files unless the provider's current privacy and security terms are appropriate."
    ],
    "sourceLabel": "DeepSeek official website and API feature guide",
    "sourceUrl": "https://www.deepseek.com/en/",
    "faq": [
      {
        "question": "Can DeepSeek search the web?",
        "answer": "DeepSeek's official API documentation describes web search and multi-step deep-thinking search for supported models when the relevant tools are enabled. Check the current chat and API documentation for availability."
      },
      {
        "question": "Can developers send files to DeepSeek?",
        "answer": "The official chatbot guide describes file input for supported formats such as PDF, Word, PowerPoint and images. Supported formats and limits should be checked in the current documentation."
      }
    ]
  },
  "prowritingaid": {
    "overview": "ProWritingAid is a writing and editing toolkit for people who want feedback on grammar, clarity, style and longer-form storytelling. Its official feature pages describe grammar and spelling checks, rephrasing, 25-plus writing reports and tools for planning, story critique and manuscript analysis. It is especially relevant to writers who want detailed editorial feedback rather than only a one-click rewrite.",
    "bestFor": [
      "Checking grammar, spelling and punctuation in a draft",
      "Reviewing readability, repetition, sentence structure and style",
      "Exploring alternate phrasings for awkward sentences",
      "Analyzing pacing, characters and structure in longer fiction",
      "Planning and refining manuscripts before publication"
    ],
    "workflow": [
      "Choose the document or chapter you want to review and keep an original copy.",
      "Run focused reports for grammar, readability, repetition or style rather than changing everything at once.",
      "Review each suggestion in context and preserve deliberate voice or terminology.",
      "Use story and manuscript feedback as editorial input, not as an automatic verdict.",
      "Proofread the final draft and check citations, names and facts independently."
    ],
    "considerations": [
      "Automated suggestions can flatten a distinctive voice or change intended meaning; accept edits selectively.",
      "Some reports, integrations and advanced features may depend on the current subscription.",
      "Check supported apps and integrations before choosing it for a particular writing workflow.",
      "Review privacy terms before uploading unpublished manuscripts or client documents."
    ],
    "sourceLabel": "ProWritingAid official features",
    "sourceUrl": "https://prowritingaid.com/features",
    "faq": [
      {
        "question": "What does ProWritingAid check?",
        "answer": "Its official feature list describes grammar, spelling, punctuation, readability, sentence structure, repetition, style and story-level feedback, with more than 25 writing reports."
      },
      {
        "question": "Is ProWritingAid only for fiction writers?",
        "answer": "No. Its tools can support many kinds of writing, although several features are specifically designed for storytellers and long-form manuscripts."
      }
    ]
  },
  "spinbot": {
    "overview": "SpinBot is an online paraphrasing and text-rewriting tool with a grammar checker. Its official pages describe rewriting sentences, paragraphs and longer text, with controls for different rewrite styles and options to leave selected words unchanged. It is designed for quick text revision, but the output still needs careful human editing.",
    "bestFor": [
      "Trying alternative wording for a sentence or paragraph",
      "Improving clarity or shortening a draft",
      "Exploring different phrasing before a manual edit",
      "Checking grammar in short pieces of text",
      "Reworking text that you own or have permission to edit"
    ],
    "workflow": [
      "Paste text that you have written or are authorized to modify.",
      "Choose a rewrite mode and specify words or names that should remain unchanged.",
      "Compare the output with the original to confirm that the meaning has not shifted.",
      "Restore citations and verify quotations, technical terms and factual claims.",
      "Edit the result manually and disclose assistance where required."
    ],
    "considerations": [
      "Paraphrasing does not make copied material original or remove the need to cite sources.",
      "Automated rewrites can introduce errors, awkward wording or changed meaning.",
      "Do not use rewriting to evade academic integrity rules or plagiarism checks.",
      "Check the current free, ad-supported and paid options and text limits on the provider's website."
    ],
    "sourceLabel": "SpinBot official paraphrasing tool",
    "sourceUrl": "https://spinbot.com/paraphrasing-tool",
    "faq": [
      {"question":"Does SpinBot guarantee that rewritten text is plagiarism-free?","answer":"No automated paraphrasing tool can guarantee originality or correct attribution. Check the source, cite material you rely on and edit the result yourself."},
      {"question":"Can SpinBot be used for academic writing?","answer":"Follow your institution's rules. It may help revise your own draft, but it should not be used to disguise copied work or bypass academic-integrity requirements."}
    ]
  },
  "udio": {
    "overview": "Udio is an AI music creation platform where users describe a song idea and generate musical clips. Its help centre explains how to write a prompt, choose a clip length, create variations, extend a track and work with custom lyrics. Supported audio-upload workflows can be used to extend, remix or stylize audio, subject to account eligibility and the provider's rights rules.",
    "bestFor": [
      "Creating early music ideas from a written description",
      "Exploring genres, moods and song concepts",
      "Generating lyric ideas or working with custom lyrics",
      "Extending or refining a generated track",
      "Experimenting with permitted audio uploads and variations"
    ],
    "workflow": [
      "Describe the intended mood, genre, theme and any musical details in a concise prompt.",
      "Generate a short draft and listen before changing several prompt elements at once.",
      "Edit lyrics and regenerate variations until the direction is clear.",
      "Use extension or audio editing features only when they are available to your account.",
      "Keep records of source material and review the current licence before sharing or monetizing a track."
    ],
    "considerations": [
      "Generated music can contain unexpected artifacts or unwanted similarities; listen carefully before release.",
      "Audio upload features may be limited to paid subscribers and require you to own or have rights to the uploaded audio.",
      "Commercial use, distribution and ownership terms can change; read the current Udio terms before publishing.",
      "Do not upload commercial recordings or other copyrighted audio unless you have permission."
    ],
    "sourceLabel": "Udio official creation and audio-upload guides",
    "sourceUrl": "https://help.udio.com/en/articles/10715838-create-your-first-song"
  },
  "subpals": {
    "overview": "SubPals is a YouTube creator resource that combines channel-growth information with free tools for making channel content easier to prepare. Its current site describes a subscribe-link generator and AI-assisted tools for video ideas, scripts, titles and descriptions, outlines, tags and thumbnail text. It also promotes creator collaborations and paid shoutout campaigns, so users should distinguish its free content utilities from its separate growth services.",
    "bestFor": [
      "Creating a YouTube subscribe link for a channel or video",
      "Generating first-draft ideas and outlines for videos",
      "Drafting titles, descriptions, tags and thumbnail text",
      "Preparing content variations for a particular audience or niche",
      "Exploring creator collaboration resources alongside content planning"
    ],
    "workflow": [
      "Use the free subscribe-link tool with your own channel handle or video URL.",
      "Describe your audience and video topic before generating ideas or a script.",
      "Edit generated titles, descriptions and tags to match the actual video.",
      "Check YouTube policies and avoid misleading metadata or engagement tactics.",
      "Evaluate any paid promotion or shoutout offer separately; review terms and do not assume a specific subscriber result."
    ],
    "considerations": [
      "SubPals is a creator-growth resource, not only an AI writing assistant; features and offers on the site may change.",
      "AI-generated scripts and metadata need human review for accuracy, originality and audience fit.",
      "The provider distinguishes creator exposure from guaranteed subscriber numbers; no growth result should be assumed.",
      "Review payment, refund, privacy and platform-policy terms before using paid services."
    ],
    "sourceLabel": "SubPals official creator tools and service information",
    "sourceUrl": "https://www.subpals.com/"
  },
  "digital-first-ai": {
    "overview": "Digital First AI has rebranded to DFIRST AI. The current product presents itself as a creative workspace for brand and marketing teams, bringing research, copy, images, video and website or campaign assets into connected workflows. Its feature pages describe multi-model orchestration, brand-voice guidance, reusable references, real-time research and tools for producing campaign variations. The current product and access model may differ from older Digital First AI listings.",
    "bestFor": [
      "Planning a product launch campaign from source material and brand assets",
      "Creating and adapting marketing copy, images and short videos",
      "Keeping campaign outputs aligned with brand references and voice",
      "Researching trends or competitor information to inform creative work",
      "Coordinating multiple creative deliverables in one workspace"
    ],
    "workflow": [
      "Open the current DFIRST website and confirm the product access available to your account.",
      "Provide a clear campaign brief, target audience, product details and approved brand assets.",
      "Use research and generation tools to develop a small set of concepts.",
      "Review text, visuals and factual claims before approving any output.",
      "Check connected apps, permissions and data controls before linking company information."
    ],
    "considerations": [
      "Digital First AI is now presented as DFIRST AI; older links or product descriptions may be outdated.",
      "The current website indicates that some workspace access is being introduced through a waitlist.",
      "Generated campaign assets and research require human review for accuracy, brand safety and rights.",
      "Review current pricing, availability, integrations and privacy terms directly with DFIRST."
    ],
    "sourceLabel": "DFIRST official product and feature overview",
    "sourceUrl": "https://dfirst.ai/"
  },
};

Object.assign(curatedToolProfiles, {
  "chatpdf": {
    seoTitle: "ChatPDF — AI PDF Chat, Summary & Citations | Anjal AI",
    overview: "ChatPDF is a document assistant for asking questions about PDFs and other supported files. It can summarize papers and reports, explain sections, translate document content and return answers with references that link back to the relevant pages. Users can organize files into folders and chat across multiple documents in one conversation, which is useful for comparing research papers, contracts or study materials. A side-by-side reader keeps the document visible while the conversation runs. ChatPDF is designed to help people navigate source material faster, not to replace reading or professional review of important documents.",
    bestFor: ["Asking questions about research papers, reports and textbooks", "Summarizing long PDFs and locating specific details", "Comparing information across multiple documents in a folder", "Translating document content and asking questions in different languages", "Checking AI answers against linked page references"],
    workflow: ["Upload a document or create a folder for a related set of files.", "Ask a focused question and specify the section, date range or evidence you need.", "Use the page references to open the original text and verify the answer.", "For comparisons, ask the same structured questions across the documents and keep each source distinct.", "Remove files you no longer need and review sharing permissions before creating shared links."],
    considerations: ["Citations make checking easier but do not guarantee that a summary captures every qualification or exception.", "Tables, scanned pages, complex layouts and poor-quality OCR can affect extraction accuracy.", "Free and paid plans have different daily document, storage and usage allowances.", "Uploaded files may contain sensitive information; review the service's current privacy and deletion controls before uploading confidential documents."],
    sourceLabel: "ChatPDF official product and FAQ",
    sourceUrl: "https://www.chatpdf.com/",
    faq: [
      { question: "Can ChatPDF answer questions across multiple PDFs?", answer: "Yes. ChatPDF describes folders and multi-file chats that let users ask questions across a set of uploaded documents." },
      { question: "Does ChatPDF show citations?", answer: "Yes. Its product information describes references that link answers to relevant parts of the source document so users can verify the context." }
    ]
  },
  "askyourpdf": {
    seoTitle: "AskYourPDF — AI PDF Reader & Document Chat | Anjal AI",
    overview: "AskYourPDF is an AI document platform for reading, summarizing and extracting information from PDFs and other supported file types. Its document chat returns answers with references to the relevant page or paragraph, while multi-document workflows let users compare files and build a searchable knowledge base. The platform also describes OCR for scanned PDFs, table and chart analysis, data extraction, multilingual chat, PDF form filling, podcast-style audio and a website chatbot trained on approved content. Developer APIs and integrations extend document workflows into other applications.",
    bestFor: ["Getting cited answers from research papers, contracts and business documents", "Summarizing and comparing multiple PDFs in a knowledge base", "Extracting structured information from tables, charts and reports", "Reading scanned documents with OCR on supported plans", "Building document chatbots or PDF workflows into other applications"],
    workflow: ["Upload a document or connect an approved knowledge base of related files.", "Ask a precise question and specify whether you need a summary, clause, table or structured fields.", "Open the returned citations and confirm that each answer matches the source page.", "For extraction, define the output fields and check the results before exporting to a spreadsheet or database.", "For website or API use, test permissions, access boundaries and failure cases with non-sensitive sample files."],
    considerations: ["OCR, page limits, multi-document chat and advanced extraction depend on the selected plan.", "AI may miss footnotes, table structure, legal qualifications or context across distant pages; verify critical results.", "Document uploads and website chatbots can expose private material if access rules are misconfigured.", "Do not treat a generated legal, financial or academic summary as professional advice or a substitute for the original source."],
    sourceLabel: "AskYourPDF official product and document-chat guide",
    sourceUrl: "https://askyourpdf.com/",
    faq: [
      { question: "Can AskYourPDF chat with more than one document?", answer: "Yes. AskYourPDF describes multi-document chat and knowledge bases for asking questions across a group of uploaded files." },
      { question: "Does AskYourPDF support scanned PDFs?", answer: "It describes OCR support for scanned PDFs on eligible plans. Check the current plan limits and supported file sizes before uploading." }
    ]
  },
  "humata": {
    seoTitle: "Humata AI — PDF Assistant & Knowledge Base | Anjal AI",
    overview: "Humata is an AI assistant for asking questions across uploaded files and shared document libraries. It is positioned as a knowledge-base tool for teams that need to summarize technical papers, compare documents and find answers without manually searching every page. Humata highlights cited links into source files, document embedding for websites and shared team spaces with access controls. This makes it useful for research groups and organizations that want a conversational layer over manuals, reports, policies or other internal documents.",
    bestFor: ["Summarizing and comparing research papers and long reports", "Finding answers across a collection of uploaded documents", "Creating a searchable knowledge base for a team", "Embedding document Q&A on an internal or public webpage", "Tracing answers back to citations in source files"],
    workflow: ["Create a workspace and upload a small, clearly organized set of documents.", "Ask a question that specifies the information you need and the source scope.", "Open the citations and compare the response with the original document text.", "Organize files into folders or team spaces and configure access for the intended users.", "For embedded or shared knowledge bases, test what unauthenticated and different-role users can access."],
    considerations: ["Document answers can omit caveats or misread tables, charts and scanned pages; verify important details in the source.", "OCR, response personalization, permissions and other team features vary by plan.", "Shared libraries and embeds need careful access control to prevent unintended disclosure.", "Humata's page and answer allowances are plan-dependent and may change."],
    sourceLabel: "Humata official product and security overview",
    sourceUrl: "https://www.humata.ai/",
    faq: [
      { question: "What is Humata AI used for?", answer: "Humata helps users ask questions across uploaded documents, summarize files, compare information and retrieve answers with source citations." },
      { question: "Can teams share a Humata knowledge base?", answer: "Humata describes shared team document spaces and embedded document Q&A. Available access controls depend on the plan and workspace configuration." }
    ]
  },
  "pdf-ai": {
    seoTitle: "PDF.ai — AI PDF Chat, Extraction & Document API | Anjal AI",
    overview: "PDF.ai is a document AI platform for chatting with PDFs, summarizing files and building document-processing workflows. Its consumer interface lets users ask questions about uploaded files and, in supported workflows, query multiple documents together. For developers, PDF.ai documents APIs for parsing documents into Markdown or JSON, extracting structured fields, splitting files and asking questions against parsed documents. This makes it useful for both individual document review and applications that need to turn PDF content into searchable or structured data.",
    bestFor: ["Asking questions and generating summaries from PDF files", "Searching across a collection of uploaded documents", "Extracting structured fields into JSON for downstream workflows", "Parsing PDFs with OCR and supported visual-model processing", "Integrating document Q&A into a product through APIs"],
    workflow: ["Choose the browser interface for a one-off document or the API for an automated workflow.", "Upload the PDF and confirm that the correct document ID or parsed document set is being queried.", "Ask a focused question and request page references or structured fields where available.", "For extraction, define a schema and validate returned values against the original pages.", "Delete test documents and API credentials when no longer required, and review the service's data-handling terms."],
    considerations: ["PDF.ai has separate API generations and endpoints; follow the documentation for the version being integrated.", "OCR and structured extraction can fail on low-quality scans, unusual tables or handwritten content.", "API credits, model choices, file limits and chat features can differ from the browser plan.", "Treat extracted legal, financial or compliance fields as drafts until checked against the original document."],
    sourceLabel: "PDF.ai official product and API documentation",
    sourceUrl: "https://api.pdf.ai/",
    faq: [
      { question: "Can PDF.ai extract structured data from a PDF?", answer: "Yes. Its API documentation describes parsing, extraction, splitting and question-answering endpoints, including structured JSON extraction." },
      { question: "Can developers integrate PDF.ai into an application?", answer: "Yes. PDF.ai provides APIs for uploading, parsing and querying documents, with version-specific endpoints and usage limits." }
    ]
  },
  "documind": {
    seoTitle: "Documind — AI PDF Chat & Document Knowledge Base | Anjal AI",
    overview: "Documind is an AI document assistant for chatting with PDFs, reviewing multiple files and turning document collections into a searchable knowledge base. Its product information describes cited answers, bulk document uploads, multilingual chat, summaries and content generation, plus the ability to create a chatbot trained on selected documents and share or embed it on a website. The Documind site also offers focused document utilities such as PDF summaries, question generation, notes and text extraction. This makes it useful for students, researchers and teams that need to retrieve information from their own files.",
    bestFor: ["Asking questions across multiple PDFs and document collections", "Summarizing reports, textbooks and research papers", "Creating a chatbot trained on a selected set of documents", "Generating structured notes and questions from study materials", "Embedding document-based answers into a website or team workflow"],
    workflow: ["Upload a small, relevant set of documents and organize them by topic or audience.", "Ask questions that make the expected source and output format clear.", "Check citations and compare the response with the original document pages.", "If creating a shared chatbot, test the public link and embed permissions before publishing.", "For study notes or question generation, review factual accuracy and adjust the output to match the learning objective."],
    considerations: ["Document Q&A and summaries can miss nuance, table details or qualifications; verify important claims.", "Bulk upload, API access, file-size limits and team features depend on the plan.", "A public chatbot may reveal information from every document included in its knowledge base; keep sensitive files separate.", "The Documind name is also used by other services; confirm the official domain and product before signing in or uploading files."],
    sourceLabel: "Documind official product overview",
    sourceUrl: "https://www.documind.chat/",
    faq: [
      { question: "Can Documind chat with multiple PDFs?", answer: "Yes. Documind describes bulk document upload and conversations across several PDFs, with answers linked to source documents." },
      { question: "Can I create a chatbot from my documents?", answer: "Documind describes creating a shareable chatbot trained on uploaded documents, with options to embed it on a website." }
    ]
  },
  "doclime": {
    seoTitle: "DocLime — AI PDF Chat & Document Research | Anjal AI",
    overview: "DocLime is an AI document assistant focused on chatting with PDFs and understanding research papers, textbooks and legal documents. Its product information describes a conversational interface that analyzes uploaded files, answers questions with references and keeps the source document available in a PDF viewer. Users can navigate pages, search content and take notes while working through a document. This makes DocLime useful for readers who want to ask follow-up questions about a source while retaining a place to review and organize their own notes.",
    bestFor: ["Asking questions about research papers, textbooks and legal documents", "Finding specific facts or explanations inside a PDF", "Reading and navigating documents alongside an AI chat", "Summarizing source material before deeper manual review", "Taking notes while researching a long document"],
    workflow: ["Upload the PDF you want to understand and wait for the document analysis to finish.", "Ask one specific question at a time, naming the chapter, topic or concept if known.", "Check the answer against the relevant page in the PDF viewer.", "Use the notes area to record verified facts, questions and quotations with page references.", "Review the original document before using extracted information in an assignment, report or decision."],
    considerations: ["AI summaries may omit exceptions, footnotes or important context; verify against the original PDF.", "Scanned pages, complex tables and low-quality source files can reduce extraction accuracy.", "The product's current feature set, upload limits and availability should be checked on its official site.", "Avoid uploading confidential or copyrighted documents unless you have permission and understand the provider's data policies."],
    sourceLabel: "DocLime official product overview",
    sourceUrl: "https://doclime.com/",
    faq: [
      { question: "What does DocLime do?", answer: "DocLime provides an AI chat interface for asking questions about uploaded PDFs, with a document viewer and note-taking workflow." },
      { question: "Can DocLime help with research papers?", answer: "Yes. Its product information specifically describes using the service to understand research papers and other long documents through contextual Q&A." }
    ]
  },
  "descript": {
    seoTitle: "Descript — AI Audio & Video Editor | Anjal AI",
    overview: "Descript is an audio and video production editor built around transcription and text-based editing. Creators can record a screen, camera or remote interview, import existing media, edit the transcript to change the recording, remove filler words and retakes, improve speech, add captions and export clips. Its Underlord AI co-editor can help with editing tasks, while tools for voice regeneration, studio sound and visual refinement support a broader production workflow. Descript is useful for podcasts, interviews, tutorials, screen recordings and social clips where spoken content is the main structure.",
    bestFor: ["Editing podcast and interview recordings by changing the transcript", "Recording screen, camera and remote guests in one workflow", "Removing filler words, retakes and unwanted pauses", "Cleaning speech and preparing captions or short clips", "Repurposing long recordings into tutorials and social video"],
    workflow: ["Record or import the audio and video files, then allow Descript to transcribe the media.", "Review the transcript and correct speaker names, technical terms and punctuation before editing.", "Edit by selecting and deleting text, then inspect the timeline for visual or audio transitions that need manual adjustment.", "Use speech cleanup and AI editing tools selectively, then review the result with headphones.", "Create captions, clips and exports in the format required by the publishing platform."],
    considerations: ["Automatic transcripts can mishear names, accents and technical vocabulary; proofread before publishing.", "AI voice regeneration and voice cloning should only be used with appropriate consent and rights.", "Advanced recording, export, AI and transcription allowances vary by plan.", "Keep original media and review the full export for jump cuts, sync problems and unwanted edits."],
    sourceLabel: "Descript official features overview",
    sourceUrl: "https://www.descript.com/features",
    faq: [
      { question: "What is Descript used for?", answer: "Descript is used to record, transcribe and edit audio or video, with text-based editing, speech cleanup, captions and AI-assisted production tools." },
      { question: "Can I edit a video by editing its transcript?", answer: "Yes. Descript's text-based editor links transcript changes to the media timeline, so removing or moving words can edit the corresponding recording." }
    ]
  },
  "adobe-podcast": {
    seoTitle: "Adobe Podcast — AI Speech Enhancement & Editing | Anjal AI",
    overview: "Adobe Podcast is a browser-based audio recording and editing workspace for podcasts, voiceovers and spoken-word content. Its tools include Enhance Speech for reducing background noise and echo, Studio for recording solo or remote guests, transcription-based editing, captioning and audio or video transcription. Adobe also provides microphone checks and podcast-ready music and sound assets. Because it is designed around speech, Adobe Podcast is particularly useful for improving recordings and editing spoken content without needing a traditional desktop audio workstation.",
    bestFor: ["Cleaning background noise and echo from voice recordings", "Recording podcasts with remote guests and separate audio tracks", "Editing spoken audio by working from its transcript", "Transcribing audio or video and creating captions", "Preparing voiceovers, class lectures and audio newsletters"],
    workflow: ["Record in Adobe Podcast Studio or upload an existing supported audio file.", "For noisy recordings, run Enhance Speech and compare the result with the original.", "Use the transcript to locate sections, remove unwanted passages and organize the story.", "Check speaker levels, pronunciation, pacing and any artifacts introduced by enhancement.", "Export the finished audio or video captions and keep the original recording for future edits."],
    considerations: ["Enhance Speech improves audio quality but does not translate speech or repair every recording problem.", "Results depend on source clarity, background noise and speaker audibility; heavy processing can sound unnatural.", "Free and Premium plans have different file-size, duration, daily processing and export limits.", "Obtain consent from remote guests before recording and follow the privacy rules that apply to the content."],
    sourceLabel: "Adobe Podcast official feature overview and FAQ",
    sourceUrl: "https://podcast.adobe.com/feature/enhance",
    faq: [
      { question: "What does Adobe Podcast Enhance Speech do?", answer: "Enhance Speech uses AI to reduce background noise and echo and make spoken recordings sound clearer. Results depend on the original recording." },
      { question: "Can Adobe Podcast record remote guests?", answer: "Yes. Adobe Podcast Studio supports recording with remote guests and captures individual audio tracks for editing." }
    ]
  },
  "aiva": {
    seoTitle: "AIVA — AI Music Composer & Licensing | Anjal AI",
    overview: "AIVA is an AI music composition assistant for generating original instrumental and soundtrack ideas. The platform offers more than 250 styles, customizable style models, audio or MIDI influence uploads, editing tools and downloads in supported formats. AIVA is designed for creators who want to generate compositions and then refine them for games, videos, films, streams or other projects. Licensing is an important part of the workflow: the rights and permitted uses of a composition depend on the plan under which it was created and downloaded.",
    bestFor: ["Generating original music and soundtrack concepts in different styles", "Creating background compositions for video, games and presentations", "Using audio or MIDI references to influence a new composition", "Editing and exporting music in supported audio or MIDI formats", "Exploring licensing options for monetized or commercial music projects"],
    workflow: ["Choose a musical style or create a custom style model that fits the project.", "Generate a few compositions, then refine the strongest idea using the available editing controls.", "Use audio or MIDI influence when you need the composition to follow a particular reference.", "Before downloading, confirm which license applies to that specific composition and intended use.", "Save the license record and export the required format for the production workflow."],
    considerations: ["AIVA's free, Standard and Pro plans grant different rights; do not assume every plan includes commercial use or copyright ownership.", "The applicable license depends on the plan active when the composition is downloaded.", "Generated music may need arrangement, mixing and mastering before professional release.", "Check current plan limits, download formats and enterprise terms before building a commercial workflow."],
    sourceLabel: "AIVA official music generator and licensing terms",
    sourceUrl: "https://www.aiva.ai/",
    faq: [
      { question: "Can AIVA generate original music?", answer: "Yes. AIVA generates music in many styles and lets users customize, edit and download compositions in supported formats." },
      { question: "Do I own the copyright to AIVA music?", answer: "Not on every plan. AIVA states that copyright and permitted use depend on the subscription license, with full copyright available under its Pro plan for eligible users." }
    ]
  },
  "mubert": {
    seoTitle: "Mubert — AI Music Generator & Streaming API | Anjal AI",
    overview: "Mubert is an AI music platform for generating and streaming soundtracks for creators, apps and digital products. Its creator tools can produce music from prompts and creative settings such as mood, genre or activity, while the Mubert API lets developers generate tracks, loops and adaptive streams inside apps, games, video editors and UGC workflows. The API documentation describes text-to-music and image-to-music generation, live streaming and options for sub-licensing. Mubert has separate creator and developer offerings, and the license required depends on where and how the generated music will be used.",
    bestFor: ["Generating background music for videos, podcasts and social content", "Creating soundtracks based on prompts, moods, genres or activities", "Adding on-demand music generation to apps and games", "Streaming adaptive background music in live or interactive products", "Building music workflows for creator platforms and video editors"],
    workflow: ["Choose the creator generator or API based on whether you need a track for your own content or music inside a product.", "Describe the intended mood, genre, activity, tempo and duration.", "Generate a preview and listen for fit, transitions and suitability before downloading or streaming.", "Read the relevant license for the exact use case, especially ads, client work, apps or user-generated content.", "For API use, test authentication, generation limits, playback and licensing behavior before scaling."],
    considerations: ["Mubert's creator subscriptions, API plans and licensing scopes are not interchangeable.", "Some free or entry-level uses may be non-commercial or require attribution; verify the current license before publishing.", "Commercial advertising, apps, client work and sub-licensing may require a different plan or agreement.", "Generated music should be reviewed for fit, looping artifacts and rights requirements in the final distribution channel."],
    sourceLabel: "Mubert official creator and API overview",
    sourceUrl: "https://mubert.com/api",
    faq: [
      { question: "Can Mubert generate music from a text prompt?", answer: "Yes. Mubert describes text-to-music generation, along with image, mood, genre and other controls in supported creator and API workflows." },
      { question: "Can developers use Mubert in an app?", answer: "Yes. Mubert offers an API for generating tracks and streaming music inside apps, games, creator tools and other products. Licensing and usage limits depend on the plan." }
    ]
  },
  "soundraw": {
    seoTitle: "SOUNDRAW — AI Music Generator & Creator License | Anjal AI",
    overview: "SOUNDRAW is an AI music generator for creating customizable background tracks and beats. Users can choose a genre and mood, generate options, adjust sections and intensity, and download music for video, social, streaming and other creative projects. SOUNDRAW also offers artist-focused plans and, on eligible tiers, separate stems for further editing in a digital audio workstation. Its license distinguishes background music use from releasing modified songs on streaming services, so creators should select the plan that matches their intended distribution.",
    bestFor: ["Generating background music for YouTube videos and social content", "Creating tracks by genre, mood and intensity", "Editing song sections and adjusting musical energy", "Downloading stems for further work in a DAW on supported plans", "Preparing music for commercial projects under the correct license"],
    workflow: ["Describe the mood and role of the music, then select a genre or blend of styles.", "Generate several versions and adjust sections, intensity and arrangement to fit the video or project.", "Preview the full track in context and make sure its duration and transitions fit the edit.", "Check whether the Creator or Artist license matches your use, especially for streaming-service distribution.", "Download the track or supported stems and keep the license details with the project."],
    considerations: ["Commercial use is tied to the plan and license terms; the Creator and Artist plans cover different use cases.", "SOUNDRAW's license states that streaming-service distribution requires modifying the beat and making the final song clearly different.", "Do not register unmodified tracks in content identification systems or resell them as stock music.", "Plan features such as stems, downloads and distribution rights can change; confirm current terms before release."],
    sourceLabel: "SOUNDRAW official generator and license guide",
    sourceUrl: "https://soundraw.io/license",
    faq: [
      { question: "Can I use SOUNDRAW music in monetized videos?", answer: "SOUNDRAW says paid Creator and Artist plans allow commercial use in covered projects. Check the license for the exact platform and content type." },
      { question: "Can I release SOUNDRAW music on Spotify?", answer: "SOUNDRAW's Artist license allows distribution only when you modify the beat, for example by adding vocals or instruments, and the final song is clearly different from the downloaded track." }
    ]
  },
  "lalal-ai": {
    seoTitle: "LALAL.AI — AI Stem Splitter & Vocal Remover | Anjal AI",
    overview: "LALAL.AI is an AI audio-separation service for isolating vocals, instruments and other sound elements from mixed recordings. Its Stem Splitter can extract parts such as vocals, instrumental, drums, bass, piano, guitars, synthesizer and other supported stems. Separate tools target speech cleanup, background-noise removal, voice changing and echo reduction. Users can upload supported audio or video, preview separated stems and choose processing settings before downloading. LALAL.AI is useful for remix preparation, karaoke, music practice, editing and cleaning spoken recordings, although separation quality depends on the source mix.",
    bestFor: ["Removing vocals to create instrumental or karaoke versions", "Extracting drums, bass, piano, guitar and other instrument stems", "Preparing tracks for remixes, practice and audio editing", "Separating speech from background noise or music", "Cleaning echo and unwanted artifacts from voice recordings"],
    workflow: ["Choose the correct workflow: music stem separation for songs or voice cleaning for speech recordings.", "Upload a supported audio or video file and select the stem or elements you want to extract.", "Listen to the preview and compare processing modes when available.", "Adjust settings to balance stem isolation against leakage or loss of source detail.", "Process and download the results, then inspect them in your audio editor before final use."],
    considerations: ["No stem-separation model can perfectly separate every mixed recording; some bleed or artifacts may remain.", "Use the speech-cleaning workflow for spoken audio rather than a music-vocal stem model.", "Processing limits, file sizes, supported formats and available stems depend on the plan and selected tool.", "Only upload audio and video that you own or are authorized to process; separation does not grant rights to reuse copyrighted material."],
    sourceLabel: "LALAL.AI official stem splitter and API documentation",
    sourceUrl: "https://www.lalal.ai/stem-splitter/",
    faq: [
      { question: "Can LALAL.AI remove vocals from a song?", answer: "Yes. Its Stem Splitter can separate vocals and instrumental audio, and can also extract supported instrument stems." },
      { question: "Can LALAL.AI clean speech recordings?", answer: "Yes. LALAL.AI provides voice-cleaning tools for separating speech from background noise and reducing echo, with results depending on the source recording." }
    ]
  },
  "perplexity": {
    seoTitle: "Perplexity AI — Cited Search & Research | Anjal AI",
    overview: "Perplexity is an AI answer and research platform that searches the open web and returns synthesized answers with linked citations. Its current product suite includes Search for source-backed answers, Pro Search for more involved research, Deep Research for structured reports, Computer for multi-step work across files and connected apps, Comet for AI-assisted browsing, and APIs for developers. Perplexity can route work across multiple models and connect web information with files or approved app context. It is useful when a user wants to move from a question to evidence, analysis or a finished research deliverable in one workflow.",
    bestFor: ["Getting concise answers grounded in current web sources", "Researching complex topics with Pro Search or Deep Research", "Comparing evidence and checking claims through inline citations", "Working with uploaded files and connected sources in supported plans", "Delegating multi-step research and deliverable creation to Computer", "Adding search-grounded answers to applications through Perplexity APIs"],
    workflow: ["Start with a focused question and state the time period, geography or source types that matter.", "Use standard Search for a quick answer, Pro Search for deeper investigation or Deep Research for a structured report.", "Open the cited sources and check whether they directly support each important claim.", "For file or app-based work, connect only the sources needed and review access permissions.", "For a decision or published report, record the search scope, verify key facts independently and note gaps or conflicting evidence."],
    considerations: ["Citations make answers easier to check but do not guarantee that every claim is supported or interpreted correctly.", "Search depth, model choices, file uploads, Computer features and usage limits depend on the product and plan.", "Connected apps and agent workflows may access or modify user data; review permissions and action approvals.", "Search results can be incomplete, outdated or biased toward available web sources, so verify important information.", "API model availability, rate limits and billing differ from the consumer search experience."],
    sourceLabel: "Perplexity official product overview and help center",
    sourceUrl: "https://www.perplexity.ai/hub",
    faq: [
      { question: "What is Perplexity AI?", answer: "Perplexity is an AI answer engine that searches the web and produces concise responses with citations linking to source material." },
      { question: "Does Perplexity provide sources?", answer: "Yes. Perplexity describes inline citations and links to the sources used for its answers. Users should open those sources and verify important claims." },
      { question: "What is the difference between Search and Deep Research?", answer: "Search is suited to focused questions and cited answers. Deep Research breaks a complex question into subtasks, searches many sources and produces a structured report." },
      { question: "What is Perplexity Computer?", answer: "Computer is Perplexity's agentic workspace for multi-step research and tasks involving the web, files and connected apps. Access and connectors depend on the account." }
    ]
  },
  "google-veo": {
    seoTitle: "Google Veo — AI Video Generation with Audio | Anjal AI",
    overview: "Google Veo is Google's generative video model family, available through creative experiences such as Google Flow and Gemini as well as supported developer platforms. Google's current Veo materials describe text-to-video and image-to-video generation, synchronized audio and video, realistic motion and physics, and creative controls for shaping scenes. Flow provides a workspace for assembling clips and stories, while model and feature availability can differ across subscriptions and interfaces. Veo is best understood as a model family accessed through Google's products, not as one standalone editing application.",
    bestFor: ["Generating short video clips from text descriptions or reference images", "Creating cinematic scenes with synchronized audio where supported", "Developing storyboards and multi-clip creative sequences in Google Flow", "Exploring visual concepts for advertising, social content and filmmaking", "Integrating supported Veo capabilities into applications through Google developer services"],
    workflow: ["Choose the surface that fits the task: Gemini for accessible creation, Flow for scene-based creative work or a developer platform for integration.", "Check the active Veo model and the current supported features before writing the prompt.", "Describe the subject, action, setting, camera movement, lighting, audio and desired aspect ratio.", "Use reference frames or ingredients when available and keep a consistent visual brief across clips.", "Review motion, faces, text, sound and continuity, then confirm usage rights and current plan limits before publishing."],
    considerations: ["Veo capabilities differ by model version and product surface; do not assume every interface exposes every feature.", "Generation credits, resolution, clip duration and access depend on subscription and current availability.", "AI-generated video can contain visual, motion or audio artifacts that need editing.", "Check the current Google product terms and content policies before using outputs commercially."],
    sourceLabel: "Google DeepMind official Veo model overview",
    sourceUrl: "https://deepmind.google/models/veo/",
    faq: [
      { question: "What is Google Veo used for?", answer: "Veo generates video from text and image inputs, with supported versions offering audio-video generation and creative controls for short-form scenes." },
      { question: "Where can I use Google Veo?", answer: "Google lists Veo in products including Gemini and Google Flow, with developer access through supported Google platforms. Exact features depend on the surface and plan." }
    ]
  },
  "heygen": {
    seoTitle: "HeyGen — AI Avatar Videos & Video Translation | Anjal AI",
    overview: "HeyGen is an AI video platform focused on presenter-style videos, digital avatars and multilingual localization. Users can create a video from a script by choosing an avatar, voice and language, or use a personal avatar built from approved reference footage. HeyGen also offers video translation and dubbing workflows that aim to preserve the speaker's voice characteristics and synchronize translated speech with lip movement. These tools are used for explainers, product demonstrations, training, marketing and localized communications where a presenter-led format is useful.",
    bestFor: ["Creating presenter-led explainer and training videos from scripts", "Producing product demos and marketing videos with AI avatars", "Translating existing videos into other languages with dubbing and lip-sync", "Creating a reusable personal avatar with the required consent process", "Producing localized content for international audiences"],
    workflow: ["Choose a stock avatar, approved personal avatar or video-translation workflow.", "Write and proofread the script, including pronunciation notes for names and technical terms.", "Select the target language, voice and visual layout, then preview timing and lip synchronization.", "Apply brand elements and edit captions, scenes and transitions before rendering.", "Obtain permission for every person's likeness and voice, and verify translations before publishing."],
    considerations: ["Avatar creation and voice cloning involve likeness and voice data; use only material you have permission to submit.", "Lip-sync and translation can mispronounce names or alter meaning, so native-language review is important.", "Language counts, video duration, avatar access and generation limits vary by plan.", "Review platform terms and disclosure requirements when publishing synthetic presenters or translated footage."],
    sourceLabel: "HeyGen official product overview",
    sourceUrl: "https://www.heygen.com/",
    faq: [
      { question: "Can HeyGen translate an existing video?", answer: "Yes. HeyGen describes video translation with voice preservation and synchronized lip movements across supported languages and dialects." },
      { question: "Can I create a video using an AI avatar?", answer: "Yes. You can select an available avatar, add a script and voice, then customize the visuals. Personal avatars require the platform's identity and consent steps." }
    ]
  },
  "synthesia": {
    seoTitle: "Synthesia — AI Avatar Video & Training Platform | Anjal AI",
    overview: "Synthesia is an AI video platform designed for business communications, training and learning content. Users can turn a script into a presenter-led video using stock or custom avatars, voiceovers, scenes and branded templates. The platform also supports localization, AI dubbing, voice cloning, collaboration and video analytics. Its API options extend video creation and localization into automated workflows, which can help teams produce consistent training or internal communications at scale. Synthesia is oriented toward structured business video rather than open-ended cinematic scene generation.",
    bestFor: ["Creating employee training and onboarding videos", "Producing product explainers and internal communications", "Building presenter-led videos from scripts and templates", "Localizing business videos into multiple languages", "Automating video creation through supported APIs and integrations"],
    workflow: ["Start with a script or outline and divide it into short, clear scenes.", "Choose a stock, customizable or properly consented personal avatar.", "Select a voice and language, then add brand colors, fonts, logos and visual assets.", "Preview pronunciation, pacing, captions and scene transitions before rendering.", "For recurring production, test templates and API workflows with a small batch before scaling."],
    considerations: ["Avatar realism, language availability, video limits and API access depend on the plan.", "Personal avatars and voice cloning require consent and should not imitate someone without authorization.", "AI voiceovers and translations need human review for pronunciation, tone and factual accuracy.", "Use appropriate disclosure and organizational approval when videos represent a real person or employer."],
    sourceLabel: "Synthesia official features and API documentation",
    sourceUrl: "https://www.synthesia.io/features",
    faq: [
      { question: "What is Synthesia best for?", answer: "Synthesia focuses on business video production, including training, onboarding, explainers and localized presenter-led communications." },
      { question: "Can Synthesia create videos automatically through an API?", answer: "Yes. Its developer documentation describes APIs for video generation, localization, uploads and interactive avatars, with access varying by plan." }
    ]
  },
  "pika": {
    seoTitle: "Pika AI — Video Generator & Creative Studio | Anjal AI",
    overview: "Pika is an AI creative platform for generating and editing videos, images and sound. Its workspace combines Video Studio with focused apps for extending footage, changing colors and lighting, editing images, creating product shots and building reusable characters. Pika also offers model and app choices for workflows such as text-to-video, image-to-video, keyframe animation, effects and soundtrack generation. The platform has expanded beyond a single video model, so users should select the specific app and model that match the intended result.",
    bestFor: ["Creating short social videos from prompts or reference images", "Animating between still images with ordered keyframes", "Applying creative effects or modifying objects in existing clips", "Building reusable characters and product visuals", "Adding generated sound, speech or music to a video workflow"],
    workflow: ["Choose Video Studio or a focused app such as Pikaframes, Extend Video, Color Grade or Pika Soundtrack.", "Add a concise prompt and upload only reference media you have rights to use.", "Select a model and inspect its supported duration, resolution and credit cost.", "Generate a draft, then refine motion, timing, visual consistency and sound in the relevant tools.", "Review the final clip and confirm the subscription's commercial-use terms before using it for a client or business."],
    considerations: ["Pika offers multiple apps and models; generation limits and supported inputs differ by workflow.", "Commercial use depends on the selected subscription and model terms; free access may have different rights.", "Generated motion, text, faces and transitions can contain artifacts and should be reviewed.", "Do not upload copyrighted, confidential or identifiable material unless you have the necessary rights and consent."],
    sourceLabel: "Pika official creative platform and help center",
    sourceUrl: "https://pika.art/",
    faq: [
      { question: "What can Pika create?", answer: "Pika describes tools for generating and editing videos, images and sound, including short clips, multi-shot videos, effects, character assets and product visuals." },
      { question: "Can Pika animate between images?", answer: "Yes. Its Pikaframes workflow uses two to five ordered still images and a prompt to guide the motion between keyframes." }
    ]
  },
  "kling-ai": {
    seoTitle: "Kling AI — Video Generator & Motion Control Tools | Anjal AI",
    overview: "Kling AI is a generative media platform for creating and editing videos and images. Its current creative workspace includes text-to-video, image-to-video, reference-guided generation, motion control, avatars, lip-sync, image editing and video-to-audio tools. Kling's newer model guides describe multi-reference workflows, keyframe control and longer generated clips, while the exact resolution, duration and audio options depend on the selected model and account. The platform is useful for creators who want more control over characters, motion and shot continuity than a simple text prompt can provide.",
    bestFor: ["Generating video clips from text prompts or still images", "Guiding character appearance and motion with reference assets", "Directing camera movement and keyframes for story scenes", "Creating talking avatars and lip-synced clips", "Editing, extending or adding audio to generated footage"],
    workflow: ["Choose the current video model and generation mode that match the task.", "Write a shot brief covering subject, action, camera movement, scene and style.", "Add reference images, video, voice or keyframes when the workflow supports them.", "Generate a short draft and inspect motion, identity consistency, timing and sound.", "Refine the shot and verify resolution, duration, credit cost and usage terms before final export."],
    considerations: ["Model versions and capabilities change; check the current user guide rather than relying on older tutorials.", "Duration, resolution, reference limits and audio features vary by model and plan.", "Complex motion and multi-reference generation may still produce continuity or anatomy errors.", "Only upload reference media you own or are authorized to use, especially faces and voices."],
    sourceLabel: "Kling AI official user guide and model overview",
    sourceUrl: "https://kling.ai/quickstart",
    faq: [
      { question: "Can Kling AI generate video from an image?", answer: "Yes. Kling documents image-to-video generation alongside text-to-video and reference-based workflows." },
      { question: "Does Kling AI support motion control?", answer: "Yes. Kling's official product and guide pages describe motion-control features for directing character actions and poses, with availability depending on the model." }
    ]
  },
  "luma-dream-machine": {
    seoTitle: "Luma AI — Ray Video Generation & Editing | Anjal AI",
    overview: "Luma is a multimodal creative platform whose current video model family is Ray. Luma's official product information identifies Ray3.2 as its current video model and describes text-to-video, image-to-video, video modification and reframing workflows. Ray3.2 adds multi-keyframe direction, motion and performance tracking, and production-oriented HDR and EXR outputs for professional post-production. The consumer creative workspace and developer API provide different ways to access the models, with credits and available features varying by product and plan. Dream Machine is an older product name and should not be confused with the current Ray model family.",
    bestFor: ["Creating directed video clips from text or image references", "Controlling action and camera progression with multiple keyframes", "Modifying existing footage while retaining parts of the original performance", "Reframing clips for different aspect ratios and delivery formats", "Producing HDR and EXR assets for professional color grading and VFX pipelines"],
    workflow: ["Open the current Luma creative workspace or API and choose the Ray model available to your account.", "Plan the shot with a clear action, camera direction, subject continuity and desired ending.", "Use keyframes or reference footage to guide important moments and transformations.", "For existing footage, choose a modification or reframing workflow and specify what must remain unchanged.", "Review the clip in an editing application and confirm output format, credits and license before delivery."],
    considerations: ["Luma's product naming has changed; Ray is the current video model family and Dream Machine is an older name.", "Ray model capabilities, clip duration, resolution, HDR and API access vary by release and plan.", "Some video-generation modes may not generate native audio; check the selected workflow's documentation.", "Professional HDR/EXR outputs still require compatible post-production software and color-management knowledge."],
    sourceLabel: "Luma official Ray3.2 model overview",
    sourceUrl: "https://lumalabs.ai/ray",
    faq: [
      { question: "Is Luma Dream Machine still the current product name?", answer: "Luma's current official information identifies the creative workspace as Luma and its current video model family as Ray. Dream Machine is an older product name." },
      { question: "What is Ray3.2 used for?", answer: "Luma describes Ray3.2 for text-to-video, image-to-video, video modification and reframing, with multi-keyframe controls and professional HDR/EXR workflows." }
    ]
  },
  "sora": {
    seoTitle: "Sora Discontinued — Status & Alternatives | Anjal AI",
    overview: "Sora was OpenAI's video-generation product for creating clips from text and visual inputs. It is no longer available: OpenAI's official discontinuation notice states that the Sora web and app experiences ended on April 26, 2026, and the Sora API ended on September 24, 2026. This Anjal AI page is retained as a status reference, not as a recommendation to sign up or generate new videos with Sora. Creators looking for current video-generation workflows can compare active alternatives such as Google Veo, Kling AI, Pika and Luma.",
    bestFor: ["Checking the official discontinuation status of Sora", "Understanding the dates when Sora web, app and API access ended", "Finding current video-generation alternatives in the Anjal AI directory", "Reviewing OpenAI's guidance for exporting existing Sora content"],
    workflow: ["Read OpenAI's official discontinuation notice before following older Sora tutorials or links.", "If you previously created Sora content, follow the official export instructions while the export option is available.", "For new video projects, compare current tools such as Google Veo, Kling AI, Pika and Luma.", "Check each alternative's current model, access, credit limits and commercial terms before starting.", "Treat older Sora feature guides and API examples as historical rather than current instructions."],
    considerations: ["Sora web and app experiences were discontinued on April 26, 2026.", "The Sora API was discontinued on September 24, 2026.", "OpenAI's export and data-retention instructions may change; consult the official help article for current steps.", "Do not rely on old pricing, availability or integration tutorials for Sora."],
    sourceLabel: "OpenAI official Sora discontinuation notice",
    sourceUrl: "https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation",
    faq: [
      { question: "Is Sora still available?", answer: "No. OpenAI states that the Sora web and app experiences ended on April 26, 2026, and the API ended on September 24, 2026." },
      { question: "What can I use instead of Sora?", answer: "Current alternatives listed in Anjal AI include Google Veo, Kling AI, Pika and Luma. Compare their current capabilities, access and usage terms before choosing." }
    ]
  },
  "groq": {
    seoTitle: "GroqCloud — Fast AI Inference & Model APIs | Anjal AI",
    overview: "GroqCloud is a hosted AI inference platform for developers who want to run supported language, speech and vision models through APIs. The official console provides a model catalogue, API reference, quickstarts, SDK examples and integrations with common AI development frameworks. Its API is designed to work with familiar OpenAI-compatible client patterns, although compatibility is not identical for every feature. GroqCloud is not a general-purpose model directory or a place to run every public model: developers select from the provider's currently supported production and preview models, each with its own limits and lifecycle.",
    bestFor: ["Adding fast hosted language-model inference to an application", "Prototyping chat, reasoning and tool-calling workflows", "Building speech-to-text features with supported audio models", "Connecting model APIs to frameworks such as AI SDK and LangChain", "Testing different supported models before production deployment"],
    workflow: ["Create a GroqCloud account and generate an API key in the console.", "Store the key in a server-side environment variable; never expose it in browser code or a public repository.", "Choose a production model from the current model catalogue and review its context, modality and rate limits.", "Use the quickstart or an official SDK to send a small test request.", "Measure output quality, latency, throughput and cost with representative inputs before switching production traffic."],
    considerations: ["The supported model list changes; preview models can be removed and should not be relied on for production.", "API limits and pricing vary by model and account tier.", "OpenAI-compatible request formats do not guarantee support for every OpenAI parameter or endpoint.", "Inputs and outputs are processed by the selected model provider; review model-specific terms and data handling before sending sensitive content."],
    sourceLabel: "Groq official API quickstart and supported models",
    sourceUrl: "https://console.groq.com/docs/quickstart",
    faq: [
      { question: "What is GroqCloud used for?", answer: "GroqCloud provides hosted inference APIs for supported language, speech and other models, so developers can add model capabilities to their own applications." },
      { question: "Can I use the OpenAI SDK with Groq?", answer: "Groq documents an OpenAI-compatible API base URL and SDK examples. Check its compatibility guide because not every endpoint or parameter is necessarily supported." }
    ]
  },
  "meta-llama": {
    seoTitle: "Meta Llama — Open AI Models & Developer Resources | Anjal AI",
    overview: "Meta Llama is a family of large language and multimodal models that developers can access through model downloads, supported hosting partners and related developer resources. The official Llama site provides model cards, setup and deployment guides, prompting and fine-tuning material, safety resources, and the license and acceptable-use terms for each release. Different generations and sizes target different hardware and application needs; newer releases may add image understanding or other modalities. Llama is a model ecosystem, not one single hosted chatbot, so users choose how and where to run a particular checkpoint.",
    bestFor: ["Building chat assistants and language applications with Llama models", "Evaluating open-weight models for self-hosted or partner-hosted inference", "Adapting models with fine-tuning, quantization or prompting", "Developing multimodal applications with supported vision models", "Creating private or specialized AI systems with deployment control"],
    workflow: ["Choose a specific Llama generation and model size based on task, hardware and context requirements.", "Read that model's model card, license and acceptable-use policy before downloading or deploying it.", "Select a supported hosting partner or prepare compatible local infrastructure.", "Use the official prompting and integration guidance, then evaluate quality and safety on representative tasks.", "Monitor version updates, model provenance and deployment performance after release."],
    considerations: ["Llama is a family of releases; capabilities, context windows, modalities and hardware needs vary.", "The term open-weight does not mean every model has an unrestricted open-source license.", "Each generation has its own license and acceptable-use policy, which may impose conditions on distribution or commercial use.", "Self-hosting requires infrastructure, security, monitoring and responsible-use safeguards."],
    sourceLabel: "Meta official Llama developer portal",
    sourceUrl: "https://www.llama.com/",
    faq: [
      { question: "Is Meta Llama a chatbot?", answer: "Llama is a family of AI models. Developers and providers use these models to power chatbots, assistants and other applications." },
      { question: "Can I run Llama models myself?", answer: "Many Llama releases are available as downloadable model weights or through hosting partners. Check the exact model's requirements, license and access conditions." }
    ]
  },
  "cohere": {
    seoTitle: "Cohere AI — Enterprise Models, RAG & Search | Anjal AI",
    overview: "Cohere builds AI models and platform services for enterprise applications. Its product family includes Command models for chat, generation, tool use and retrieval-augmented generation; Embed models for semantic search and classification; Rerank models for improving the relevance order of search results; and document parsing capabilities for extracting structured information. Developers can access models through Cohere's hosted API or explore deployment options for enterprise environments. Cohere is especially relevant when an application needs more than text generation, such as retrieval pipelines that find and rank useful information from company documents.",
    bestFor: ["Building enterprise chat assistants and RAG applications", "Improving search with semantic embeddings and reranking", "Extracting structured information from documents and PDFs", "Creating multilingual search and knowledge workflows", "Integrating language models into business applications through APIs"],
    workflow: ["Map the task to the right capability: Command for generation, Embed for vector representations, Rerank for relevance ordering or Parse for document extraction.", "Review the current model documentation, supported languages, input limits and deployment options.", "Prepare a representative document set and a small evaluation query set.", "Build retrieval, generation and citation checks as separate stages, and measure whether results are grounded in source documents.", "Review data residency, access controls and deployment requirements before connecting private enterprise content."],
    considerations: ["Cohere's models are specialized; one model endpoint does not replace the full retrieval and application architecture.", "Reranking improves ordering of retrieved results but cannot recover documents that the initial search never found.", "Model versions, context limits and API availability change; check the current documentation.", "Enterprise deployments and data-handling options depend on the selected product and contract."],
    sourceLabel: "Cohere official platform and model documentation",
    sourceUrl: "https://docs.cohere.com/docs/the-cohere-platform",
    faq: [
      { question: "What is Cohere used for?", answer: "Cohere provides language models and retrieval components for enterprise chat, RAG, semantic search, classification, reranking and document workflows." },
      { question: "What is Cohere Rerank?", answer: "Rerank scores and reorders a set of documents by relevance to a query, helping search and RAG systems select more useful context." }
    ]
  },
  "amazon-q": {
    seoTitle: "Amazon Q — AWS AI Assistant for Work & Coding | Anjal AI",
    overview: "Amazon Q is AWS's family of generative AI assistants for business and software-development workflows. Amazon Q Business is designed to help employees find and use information across connected enterprise content, subject to organizational permissions. Amazon Q Developer focuses on software work: it can explain code, suggest changes, generate tests, help diagnose issues and assist with AWS resources through supported IDE, command-line and console experiences. These products use AWS identity and governance controls, so setup and available features depend on the organization's AWS environment and subscription.",
    bestFor: ["Asking questions across connected company knowledge in Amazon Q Business", "Getting code explanations, suggestions and test-generation help", "Planning and reviewing multi-file software changes", "Troubleshooting AWS services and cloud-development tasks", "Working with enterprise identity, access and governance controls"],
    workflow: ["Identify whether the task belongs in Amazon Q Business or Amazon Q Developer.", "Sign in through the organization's approved AWS identity and check which data sources or developer tools are enabled.", "Ask a specific question and provide only the context needed for the task.", "For code changes, inspect the proposed plan and diff, run tests and review security implications before accepting.", "Check AWS service notices and current documentation before standardizing on a particular IDE plugin or workflow."],
    considerations: ["Amazon Q Business and Amazon Q Developer are distinct products with different use cases and permissions.", "AWS has announced that support for Amazon Q Developer IDE plugins will end on April 30, 2027; organizations should review AWS's migration guidance before adopting those plugins for long-term workflows.", "Responses and code suggestions can be incorrect; review outputs and run tests.", "Access to enterprise data is governed by connected data sources, identity configuration and organizational permissions."],
    sourceLabel: "AWS official Amazon Q documentation and lifecycle notice",
    sourceUrl: "https://aws.amazon.com/documentation-overview/q-developer/",
    faq: [
      { question: "What is the difference between Amazon Q Business and Developer?", answer: "Amazon Q Business helps users work with enterprise information, while Amazon Q Developer focuses on software development and AWS-related engineering tasks." },
      { question: "Is Amazon Q Developer IDE support changing?", answer: "AWS currently lists April 30, 2027 as the end-of-support date for Amazon Q Developer IDE plugins. Check AWS's current migration guidance before planning a long-term IDE workflow." }
    ]
  },
  "ibm-watsonx": {
    seoTitle: "IBM watsonx — Enterprise AI Platform & Models | Anjal AI",
    overview: "IBM watsonx is an enterprise AI and data platform made up of connected products for building AI applications, governing models and managing data. watsonx.ai provides tools to build, customize, evaluate and deploy AI applications and models. watsonx.governance focuses on AI risk management, oversight and compliance workflows, while watsonx.data supports data infrastructure for analytics and AI. The platform is aimed at organizations that need to connect generative AI with enterprise knowledge, existing systems and governance processes rather than simply use a consumer chat assistant.",
    bestFor: ["Building and deploying enterprise generative AI applications", "Experimenting with foundation models and retrieval workflows", "Connecting AI applications to enterprise data", "Evaluating model behavior and managing AI governance", "Planning hybrid or controlled enterprise AI deployments"],
    workflow: ["Identify the business process and data sources the AI solution must support.", "Choose the relevant watsonx product: watsonx.ai for AI application development, watsonx.governance for oversight or watsonx.data for data management.", "Evaluate available foundation models and retrieval approaches against real business tasks.", "Set up access controls, evaluation criteria and governance checks before connecting sensitive information.", "Pilot the workflow with a limited user group, monitor performance and document operational responsibilities."],
    considerations: ["watsonx is a product family; capabilities and pricing differ by service, region and deployment model.", "Enterprise deployment may require architecture, security, data and governance planning.", "AI-generated answers and model evaluations need human review for high-impact decisions.", "Check current IBM service documentation for regional availability, integrations and contractual data-handling terms."],
    sourceLabel: "IBM official watsonx platform overview",
    sourceUrl: "https://cloud.ibm.com/watsonx/overview",
    faq: [
      { question: "What is IBM watsonx used for?", answer: "IBM watsonx provides enterprise tools for building AI applications, working with data and governing AI models and workflows." },
      { question: "Is watsonx a single AI model?", answer: "No. watsonx is a platform family that includes AI application development, governance and data products, with access to multiple models and deployment options." }
    ]
  },
  "manus": {
    seoTitle: "Manus AI — Autonomous Agent for Research & Work | Anjal AI",
    overview: "Manus is an AI agent platform designed to carry out multi-step digital work rather than only answer a single chat prompt. Its current feature catalogue includes web research, browser operation, cloud-computer tasks, recurring automations, app and website creation, slides, design and media workflows, plus integrations with services such as GitHub, Google Drive, Gmail and project-management tools. The platform organizes work around projects and agent skills so users can provide context and delegate a task. Because an agent may browse, create files or interact with connected services, its permissions and intermediate actions should be reviewed.",
    bestFor: ["Delegating multi-step web research and information gathering", "Creating drafts, slides, websites and other digital deliverables", "Automating repeatable tasks across connected apps", "Working with browser and cloud-computer workflows", "Keeping project context and reusable task skills organized"],
    workflow: ["Describe the outcome, audience, constraints and definition of done in one clear task brief.", "Attach or connect only the files and apps required for the work.", "Break high-impact work into milestones and ask Manus to report its plan before taking consequential actions.", "Review sources, generated files and any browser or connected-app actions as the task progresses.", "Verify the final deliverable and revoke or narrow integrations that are no longer needed."],
    considerations: ["Agent results can be incomplete or incorrect; verify research, calculations, files and generated code.", "Connected apps and browser actions can expose or modify data, so review permissions and approval settings.", "Usage limits, model choices and feature access vary by plan and can change.", "Do not delegate payments, publishing, account changes or other consequential actions without reviewing the exact action and its effects."],
    sourceLabel: "Manus official feature catalogue",
    sourceUrl: "https://www.manus.im/features",
    faq: [
      { question: "What makes Manus different from a chatbot?", answer: "Manus is designed for multi-step agent workflows such as research, browser tasks, creating deliverables and automating work across connected services." },
      { question: "Can Manus connect to other apps?", answer: "Its feature catalogue lists integrations including GitHub, Google Drive, Gmail and other services. Available connections and permissions depend on the account and setup." }
    ]
  },
  "ideogram": {
    seoTitle: "Ideogram AI — Image Generation & Design Tools | Anjal AI",
    overview: "Ideogram is an AI image and design platform for creating visuals from text prompts and reference images, then refining them with editing tools. Its official documentation highlights text rendering for posters and graphics, image generation, reference-guided editing, inpainting, transparent backgrounds, editable text layers and upscaling. Studio supports layered design work, while APIs and integrations provide options for developers and repeatable production workflows. The platform also offers video creation tools, so users should select the correct image or video workflow before generating.",
    bestFor: ["Creating posters, thumbnails and graphics that include readable text", "Generating logos, illustrations and social media visuals", "Editing images with references, masks and inpainting", "Preparing transparent cutouts and layered designs", "Running repeatable or batch image-generation workflows"],
    workflow: ["Start with a clear prompt that names the subject, composition, style and any exact wording.", "Choose an image model or Auto mode and check the displayed credit cost before generating.", "Use reference images when identity, layout or visual continuity matters.", "Refine selected areas with masks, Studio layers or background tools instead of restarting.", "Review text spelling, image rights and output dimensions before publishing or printing."],
    considerations: ["Readable text generation is a strength, but every word and letter should still be proofread.", "Model choices, credits, free access and feature limits can change by account and plan.", "Reference images and generated outputs should be checked for permissions and brand or likeness rights.", "API usage and batch workflows may have separate billing and technical limits."],
    sourceLabel: "Ideogram official documentation and feature guide",
    sourceUrl: "https://docs.ideogram.ai/",
    faq: [
      { question: "Can Ideogram generate images with text?", answer: "Yes. Ideogram documents text rendering for graphics such as posters and packaging, alongside editable text layers in its Studio workflow. Proofread the final output before use." },
      { question: "Can I edit an existing image in Ideogram?", answer: "Yes. Supported workflows include reference-image editing, masks and inpainting, transparent-background editing, and layered Studio tools." }
    ]
  },
  "adobe-firefly": {
    seoTitle: "Adobe Firefly — AI Image, Video & Audio Studio | Anjal AI",
    overview: "Adobe Firefly is Adobe's generative AI creative studio for producing and editing images, video, audio and vector graphics. Adobe's current product information describes text-to-image generation, video generation and image-to-video, generative editing such as removing objects and expanding images, speech and audio tools, and design workflows that span raster, vector, motion and print. Firefly also brings Adobe and partner models into a connected creative workspace. It is useful for creators who want to move from concept generation to refinements and production assets without switching between many separate tools.",
    bestFor: ["Generating and refining campaign images and social media assets", "Creating short video clips and B-roll from prompts or still images", "Removing objects, expanding scenes and adjusting existing visuals", "Exploring vector, print and brand-design concepts", "Combining AI generation with established Adobe creative workflows"],
    workflow: ["Choose the output type first: image, video, audio or design.", "Write a prompt describing subject, composition, style, lighting and intended format.", "Generate options, then refine with the relevant editing controls such as remove, expand or upscale.", "For a multi-format project, keep source assets and versions organized as you move between workflows.", "Before commercial release, review the selected model, content credentials, usage terms and any partner-model conditions."],
    considerations: ["Firefly includes multiple Adobe and partner models, so capabilities and terms can differ by model.", "Generative outputs may need manual review for typography, anatomy, factual details and brand consistency.", "Commercial-use suitability is not a blanket guarantee for every asset or every partner model; check the applicable terms.", "Generation allowances and premium features depend on account, region and plan."],
    sourceLabel: "Adobe official Firefly product overview",
    sourceUrl: "https://www.adobe.com/in/sensei/generative-ai/firefly.html",
    faq: [
      { question: "What can Adobe Firefly generate?", answer: "Adobe describes image, video, audio and vector generation, plus editing tools such as object removal, image expansion and upscaling." },
      { question: "Is Adobe Firefly suitable for commercial creative work?", answer: "Adobe positions its Firefly models for commercially oriented creative workflows, but users should check the terms for the exact model and asset, especially when partner models are involved." }
    ]
  },
  "leonardo-ai": {
    seoTitle: "Leonardo AI — Image Generator & Creative Canvas | Anjal AI",
    overview: "Leonardo AI is a creative platform for generating, editing and refining images, with additional video and motion workflows. Its current model catalogue includes Leonardo's own image models as well as supported third-party models. The platform combines text-to-image and image-to-image generation with reference guidance, Canvas and inpainting, upscaling, presets, personal models and workflow tools such as Blueprints. This makes it useful for creators who want to explore visual directions, keep a consistent look and refine an asset inside one workspace rather than relying on a single prompt-and-download step.",
    bestFor: ["Creating concept art, illustrations, product visuals and marketing images", "Transforming existing images or sketches into new visual styles", "Refining selected areas with Canvas and inpainting tools", "Maintaining consistent characters, styles or brand elements", "Exploring different image models and repeatable creative workflows"],
    workflow: ["Choose a text-to-image or image-to-image starting point and select Auto or a specific model.", "Describe the subject, style, composition and details that must remain consistent.", "Use image guidance or references when continuity is important across outputs.", "Open the Canvas or editor tools to inpaint, expand or refine specific areas.", "Upscale and inspect the final image, then check the current plan and usage terms before commercial use."],
    considerations: ["Model access, generation tokens, private generations and queue limits vary by plan.", "The platform includes third-party models whose capabilities and terms may differ from Leonardo's own models.", "AI results can contain visual errors; inspect faces, hands, text, logos and product details.", "Commercial usage and ownership terms should be checked against the current terms for the relevant account and model."],
    sourceLabel: "Leonardo official image generator and model catalogue",
    sourceUrl: "https://leonardo.ai/ai-image-generator",
    faq: [
      { question: "Can Leonardo AI edit existing images?", answer: "Yes. Leonardo describes image-to-image workflows, reference guidance and editor tools such as Canvas and inpainting for targeted refinements." },
      { question: "Does Leonardo AI include different image models?", answer: "Yes. Its model catalogue includes Leonardo models and supported third-party models. Access and usage allowances depend on the plan." }
    ]
  },
  "stable-diffusion": {
    seoTitle: "Stable Diffusion — Open Image Models & AI Art | Anjal AI",
    overview: "Stable Diffusion is a family of generative image models developed by Stability AI, rather than one single web application. The Stable Diffusion family includes releases such as Stable Diffusion 3.5 and SDXL, with options for hosted generation, API integration and self-hosted workflows. Depending on the model and interface, users can generate images from text, customize model behavior and use editing workflows such as inpainting or outpainting. Developers and creators value the ecosystem of interfaces, extensions and community fine-tunes, but each model release has its own technical requirements and license.",
    bestFor: ["Generating images from detailed text prompts", "Running image generation on compatible local hardware", "Building custom image-generation applications with APIs", "Experimenting with fine-tuned models and community workflows", "Integrating image generation into repeatable creative pipelines"],
    workflow: ["Identify the exact Stable Diffusion model and version you intend to use.", "Choose a hosted interface, Stability AI API or self-hosted setup based on your hardware and privacy needs.", "Read the model card and license before downloading, fine-tuning or deploying it.", "Set the prompt, dimensions, sampler or workflow parameters supported by the chosen interface.", "Review outputs and test performance, safety and licensing before using the model in a production application."],
    considerations: ["Stable Diffusion refers to multiple model generations and variants; features and requirements are not identical.", "Some releases require substantial GPU memory or setup knowledge when self-hosted.", "Licenses differ by model and may include commercial-use thresholds or restrictions; never assume every checkpoint shares one license.", "Community checkpoints and extensions can introduce separate security, provenance and usage risks."],
    sourceLabel: "Stability AI official Stable Diffusion model and license pages",
    sourceUrl: "https://stability.ai/stable-image",
    faq: [
      { question: "Is Stable Diffusion an app or a model?", answer: "Stable Diffusion is a family of image-generation models. People use it through hosted services, APIs, desktop interfaces and self-hosted setups." },
      { question: "Can Stable Diffusion run locally?", answer: "Some Stable Diffusion releases can be run locally on compatible hardware using supported software. Check the exact model's requirements and license before installation." }
    ]
  },
  "flux": {
    seoTitle: "FLUX AI — Image Generation & Editing Models | Anjal AI",
    overview: "FLUX is a family of image-generation and editing models from Black Forest Labs. The current FLUX model range includes hosted models for production use and open-weight releases with different capabilities and licenses. Official materials describe text-to-image generation, single- and multi-reference image editing, and task-specific tools for operations such as filling, erasing, extending and upscaling. Developers can explore the hosted playground and APIs, while eligible open-weight models can be deployed on supported infrastructure. Model choice matters because speed, quality, editing features and commercial permissions vary.",
    bestFor: ["Generating images from detailed text prompts", "Editing images with one or more visual references", "Building image-generation features into apps through APIs", "Running eligible open-weight models on supported hardware", "Creating controlled edits, variations and production image assets"],
    workflow: ["Choose a FLUX model based on whether you need speed, image quality, editing or local deployment.", "Check the model's current documentation, input limits and license before starting.", "Write a prompt with the subject, composition, visual style and required details.", "For editing, attach the relevant reference images and describe what should change and what must stay fixed.", "Evaluate outputs and latency, then confirm API billing or self-hosting requirements before production use."],
    considerations: ["FLUX is a model family; features, speed and quality differ between model versions.", "Open weights do not mean every model has the same license or unrestricted commercial use.", "Hosted API use may involve credits, rate limits and service availability.", "Review generated images for text, logos, identity consistency and other details that need precision."],
    sourceLabel: "Black Forest Labs official FLUX models and documentation",
    sourceUrl: "https://bfl.ai/models/",
    faq: [
      { question: "What is FLUX AI?", answer: "FLUX is Black Forest Labs' family of image-generation and editing models, available through hosted services and selected open-weight releases." },
      { question: "Can FLUX edit existing images?", answer: "Yes. Black Forest Labs documents reference-based editing and task-specific image tools. Supported inputs and controls depend on the selected model." }
    ]
  },
  "recraft": {
    seoTitle: "Recraft AI — Image, Vector & Design Generator | Anjal AI",
    overview: "Recraft is an AI visual-design platform built for designers, illustrators and marketers. Its product information highlights image generation and editing alongside vector graphics, icons, mockups, upscaling, background removal and image vectorization. A distinctive workflow is generating editable vector artwork, which can be useful for logos, icons and scalable illustrations that need further design work. Recraft also supports consistent visual styles and design-focused composition controls, making it suitable for creating a family of assets rather than isolated images.",
    bestFor: ["Creating editable vector graphics, icons and illustrations", "Designing logos, brand assets and marketing visuals", "Generating product mockups and T-shirt graphics", "Keeping a consistent visual style across multiple assets", "Editing, upscaling or vectorizing existing images"],
    workflow: ["Choose whether the deliverable should be a raster image, vector, mockup or edited asset.", "Describe the subject, layout, colors, style and any text that must appear.", "Generate several directions and refine the strongest composition.", "Use vector generation or vectorization when you need scalable artwork, then inspect paths and layers in a design editor.", "Export the required format and verify typography, colors, licensing and print specifications before delivery."],
    considerations: ["Vector output should still be inspected for path quality, layer structure and small-detail issues.", "AI-generated lettering may need correction before it is used in a logo or printed design.", "Plan limits, available models and export formats can change.", "Check the current terms and any third-party model conditions before commercial use."],
    sourceLabel: "Recraft official product overview",
    sourceUrl: "https://www.recraft.ai/about",
    faq: [
      { question: "Can Recraft generate vector graphics?", answer: "Yes. Recraft describes AI vector generation and vectorization workflows for editable graphics such as logos, icons and illustrations." },
      { question: "Who is Recraft designed for?", answer: "Recraft positions its platform for professional designers, illustrators and marketers who need to create and refine visual assets." }
    ]
  },
  "mistral-le-chat": {
    seoTitle: "Mistral Vibe (Le Chat) — AI Assistant | Anjal AI",
    overview: "Mistral's Le Chat has evolved into the Vibe product family: Vibe for work is the AI chat assistant, while Vibe for code is the coding agent. Mistral describes Vibe as a workspace for asking questions, searching the web, creating content and working with connected tools. Depending on the surface and plan, users can also work with documents, use voice input, connect services and delegate coding tasks. The existing Le Chat name may still appear in older links, help material or app listings while the product transition rolls out.",
    bestFor: ["Getting answers and explanations from an AI assistant", "Searching the web and summarizing information with source links", "Drafting, rewriting and translating everyday content", "Working with connected productivity services where available", "Moving from general AI chat into coding-agent workflows"],
    workflow: ["Open the current Mistral chat or Vibe experience and check which features are available to your account.", "Describe the goal, audience and desired format, and attach only relevant files.", "For current facts, request web research and open the cited sources to verify them.", "Use connected tools only after reviewing the permissions and data they can access.", "For code tasks, inspect proposed file changes and commands, then run your own tests."],
    considerations: ["Mistral is transitioning product naming from Le Chat to Vibe; feature names and entry points may change.", "Availability of agents, connectors and long-running tasks depends on plan and product surface.", "AI answers can be inaccurate; verify important claims and generated code.", "Review connected-app permissions and data handling before sharing sensitive information."],
    sourceLabel: "Mistral official Vibe product overview",
    sourceUrl: "https://mistral.ai/products/vibe/",
    faq: [
      { question: "Is Mistral Le Chat still called Le Chat?", answer: "Mistral's current product information describes Vibe for work as its AI chat assistant, formerly Le Chat, and Vibe for code as its coding agent. Older links and references may still use Le Chat." },
      { question: "What can Mistral Vibe do?", answer: "Mistral describes chat and coding-agent workflows, with web search, task assistance and integrations. Exact features depend on the plan and product surface." }
    ]
  },
  "character-ai": {
    seoTitle: "Character.AI — Create Characters & AI Chats | Anjal AI",
    overview: "Character.AI is a platform for conversations with user-created AI characters. Its character-creation guide explains how creators can set a character name, avatar, greeting, tags and visibility, then publish it for others to discover and chat with. Characters can be built around fictional personalities, role-play scenarios, learning exercises or interactive storytelling. The experience is designed for conversation and entertainment rather than as a source of verified factual advice.",
    bestFor: ["Creating fictional characters with distinct personalities and greetings", "Interactive storytelling and role-play conversations", "Exploring community-created characters and scenarios", "Practicing dialogue, language or interview-style conversations", "Building a recurring character experience with tags and a recognizable profile"],
    workflow: ["Choose a clear character concept, audience and intended conversation style.", "Write a specific description and greeting that establish the character's role and scenario.", "Add an avatar, tags and visibility settings, then preview the character before publishing.", "Test conversations with varied prompts and refine instructions where the character loses consistency.", "Review current platform rules and age-related safety settings before sharing a character."],
    considerations: ["AI characters can invent facts and should not be treated as authoritative sources.", "Conversation quality and character consistency vary with prompts and model behavior.", "Platform safety rules, age requirements and feature availability can change.", "Avoid entering personal, confidential or sensitive information into role-play chats."],
    sourceLabel: "Character.AI official character creation quickstart",
    sourceUrl: "https://support.character.ai/hc/en-us/articles/50608869548699-2-Creating-a-Character-Quickstart-Guide-%CF%89",
    faq: [
      { question: "Can I create my own AI character?", answer: "Character.AI's quickstart describes creating a character by setting a name, avatar, greeting, tags and visibility, then publishing it." },
      { question: "Is Character.AI intended for factual research?", answer: "Its core experience is character-based conversation and role-play. Verify factual claims independently rather than relying on a fictional character's responses." }
    ]
  },
  "kimi": {
    seoTitle: "Kimi AI — Web Search, Deep Research & AI Agents | Anjal AI",
    overview: "Kimi is an AI assistant developed by Moonshot AI. Its current help materials describe web-connected search, deep thinking, multimodal document understanding and agent workflows for tasks such as research, document creation, spreadsheets and website building. Kimi can retrieve web sources, analyze supported files and use specialized tools in supported modes. Model choices, agent features, file limits and usage credits vary by product surface and account.",
    bestFor: ["Researching current topics with web search and linked sources", "Summarizing long documents and supported office files", "Planning multi-step tasks with an AI agent", "Creating drafts, presentations and spreadsheet-style outputs", "Analyzing images, videos or charts in supported multimodal workflows"],
    workflow: ["Choose regular chat, web-connected search or an agent mode based on the task.", "Provide a focused question and attach only the documents needed.", "For research, ask for source links and verify important claims in the original material.", "Break complex work into milestones and inspect generated documents or actions at each stage.", "Check the selected model, credits, file limits and privacy settings before larger tasks."],
    considerations: ["Search and agent capabilities depend on the selected model, mode and account.", "Generated summaries and reports can omit context or misread source material.", "Credit usage, file limits and feature availability may change over time.", "Review any generated code, spreadsheet formulas or external actions before using the result."],
    sourceLabel: "Kimi official overview and agentic search help",
    sourceUrl: "https://www.kimi.ai/help/getting-started/overview",
    faq: [
      { question: "Can Kimi search the web?", answer: "Kimi's official help describes web-connected and agentic search that can retrieve current information and provide source links for verification." },
      { question: "Can Kimi work with documents?", answer: "Kimi's help materials describe support for common office files and multimodal inputs. Check the current interface for supported formats and per-file limits." }
    ]
  },
  "elicit": {
    seoTitle: "Elicit AI — Research Agent & Literature Reviews | Anjal AI",
    overview: "Elicit is an AI research assistant focused on academic literature and evidence synthesis. Its current help center describes a Research Agent for flexible research questions, Research Reports for structured topic overviews and a Systematic Review workflow for more controlled screening and data extraction. Elicit's documented corpus includes academic papers and clinical-trial records, and sessions can combine search results with user-uploaded documents. Systematic Review access and usage limits depend on the subscription plan.",
    bestFor: ["Finding academic papers relevant to a research question", "Summarizing and comparing findings across studies", "Extracting structured details from research papers", "Preparing literature reviews and evidence tables", "Running a documented systematic-review workflow with explicit screening criteria"],
    workflow: ["Turn the topic into a focused research question and define the population, intervention or concepts of interest.", "Choose a Research Agent session, Research Report or Systematic Review according to the level of control needed.", "Review the papers found and set clear inclusion and exclusion criteria.", "Check extracted methods, sample sizes and results against the original papers.", "Export the report and citations, then document limitations and missing evidence."],
    considerations: ["AI extraction can misread methods, outcomes or statistical details; verify against each paper.", "Systematic Review workflows are limited to eligible paid plans and usage allowances.", "Coverage depends on the databases, accessible full text and search strategy.", "A generated literature review is a research aid, not a substitute for expert appraisal or a registered protocol."],
    sourceLabel: "Elicit official workflow guide",
    sourceUrl: "https://support.elicit.com/en/articles/14757543-getting-started-with-elicit-which-workflow-should-i-use",
    faq: [
      { question: "What is Elicit used for?", answer: "Elicit helps researchers search academic literature, summarize and extract information from papers, and prepare research reports or systematic reviews." },
      { question: "Does Elicit support systematic reviews?", answer: "Yes. Its guided Systematic Review workflow covers gathering papers, screening, data extraction and report generation, with availability depending on plan." }
    ]
  },
  "consensus": {
    seoTitle: "Consensus AI — Scientific Research Search | Anjal AI",
    overview: "Consensus is an academic search and research platform that uses scholarly papers to answer research questions. Its help center describes semantic and keyword retrieval, AI summaries with citations, study comparisons, structured evidence tables and a Research Agent for multi-step searches. The Deep Review workflow can break a question into sub-questions, screen papers and synthesize a longer report. Consensus is designed to make research easier to explore, but users should still inspect the cited studies and assess their quality.",
    bestFor: ["Searching peer-reviewed research using natural-language questions", "Finding papers and following citations to related studies", "Comparing methods, populations, sample sizes and outcomes", "Getting citation-backed summaries of evidence", "Preparing a deeper literature review with structured findings"],
    workflow: ["Write a research question that specifies the population, topic, intervention or outcome.", "Choose a standard paper search, Pro analysis or Deep Review based on the depth required.", "Apply filters such as recency, study type, sample size or journal quality when relevant.", "Open cited papers and compare methods, limitations and conflicting findings.", "Export useful references and record the search scope and date for reproducibility."],
    considerations: ["A citation-backed AI summary can still overstate or misinterpret a paper's findings.", "Search coverage and full-text availability vary by database and publication.", "Deep Review and other advanced workflows use plan-based allowances.", "Do not treat a consensus indicator as a substitute for evaluating study design, bias or clinical guidance."],
    sourceLabel: "Consensus official research and Deep Review documentation",
    sourceUrl: "https://help.consensus.app/en/articles/9922673-how-consensus-works",
    faq: [
      { question: "What does Consensus AI do?", answer: "Consensus searches scholarly literature and provides paper results, citation-backed summaries, study comparisons and research workflows." },
      { question: "Can Consensus create a literature review?", answer: "Its Deep Review workflow performs multi-step searches and synthesizes relevant papers into a structured report. Review the cited studies before drawing conclusions." }
    ]
  },
  "qwen": {
    seoTitle: "Qwen AI — Multimodal Assistant & Open Models | Anjal AI",
    overview: "Qwen is Alibaba's family of language and multimodal AI models, with chat experiences, developer APIs and open-weight releases. Alibaba's current materials describe capabilities across text generation, coding, reasoning, image and video understanding, audio, structured data and tool use. Qwen models can be accessed through the Qwen chat experience or integrated into applications through supported developer platforms. The available model, deployment method, license and features differ across releases.",
    bestFor: ["Chatting, drafting, summarizing and translating text", "Analyzing supported images, videos and documents", "Coding, mathematics and structured-data tasks", "Building applications with model APIs and tool calling", "Evaluating open-weight models for local or customized deployment"],
    workflow: ["Choose the Qwen chat product, API or model release that matches your task.", "Check the model card or official documentation for supported inputs, context limits and license.", "Provide clear instructions and representative examples for the desired output.", "For multimodal work, verify extracted information against the original image, video or document.", "For application deployment, evaluate quality, latency, security, cost and license obligations before launch."],
    considerations: ["Qwen is a model family, not one fixed model; capabilities differ across versions and sizes.", "Some releases are open-weight while others are accessed through hosted services or APIs.", "Model outputs can be incorrect, biased or unsafe without suitable evaluation and controls.", "Review each model's license, data handling and deployment terms before commercial use."],
    sourceLabel: "Alibaba official Qwen overview and Model Studio documentation",
    sourceUrl: "https://www.alibabagroup.com/en-US/ai-governance/qwen",
    faq: [
      { question: "What is Qwen AI?", answer: "Qwen is Alibaba's family of language and multimodal models used for chat, content generation, reasoning, coding and other AI tasks." },
      { question: "Can developers use Qwen in their own apps?", answer: "Alibaba provides Qwen access through official APIs and open-weight model releases. Check the exact model's availability, license and deployment requirements." }
    ]
  },
  "notebooklm": {
    seoTitle: "NotebookLM — AI Research, Notes & Audio Overviews | Anjal AI",
    overview: "NotebookLM is Google's AI research and learning assistant for working with a collection of sources you choose. Google's Gemini Notebook help materials describe support for sources such as Google Docs, Slides, PDFs, text and Markdown files, web pages, public YouTube URLs and audio. You can ask questions grounded in those materials, organize notes and create Audio Overviews that turn source material into a listenable discussion. Product naming and feature access may differ between consumer and Workspace experiences.",
    bestFor: ["Studying a set of class notes, readings or reference documents", "Summarizing and comparing information across selected sources", "Finding answers in long PDFs, documents and supported web sources", "Creating Audio Overviews to review material while away from a screen", "Preparing research notes, study guides and source-based outlines"],
    workflow: ["Create a notebook for one topic or project and add only relevant sources.", "Ask focused questions that name the comparison, explanation or output you need.", "Open the cited passages in the original sources and check that they support the answer.", "Save useful notes and use Audio Overview as a revision aid, not as a replacement for reading.", "Review source permissions and privacy settings before adding private or copyrighted material."],
    considerations: ["Answers are grounded in the sources you provide and can still misinterpret them.", "Audio Overviews are generated summaries, not complete or objective accounts of every source.", "Supported source types, import limits and features can change by account and product version.", "Do not upload confidential or sensitive material unless the applicable privacy controls are suitable."],
    sourceLabel: "Google Gemini Notebook official help and FAQ",
    sourceUrl: "https://support.google.com/gemininotebook/answer/16269187?hl=en",
    faq: [
      { question: "What is NotebookLM used for?", answer: "Google describes NotebookLM as a research and learning assistant that helps people explore their selected sources, ask questions and create source-based notes or summaries." },
      { question: "Can NotebookLM create an audio summary?", answer: "Google's Audio Overview feature turns source material into a generated audio discussion. Review the original documents because an audio overview may omit details or contain errors." }
    ]
  },
  "google-gemini": {
    seoTitle: "Google Gemini — AI Assistant & File Tools | Anjal AI",
    overview: "Google Gemini is Google's AI assistant for asking questions, exploring ideas and working with supported text, images and files. Google's product updates describe workflows for generating, previewing and editing documents, PDFs, presentations, spreadsheets and code directly in a Gemini conversation. The formats and editing tools available can differ between web and mobile, and depend on the current release and account.",
    bestFor: ["Getting explanations, brainstorming and help with everyday questions", "Drafting and refining documents or presentations from a written brief", "Working with supported PDFs and other uploaded files", "Turning notes or source material into structured summaries and study resources", "Iterating on code, spreadsheets and written content with follow-up instructions"],
    workflow: ["State the goal, intended audience and format before asking Gemini to create an output.", "Attach only the files needed and explain what information should be extracted or changed.", "Ask for a preview and make targeted edits rather than accepting a first draft.", "Check calculations, citations, factual claims and formatting against the original material.", "Confirm which file formats and editing features are available on your device and account."],
    considerations: ["Gemini can produce incorrect information or alter meaning when summarizing files; verify important details.", "File creation and editing support can vary by format, device, region and account.", "Some advanced features may have usage limits or require an eligible plan.", "Review Google's privacy and activity settings before sharing sensitive documents."],
    sourceLabel: "Google official Gemini file creation and editing update",
    sourceUrl: "https://blog.google/innovation-and-ai/products/gemini-app/edit-files-directly/",
    faq: [
      { question: "Can Gemini create documents and PDFs?", answer: "Google's October 2026 update describes generating, previewing and editing documents and PDFs in Gemini, alongside presentations, spreadsheets and code. Availability differs by format and device." },
      { question: "Can Gemini edit an uploaded file?", answer: "Gemini can help refine supported files in a conversation. Review the preview and compare the result with your original before downloading or sharing it." }
    ]
  },
  "meta-ai": {
    seoTitle: "Meta AI — Chat, Research & Image Creation | Anjal AI",
    overview: "Meta AI is Meta's AI assistant, available through meta.ai and supported Meta apps and devices. Meta describes it as a tool for everyday questions, writing help, image generation, recommendations and more involved research. Its current assistant information also describes research reports with citations, document and presentation tasks, voice interactions and connections to services such as email or calendars in supported experiences. Availability varies by country, account and product.",
    bestFor: ["Getting quick explanations, brainstorming and writing assistance", "Generating or editing images from a prompt where the feature is available", "Exploring a topic with deeper research and source links", "Using AI assistance inside supported WhatsApp, Instagram, Facebook or Messenger experiences", "Getting help with recommendations, planning and everyday tasks"],
    workflow: ["Choose the Meta AI surface available to you, such as the website, app or an integrated Meta app.", "Describe the task and include the context, language and output format you need.", "For research, open cited sources and verify that they support the answer.", "For generated images or documents, inspect details and edit before sharing.", "Check feature availability, connected-app permissions and privacy settings before linking accounts."],
    considerations: ["Meta AI features and app availability are not identical in every country or account.", "Generated answers, recommendations and research summaries can be incomplete or inaccurate.", "Connected email, calendar or business information may require additional permissions.", "Review privacy controls before sharing personal, business or customer information."],
    sourceLabel: "Meta official AI assistant overview and FAQs",
    sourceUrl: "https://ai.meta.com/meta-ai/assistant/",
    faq: [
      { question: "Where can I use Meta AI?", answer: "Meta lists meta.ai, its Meta AI app and supported experiences in WhatsApp, Instagram, Messenger and Facebook. Availability and individual features vary by region." },
      { question: "Can Meta AI help with research?", answer: "Meta describes a Deep Research experience that can build research plans, search sources and draft structured reports with citations. Verify the cited material before relying on a report." }
    ]
  },
  "github-copilot": {
    seoTitle: "GitHub Copilot — AI Coding Assistant & Agent | Anjal AI",
    overview: "GitHub Copilot is an AI coding assistant integrated into GitHub and supported development environments. GitHub's documentation describes inline code suggestions, codebase questions, code explanations, code review and agent workflows that can research a repository, plan changes, edit files, run tools and prepare pull requests for review. Available features depend on the Copilot plan, client and organization policies.",
    bestFor: ["Getting code suggestions while writing or editing software", "Understanding unfamiliar files, repositories and development concepts", "Planning and implementing multi-step coding tasks with an agent", "Reviewing code changes and pull requests for potential issues", "Generating tests, refactoring code and troubleshooting errors"],
    workflow: ["Choose the Copilot surface that fits the task: IDE, GitHub website, CLI or app.", "Describe the expected behavior, constraints, relevant files and acceptance criteria.", "For agent tasks, ask for a plan and keep changes within a clearly scoped repository.", "Review every diff, command, dependency change and pull request before approving it.", "Run the project's tests and security checks before merging or deploying."],
    considerations: ["AI-generated code can contain bugs, insecure patterns or unsuitable dependencies.", "Agent capabilities and access depend on the selected plan, repository permissions and organization settings.", "Review proposed terminal commands and file changes before allowing them to run.", "Do not expose credentials, production secrets or private code beyond the access your account permits."],
    sourceLabel: "GitHub official Copilot capabilities documentation",
    sourceUrl: "https://docs.github.com/en/copilot/get-started/about-github-copilot",
    faq: [
      { question: "What can GitHub Copilot do?", answer: "GitHub documents code completion, repository questions, explanations, code review and agent workflows for planning and implementing changes." },
      { question: "Can GitHub Copilot create a pull request?", answer: "Supported Copilot agent workflows can work on a task and prepare a pull request for human review. Review the changes and run tests before merging." }
    ]
  },
  "hugging-face-community": {
    seoTitle: "Hugging Face Hub — Models, Datasets & AI Apps | Anjal AI",
    overview: "Hugging Face is a platform and community for discovering, sharing and building with machine-learning resources. Its Hub documentation describes repositories for models, datasets and interactive demo applications called Spaces, alongside version history, collaboration tools, model cards and integrations with popular development libraries. Developers can explore open models, inspect documentation and use supported inference or deployment services.",
    bestFor: ["Discovering machine-learning models for language, vision, audio and other tasks", "Finding datasets and reviewing their documentation and intended use", "Trying interactive model demos through Spaces", "Sharing model repositories and collaborating on AI projects", "Integrating supported models into applications with libraries or inference services"],
    workflow: ["Search the Hub by task, model type, language, license and supported framework.", "Read the model card, dataset card and repository documentation before using an asset.", "Test the model or Space with representative inputs and inspect limitations.", "Check the license, provenance, safety notes and data requirements for your use case.", "Pin model versions and add evaluation, monitoring and access controls before production use."],
    considerations: ["Community repositories vary in quality, maintenance, documentation and safety.", "A model's benchmark results may not predict performance on your own data or language.", "Check licenses and dataset permissions before redistributing or using resources commercially.", "Hosted inference, private repositories and deployment options may have separate limits or costs."],
    sourceLabel: "Hugging Face official Hub documentation",
    sourceUrl: "https://huggingface.co/docs/hub/index",
    faq: [
      { question: "What is the Hugging Face Hub?", answer: "Hugging Face describes the Hub as a place to host and discover machine-learning models, datasets and interactive Spaces, with versioning and collaboration features." },
      { question: "Can I try AI models without installing them?", answer: "Some model repositories and Spaces provide browser-based demos or inference widgets. Availability depends on the repository, hardware and provider settings." }
    ]
  },
  "runway": {
    seoTitle: "Runway AI — Text-to-Video & Image-to-Video | Anjal AI",
    overview: "Runway is an AI creative platform with tools for generating and editing video and other media. Its current Gen-4.5 documentation describes text-to-video and image-to-video workflows, with prompts that can specify camera movement, scene composition, timing and motion. Runway's model and app lineup changes over time, so supported inputs, duration, output settings and access should be checked in the current interface.",
    bestFor: ["Creating short video concepts from text prompts", "Animating a still image into a moving shot", "Testing camera movement and scene choreography", "Developing visual ideas for social clips, ads and storyboards", "Iterating on a video concept before a larger production"],
    workflow: ["Choose text-to-video or image-to-video based on whether you have a starting frame.", "Describe subject movement, camera motion, scene action and timing in clear sequence.", "Generate a short test and evaluate motion consistency, composition and visual artifacts.", "Refine one or two prompt details at a time and compare versions.", "Check the current model settings, credits, output rights and commercial terms before publishing."],
    considerations: ["Generated motion can contain visual inconsistencies; review every frame before using a clip.", "Model versions, supported durations, resolution and input options can change.", "Credit usage and access depend on the model and subscription.", "Use only reference images and footage you have permission to upload and transform."],
    sourceLabel: "Runway official Gen-4.5 video generation documentation",
    sourceUrl: "https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5",
    faq: [
      { question: "Can Runway generate video from text?", answer: "Runway's Gen-4.5 documentation describes a text-to-video workflow as well as image-to-video generation." },
      { question: "Can I animate an existing image in Runway?", answer: "The documented image-to-video workflow uses an input image together with a text prompt to guide the motion in the resulting clip." }
    ]
  },
  "claude": {
    seoTitle: "Claude AI — Assistant, Projects & Workflows | Anjal AI",
    overview: "Claude is Anthropic's AI assistant for writing, analysis, coding, research and multi-step work. Anthropic's product overview describes web search, connectors, file handling, projects, artifacts, voice and the ability to create editable documents and other deliverables. Available capabilities vary by account, plan and workspace settings.",
    bestFor: ["Drafting, editing and restructuring long-form writing", "Analyzing documents, spreadsheets, presentations and images", "Explaining code, debugging and supporting software development", "Researching topics with web search and checking linked sources", "Organizing ongoing work with Projects, connectors and reusable instructions"],
    workflow: ["Define the outcome and provide the audience, constraints and required format.", "Attach only the files needed for the task and confirm they are suitable to share.", "For research, request source links and inspect the original material.", "For code or data work, test outputs and calculations independently.", "Review generated files and edits before sharing or using them in a production workflow."],
    considerations: ["Claude can make factual or reasoning errors; verify important claims against original sources.", "File, model, connector and usage availability can vary by plan and organization.", "Review privacy and data controls before uploading confidential or personal information.", "Treat generated code and spreadsheet formulas as drafts that require testing."],
    sourceLabel: "Anthropic Claude product overview",
    sourceUrl: "https://claude.com/product/overview",
    faq: [
      { question: "What can Claude help with?", answer: "Anthropic describes Claude as an assistant for writing, analysis, coding, research and longer tasks, with supported tools for files, web search, projects and creating editable work." },
      { question: "Can Claude work with files?", answer: "Claude supports a range of document, spreadsheet, presentation, image and data formats. Check the current product documentation for file types and size limits." }
    ]
  },
  "cursor": {
    seoTitle: "Cursor AI — Code Editor & Agent for Developers | Anjal AI",
    overview: "Cursor is an AI-powered code editor and coding agent designed to help developers understand, change and test software projects. Its Agent documentation says Agent can search a codebase, edit multiple files, run terminal commands, build features, refactor code, write tests and help fix errors. It is aimed at developers who want AI assistance within an editor and repository workflow.",
    bestFor: ["Understanding an unfamiliar codebase and tracing how files connect", "Building features that require coordinated changes across multiple files", "Refactoring code and fixing bugs with repository context", "Generating tests and running project commands during development", "Reviewing proposed code changes before committing them"],
    workflow: ["Open the correct project and let the editor index or inspect the relevant codebase.", "Describe the task, expected behavior, constraints and files or areas that should not change.", "Ask Agent for a plan when the task spans multiple files or has architectural risk.", "Review the diff, terminal commands and dependency changes before accepting them.", "Run tests, linting and security checks, then commit only after verifying the behavior."],
    considerations: ["Agent-generated edits can introduce regressions; inspect diffs and test the application.", "Terminal access and repository-wide edits should be used carefully in production projects.", "Model availability, usage limits and pricing depend on the current plan.", "Do not expose secrets or private source code unless the configured data controls are appropriate."],
    sourceLabel: "Cursor official Agent documentation",
    sourceUrl: "https://cursor.com/help/ai-features/agent",
    faq: [
      { question: "Can Cursor edit multiple files?", answer: "Cursor's Agent documentation describes codebase search and multi-file editing, along with terminal commands and test execution." },
      { question: "Is Cursor only autocomplete?", answer: "No. Cursor includes agent workflows for understanding repositories, planning changes, building features, fixing bugs and reviewing code." }
    ]
  },
  "elevenlabs": {
    seoTitle: "ElevenLabs — AI Voice, Text to Speech & Dubbing | Anjal AI",
    overview: "ElevenLabs provides AI audio tools for generating speech, designing and managing voices, changing recorded voices, creating sound effects and dubbing audio or video into other languages. Its official documentation describes text-to-speech models, a voice library, voice cloning options and dubbing workflows that aim to preserve a speaker's timing and emotional delivery. Exact language support, limits and commercial rights depend on the selected product and plan.",
    bestFor: ["Creating voiceovers and narration from written scripts", "Producing multilingual speech for videos, explainers and accessibility", "Dubbing existing audio or video for different language audiences", "Developing consistent character voices for permitted creative projects", "Generating or editing audio with supported voice and sound tools"],
    workflow: ["Choose the task first: text-to-speech, voice design, voice conversion or dubbing.", "Select a voice and language suited to the audience, then test a short sample.", "Edit punctuation, names and pronunciation to improve delivery.", "For dubbing, review transcripts, speaker assignments, timing and translated meaning.", "Confirm consent, source-audio rights and the current licence before publishing or monetizing."],
    considerations: ["Obtain appropriate consent before cloning or transforming a real person's voice.", "Language support and output quality can vary by model and voice.", "Commercial-use rights and usage limits depend on the current subscription and terms.", "Generated speech and translations need review for pronunciation, accuracy and context."],
    sourceLabel: "ElevenLabs official Text to Speech and Dubbing documentation",
    sourceUrl: "https://elevenlabs.io/docs/overview/capabilities/text-to-speech",
    faq: [
      { question: "What is ElevenLabs used for?", answer: "Its official documentation covers text-to-speech, voice options, voice changing, audio effects and dubbing for audio and video." },
      { question: "Can ElevenLabs dub videos into other languages?", answer: "ElevenLabs documents dubbing workflows for translating audio and video while aiming to preserve speaker timing, tone and emotional delivery. Check current language and plan limits." }
    ]
  },
  "canva-ai": {
    seoTitle: "Canva AI — Magic Studio Design & Content Tools | Anjal AI",
    overview: "Canva is a visual communication and design platform with AI features grouped under Magic Studio. Canva's official Magic Studio announcement describes prompt-assisted design creation, presentation and video generation, design resizing and translation, image editing tools, Magic Media, animation and AI writing assistance. Feature access can vary by product, region and subscription.",
    bestFor: ["Creating social media graphics, posters, presentations and marketing materials", "Turning a written brief or uploaded media into an initial design", "Adapting one design into formats for different channels or languages", "Editing images by moving, expanding or changing selected elements", "Drafting copy and combining text, images and video in one design workflow"],
    workflow: ["Choose the design format and describe the audience, purpose and visual direction.", "Use a Magic Studio feature that matches the task, such as design, writing, image or video.", "Apply brand colors, fonts and approved assets where consistency matters.", "Inspect generated text, image details, layout and translations before sharing.", "Check licensing, team permissions and current plan access for any assets or AI features."],
    considerations: ["Not every Magic Studio feature is included in every Canva plan.", "AI-generated layouts and copy require editing for accuracy, accessibility and brand fit.", "Review content licensing and commercial-use terms for generated and uploaded assets.", "Feature names and availability can change as Canva updates its product."],
    sourceLabel: "Canva official Magic Studio announcement",
    sourceUrl: "https://www.canva.com/en_in/newsroom/news/magic-studio/",
    faq: [
      { question: "What is Canva Magic Studio?", answer: "Canva describes Magic Studio as a collection of AI-powered design and content tools, including design generation, image editing, video, presentations and writing assistance." },
      { question: "Can Canva AI create presentations and videos?", answer: "Canva's Magic Studio announcement describes prompt-assisted presentation creation and Magic Design for Video. Confirm current access and limits in your Canva account." }
    ]
  },
  "suno": {
    seoTitle: "Suno AI — Create Songs, Vocals & Instrumentals | Anjal AI",
    overview: "Suno is an AI music creation service that turns written descriptions into song ideas and generated tracks. Its official AI Music Generator page explains that the Create flow can generate songs with sung vocals and lyrics, or instrumental-only music. Users can continue developing ideas with supported tools such as Studio, Voices, Covers and vocal removal, subject to current account access and rights rules.",
    bestFor: ["Turning a song idea, theme or mood into a musical draft", "Generating songs with vocals and lyrics from a description", "Creating instrumental music for permitted creative projects", "Exploring genre, mood and arrangement variations", "Developing an initial musical idea before editing or production"],
    workflow: ["Write a concise brief describing the theme, mood, genre and intended use.", "Choose vocal or instrumental output and generate a short first version.", "Listen critically and refine the prompt or arrangement one change at a time.", "Use supported editing or continuation features when available to your account.", "Review the current ownership, distribution and commercial-use terms before sharing or monetizing."],
    considerations: ["Generated music may contain artifacts or unexpected similarities; review it before release.", "Commercial rights and ownership conditions can depend on the plan and the terms in effect when content is created.", "Do not upload recordings, lyrics or samples unless you have the rights to use them.", "AI-generated lyrics and vocals should be checked for unintended content and attribution concerns."],
    sourceLabel: "Suno official AI Music Generator",
    sourceUrl: "https://suno.com/tools/ai-music-generator",
    faq: [
      { question: "Can Suno generate songs with vocals?", answer: "Suno's official generator page says its Create flow can produce songs with sung vocals and lyrics, as well as instrumental-only tracks." },
      { question: "Do I need musical training to use Suno?", answer: "Suno says users can describe an idea in ordinary language without musical notation or recording equipment." }
    ]
  },
  "midjourney": {
    seoTitle: "Midjourney — AI Image Generation & Image Editor | Anjal AI",
    overview: "Midjourney is an AI image-generation platform with a web-based workflow for creating and refining images. Its official Editor documentation describes tools for editing both Midjourney creations and uploaded images, including remixing, inpainting, panning, zooming out, resizing and selecting areas to erase or restore. The exact models and editing options can change with product updates.",
    bestFor: ["Generating concept art and visual ideas from text prompts", "Refining an existing generated image with localized edits", "Extending a composition with pan or zoom-out tools", "Adjusting image framing, scale and aspect ratio", "Iterating on a visual concept while preserving selected parts of an image"],
    workflow: ["Describe the subject, composition, style and intended aspect ratio.", "Generate initial concepts and choose the strongest composition.", "Open the Editor to resize, pan, zoom or select areas for inpainting and restoration.", "Compare each edit with the original and check important details such as text, logos and anatomy.", "Review the provider's current terms and rights guidance before using images commercially."],
    considerations: ["Image generation is probabilistic; results may need multiple iterations and manual correction.", "Editing controls and model versions can change; consult current documentation.", "Check current subscription requirements, commercial terms and rules for uploaded images.", "Use reference images only when you have permission and avoid misleading depictions of real people."],
    sourceLabel: "Midjourney official Editor documentation",
    sourceUrl: "https://docs.midjourney.com/hc/en-us/articles/32764383466893-Editor",
    faq: [
      { question: "Can Midjourney edit an image I already have?", answer: "Midjourney's Editor documentation describes editing Midjourney images and personal images with tools such as inpainting, pan and zoom out." },
      { question: "What can the Midjourney Editor change?", answer: "The documented controls include moving and resizing the image, changing aspect ratio, erasing or restoring selected areas, remixing, panning and zooming out." }
    ]
  }
});

const profileDescriptions = {
  "chatpdf": "Explore ChatPDF for cited PDF answers, document summaries, multi-file chats and multilingual reading.",
  "askyourpdf": "Explore AskYourPDF for cited document chat, OCR, multi-PDF research, data extraction and PDF workflows.",
  "humata": "Explore Humata AI for cited document Q&A, research summaries and shared team knowledge bases.",
  "pdf-ai": "Explore PDF.ai for PDF chat, structured extraction, OCR parsing and developer document APIs.",
  "documind": "Explore Documind for multi-PDF chat, document summaries, study notes and shareable knowledge-base chatbots.",
  "doclime": "Explore DocLime for AI PDF chat, research-paper Q&A, document navigation and note-taking.",
  "descript": "Explore Descript for transcript-based audio and video editing, recording, speech cleanup and AI-assisted production.",
  "adobe-podcast": "Explore Adobe Podcast for AI speech enhancement, podcast recording, transcription and browser-based audio editing.",
  "aiva": "Explore AIVA for AI music composition, customizable styles, audio and MIDI references, and plan-based licensing.",
  "mubert": "Explore Mubert for prompt-based music generation, adaptive streaming and licensed music APIs for apps.",
  "soundraw": "Explore SOUNDRAW for customizable AI background music, track editing, stems and creator licensing.",
  "lalal-ai": "Explore LALAL.AI for AI vocal removal, instrument stem separation, voice cleaning and audio editing.",
  "poe": "Explore Poe AI to compare multiple models, use specialist bots and create custom AI chatbots.",
  "grok": "Explore Grok AI from xAI for conversational assistance, web and X search, coding and creative tools.",
  "microsoft-copilot": "Explore Microsoft Copilot for AI chat, web-grounded answers and supported Microsoft 365 workflows.",
  "make": "Explore Make.com for visual workflow automation, app integrations, AI-powered scenarios and business process orchestration.",
  "perplexity": "Explore Perplexity AI for cited web search, Pro Search, Deep Research, Computer workflows and developer APIs.",
  "perplexity-ai": "Perplexity AI is the same product as the primary Perplexity listing; this legacy URL is consolidated there.",
  "google-veo": "Explore Google Veo for text-to-video, image-to-video, audio-video generation and cinematic creative workflows.",
  "heygen": "Explore HeyGen for AI avatar videos, script-to-video creation, voice cloning and multilingual video translation.",
  "synthesia": "Explore Synthesia for AI presenter videos, business training, localization, voiceovers and video APIs.",
  "pika": "Explore Pika for AI video creation, keyframe animation, creative effects, image editing and generated sound.",
  "kling-ai": "Explore Kling AI for text-to-video, image-to-video, motion control, avatars and reference-guided storytelling.",
  "luma-dream-machine": "Explore Luma Ray video generation, keyframe direction, footage modification, reframing and HDR workflows.",
  "sora": "Sora is discontinued: OpenAI ended the web and app experience in April 2026 and the API in September 2026.",
  "groq": "Explore GroqCloud for hosted AI inference, supported models, developer APIs and fast application workflows.",
  "meta-llama": "Explore Meta Llama models, developer guides, deployment options, model cards and license information.",
  "cohere": "Explore Cohere AI models for enterprise chat, retrieval-augmented generation, embeddings, reranking and document parsing.",
  "amazon-q": "Explore Amazon Q Business and Developer for enterprise knowledge, software development and AWS workflows.",
  "ibm-watsonx": "Explore IBM watsonx for enterprise AI application development, data workflows and model governance.",
  "manus": "Explore Manus AI for multi-step research, browser tasks, app creation, automations and connected workflows.",
  "ideogram": "Explore Ideogram AI for text-rich images, posters, reference editing, transparent assets and design workflows.",
  "adobe-firefly": "Explore Adobe Firefly for AI image, video, audio and vector creation with integrated creative editing tools.",
  "leonardo-ai": "Explore Leonardo AI for image generation, reference guidance, Canvas editing, upscaling and creative workflows.",
  "stable-diffusion": "Explore Stable Diffusion models for text-to-image generation, self-hosting, APIs and customizable AI art workflows.",
  "flux": "Explore Black Forest Labs FLUX models for text-to-image generation, reference editing and developer APIs.",
  "recraft": "Explore Recraft AI for editable vector graphics, image generation, mockups, icons and brand design assets.",
  "mistral-le-chat": "Explore Mistral Vibe, formerly Le Chat, for AI chat, web search, productivity and coding-agent workflows.",
  "character-ai": "Explore Character.AI to create fictional AI characters, design greetings and build interactive role-play chats.",
  "kimi": "Explore Kimi AI for web-connected search, deep research, document analysis and multi-step agent workflows.",
  "elicit": "Explore Elicit's AI Research Agent for academic paper search, evidence extraction and literature review workflows.",
  "consensus": "Explore Consensus AI for scholarly search, citation-backed answers, study comparisons and Deep Reviews.",
  "qwen": "Explore Alibaba Qwen for multimodal AI chat, coding, reasoning, open models and developer APIs.",
  "notebooklm": "Explore NotebookLM for source-grounded research, document summaries, study notes and AI Audio Overviews.",
  "google-gemini": "Explore Google Gemini for AI assistance, research, file analysis and creating or editing documents and PDFs.",
  "meta-ai": "Explore Meta AI for chat, writing, image creation, deeper research and assistance across supported Meta apps.",
  "github-copilot": "Explore GitHub Copilot for code suggestions, repository questions, code review and AI coding-agent workflows.",
  "hugging-face-community": "Explore Hugging Face Hub for AI models, datasets, Spaces demos, model cards and developer tools.",
  "runway": "Explore Runway AI for text-to-video, image-to-video generation and controllable creative video workflows.",
  "claude": "Explore Claude for AI writing, analysis, coding, file workflows, web research and editable work.",
  "cursor": "Explore Cursor's AI code editor and Agent for codebase search, multi-file edits, tests and debugging.",
  "elevenlabs": "Explore ElevenLabs AI voice generation, text to speech, voice tools and multilingual dubbing.",
  "canva-ai": "Explore Canva Magic Studio AI tools for designs, presentations, image editing, video and writing.",
  "suno": "Explore Suno AI music creation for songs with vocals and lyrics or instrumental tracks.",
  "midjourney": "Explore Midjourney AI image generation and its web Editor for inpainting, pan, zoom and image refinement.",
  "openrouter": "Explore OpenRouter's unified API for accessing and routing requests across multiple AI model providers.",
  "word-spinner": "Review Word Spinner's AI rewriting, grammar, summarizing and translation tools, plus responsible editing tips.",
  "basmo": "Discover Basmo's reading tracker, book notes and AI-assisted ways to explore and revisit ideas.",
  "switchboard-ai": "Explore Switchboard Canvas for template-based image generation, batch outputs and API workflows.",
  "you-com": "Explore You.com's AI search, answer, extract, research and inference APIs for agent workflows.",
  "deepseek": "Learn about DeepSeek chat and model APIs, including supported search, file input and URL-reading features.",
  "prowritingaid": "Compare ProWritingAid's grammar checks, writing reports, rephrasing and long-form story feedback.",
  "spinbot": "Review SpinBot's online paraphrasing and grammar tools, plus guidance for responsible text revision.",
  "udio": "Explore Udio's AI music generation, prompt-based song creation, lyrics and audio editing workflows.",
  "subpals": "Explore SubPals' YouTube creator tools for ideas, scripts, metadata and subscribe links.",
  "digital-first-ai": "Digital First AI is now DFIRST AI, a creative workspace for brand campaigns, content and visual production.",
  "chatiq": "Explore ChatIQ's AI customer-support chatbot, company knowledge base and automated ticketing workflow.",
  "surfer-ai": "Explore Surfer's SEO and AI search visibility platform, including Content Editor, Surfer AI, Topical Map, Content Audit and AI Tracker."
};
const titleOverrides = {
  "openrouter": "OpenRouter — Multi-Model AI API | Anjal AI",
  "word-spinner": "Word Spinner — AI Rewriting Tool | Anjal AI",
  "basmo": "Basmo — AI Reading Companion | Anjal AI",
  "switchboard-ai": "Switchboard Canvas — Image Generation API | Anjal AI",
  "you-com": "You.com — AI Search & Inference APIs | Anjal AI",
  "deepseek": "DeepSeek — AI Chat & Models | Anjal AI",
  "prowritingaid": "ProWritingAid — AI Writing Editor | Anjal AI",
  "spinbot": "SpinBot — AI Paraphrasing Tool | Anjal AI",
  "udio": "Udio — AI Music Generator | Anjal AI",
  "subpals": "SubPals — YouTube Creator Tools | Anjal AI",
  "digital-first-ai": "DFIRST AI (formerly Digital First AI) | Anjal AI",
  "chatiq": "ChatIQ — AI Customer Support Chatbot | Anjal AI"
};
const categoryToolLabels = {
  "ai-assistants": "AI Assistant",
  "image-generation": "Image Generation",
  "video-generation": "Video Generation",
  "audio-music": "Audio & Music",
  "writing": "Writing",
  "coding": "Coding",
  "design": "Design",
  "productivity": "Productivity",
  "marketing": "Marketing",
  "education": "Education",
  "research": "Research",
  "other": "AI"
};
const nonIndexableSlugs = new Set(["atonce","experai","cheatography"]);
const listingNotices = {
  "atonce": "The listed official website returned a not-found response during the latest review. Anjal AI could not verify a current product, features or availability. This entry is retained for reference only and is excluded from search indexing until the provider information can be confirmed.",
  "experai": "The listed official domain currently provides no readable product information, and the earlier AI-expert listing could not be verified as an active product. Anjal AI is not making current feature or availability claims; this entry is excluded from search indexing pending verification.",
  "cheatography": "Cheatography is a community resource for creating and sharing quick-reference sheets. Its provider describes it as a cheat-sheet library, not an AI product. Because Anjal AI focuses on AI tools, this reference listing is excluded from search indexing."
};
const listingDescriptions = {
  "atonce": "This directory entry is under review because its listed official website could not be verified.",
  "experai": "This directory entry is under review because current product details and availability could not be verified.",
  "cheatography": "This is a reference-sheet resource rather than a verified AI product; the listing is retained for reference only."
};

for (const tool of catalog) {
  const category = categoryForTool(tool);
  const categoryName = categoryNames[category] || "Other";
  const categoryToolLabel = categoryToolLabels[category] || categoryName;
  const canonical = tool.slug === "perplexity-ai" ? `${origin}/tool/perplexity` : `${origin}/tool/${tool.slug}`;
  const profile = curatedToolProfiles[tool.slug] || (tool.slug === "perplexity-ai" ? curatedToolProfiles.perplexity : null) || (tool.name.toLowerCase() === "chatgpt" ? curatedToolProfiles.chatgpt : null);
  const rawTitle = `${tool.name} — ${categoryToolLabel} Tool | Anjal AI`;
  const title = titleOverrides[tool.slug] || profile?.seoTitle || (tool.slug === "perplexity" ? "Perplexity AI: Features, Uses & Free Search | Anjal AI" : rawTitle.length <= 60 ? rawTitle : `${tool.name} — AI Tool | Anjal AI`);
  const description = listingDescriptions[tool.slug] || profileDescriptions[tool.slug] || (tool.slug === "perplexity" ? "Explore Perplexity AI for cited web research, source checking and follow-up questions. Compare use cases, limitations and official plan details." : `${tool.name} is an AI tool listed in Anjal AI under ${categoryName}. Explore its official website, category and directory information.`);
  const related = catalog.filter(x => x.slug !== tool.slug && categoryForTool(x) === category).slice(0, 8);
  const relatedLinks = related.map(x => `<li><a href="/tool/${encodeURIComponent(x.slug)}">${escapeHtml(x.name)}</a></li>`).join("");
  const profileSections = profile ? `<section><h2>About ${escapeHtml(tool.name)}</h2><p>${escapeHtml(profile.overview)}</p></section>
<section><h2>What people use it for</h2><ul>${profile.bestFor.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
<section><h2>A practical way to evaluate it</h2><ol>${profile.workflow.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>
<section><h2>Things to check before relying on it</h2><ul>${profile.considerations.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
${profile.faq ? `<section><h2>Frequently asked questions about ${escapeHtml(tool.name)}</h2>${profile.faq.map(item => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join("")}</section>` : ""}
<section><h2>Official product information</h2><p>Confirm current features, availability and terms with the provider: <a href="${escapeHtml(profile.sourceUrl)}" rel="nofollow noopener">${escapeHtml(profile.sourceLabel)}</a>${profile.planGuideUrl ? ` and <a href="${escapeHtml(profile.planGuideUrl)}" rel="nofollow noopener">its official plan guide</a>` : ""}.</p></section>` : "";;
  const body = `<main><nav><a href="/">AI Tools</a> → <a href="/category/${category}">${escapeHtml(categoryName)}</a> → <strong>${escapeHtml(tool.name)}</strong></nav><h1>${escapeHtml(tool.name)}</h1><p>${escapeHtml(description)}</p>${profileSections}${listingNotices[tool.slug] ? `<section><h2>Listing status</h2><p>${escapeHtml(listingNotices[tool.slug])}</p></section>` : ""}<h2>Directory profile</h2><ul><li>Category: <a href="/category/${category}">${escapeHtml(categoryName)}</a></li><li>Platform: Web</li><li>Official website: <a href="${escapeHtml(tool.website)}" rel="nofollow">${escapeHtml(tool.name)}</a></li><li>Commercial details: not verified unless explicitly marked.</li></ul><h2>Related AI tools</h2><ul>${relatedLinks}</ul><p><a href="/finder">Use AI Tool Finder</a> · <a href="/">Browse all 1000 AI tools</a></p></main>`;
  const jsonLd = {"@context":"https://schema.org","@type":"SoftwareApplication",name:tool.name,description,url:tool.website,applicationCategory:categoryName,operatingSystem:"Web",isPartOf:{"@type":"WebSite",name:"Anjal AI",url:origin},mainEntityOfPage:{"@type":"WebPage","@id":canonical},sameAs:[tool.website]};
  const out = path.join(dist, "tool", tool.slug, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render({title,description,canonical,body,jsonLd,robots:nonIndexableSlugs.has(tool.slug) ? "noindex,follow" : undefined}));
}



/* Give the public submission page its own crawlable content instead of the SPA homepage fallback. */
const submitTitle = "Submit an AI Tool to Anjal AI | Directory Listing Review";
const submitDescription = "Suggest an AI product for the Anjal AI directory. Share its official website, category and a clear description for editorial review.";
const submitBody = `<main><nav><a href="/">Anjal AI</a> → <strong>Submit an AI tool</strong></nav>
<h1>Submit an AI tool to Anjal AI</h1>
<p>Know an AI product that should be easier to discover? Suggest it for review in the Anjal AI directory. The submission form collects the product name, official website, primary category and a short description so the directory team can assess whether the listing is useful and accurate.</p>
<section><h2>What to include in a submission</h2><ul>
<li><strong>Product name:</strong> Use the name shown by the product's own provider.</li>
<li><strong>Official website:</strong> Provide the direct HTTPS website, not an affiliate redirect or an unrelated download page.</li>
<li><strong>Primary category:</strong> Choose the task the product is mainly designed to support, such as writing, coding, research, design, education, marketing, image, video or audio creation.</li>
<li><strong>Clear description:</strong> Explain what the product does and who may find it useful. Avoid unsupported pricing, ratings or feature claims.</li>
<li><strong>Contact email (optional):</strong> Add an address only if you want the reviewer to be able to ask a follow-up question.</li>
</ul></section>
<section><h2>How the review works</h2><ol><li>Send the product details through the submission form.</li><li>The directory team reviews the official website and checks whether the product fits the directory.</li><li>Incomplete, duplicate, misleading or unverifiable submissions may be declined or edited.</li><li>Approval is not guaranteed, and a submission does not guarantee a particular ranking or placement.</li></ol></section>
<section><h2>Before you submit</h2><p>Only submit information you are authorized to share. Do not include passwords, payment details, confidential customer data or sensitive personal information. Product features, free plans and pricing can change, so the directory avoids presenting commercial details as verified unless reliable evidence is available.</p><p>Read the <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Use</a> before sending information.</p></section>
<section><h2>What makes a useful listing?</h2><p>A strong directory entry helps visitors understand the product without relying on marketing slogans. Explain the main task it performs, the type of user it serves, the inputs it accepts and the output it produces. If the product has important limitations, supported languages, platform requirements or a public documentation page, include those details so the review can be more accurate.</p></section>
<section><h2>Frequently asked questions</h2><h3>Can I submit a tool that is still in beta?</h3><p>Yes. Make the beta status clear and link to the provider's official page so reviewers can verify availability and access requirements.</p><h3>Can I submit an alternative to a tool already listed?</h3><p>Yes, if it is a distinct product with its own official website and useful capabilities. Duplicate URLs or minor name variations may be combined with an existing entry.</p><h3>Can I request an edit after submission?</h3><p>Use the available contact or claim process and identify the listing and the exact information that needs correction. Include a reliable source for the change.</p></section>
<p><a href="/">Browse the AI tools directory</a> · <a href="/finder">Find an AI tool</a></p></main>`;
const submitJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:submitTitle,description:submitDescription,url:`${origin}/submit`,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
const submitOut = path.join(dist, "submit", "index.html");
fs.mkdirSync(path.dirname(submitOut), { recursive: true });
fs.writeFileSync(submitOut, render({title:submitTitle,description:submitDescription,canonical:`${origin}/submit`,body:submitBody,jsonLd:submitJsonLd}));

/* Claim and outbound-redirect routes are functional utility pages, not search landing pages.
   Give each one a route-specific noindex document and self-canonical instead of homepage HTML. */
for (const tool of catalog) {
  const claimCanonical = `${origin}/claim/${encodeURIComponent(tool.slug)}`;
  const claimTitle = `Claim ${tool.name} Listing | Anjal AI`;
  const claimDescription = `Request an ownership review for the ${tool.name} listing in the Anjal AI directory.`;
  const claimBody = `<main><nav><a href="/">Anjal AI</a> → <a href="/tool/${encodeURIComponent(tool.slug)}">${escapeHtml(tool.name)}</a> → <strong>Claim listing</strong></nav>
<h1>Claim the ${escapeHtml(tool.name)} listing</h1>
<p>This page is for a person authorized to represent ${escapeHtml(tool.name)} who wants to request a correction or update to its Anjal AI directory listing.</p>
<section><h2>How listing claims are reviewed</h2><p>Provide a business contact, your role and a clear explanation of the requested change. The directory may verify ownership using the official product website or other reliable evidence before making changes. Submitting a claim does not guarantee approval, publication, a particular placement or a response time.</p></section>
<p>Review the <a href="/privacy">Privacy Policy</a> before sending contact details. Visit the <a href="/tool/${encodeURIComponent(tool.slug)}">public ${escapeHtml(tool.name)} directory profile</a> or its <a href="${escapeHtml(tool.website)}" rel="nofollow noopener">official website</a>.</p></main>`;
  const claimJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:claimTitle,description:claimDescription,url:claimCanonical,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
  const claimOut = path.join(dist, "claim", tool.slug, "index.html");
  fs.mkdirSync(path.dirname(claimOut), { recursive: true });
  fs.writeFileSync(claimOut, render({title:claimTitle,description:claimDescription,canonical:claimCanonical,body:claimBody,jsonLd:claimJsonLd,robots:"noindex,follow"}));

  const goCanonical = `${origin}/go/${encodeURIComponent(tool.slug)}`;
  const goTitle = `Opening ${tool.name} Official Website | Anjal AI`;
  const goDescription = `Continue to the official ${tool.name} website from the Anjal AI directory.`;
  const goBody = `<main><nav><a href="/">Anjal AI</a> → <a href="/tool/${encodeURIComponent(tool.slug)}">${escapeHtml(tool.name)}</a> → <strong>Official website</strong></nav>
<h1>Continue to ${escapeHtml(tool.name)}</h1>
<p>You are leaving the Anjal AI directory to visit the product provider's official website.</p>
<p><a href="${escapeHtml(tool.website)}" rel="nofollow noopener">Continue to ${escapeHtml(tool.name)} official website</a></p>
<p><a href="/tool/${encodeURIComponent(tool.slug)}">Return to the Anjal AI listing</a></p></main>`;
  const goJsonLd = {"@context":"https://schema.org","@type":"WebPage",name:goTitle,description:goDescription,url:goCanonical,isPartOf:{"@type":"WebSite",name:"Anjal AI",url:`${origin}/`}};
  const goOut = path.join(dist, "go", tool.slug, "index.html");
  fs.mkdirSync(path.dirname(goOut), { recursive: true });
  fs.writeFileSync(goOut, render({title:goTitle,description:goDescription,canonical:goCanonical,body:goBody,jsonLd:goJsonLd,robots:"noindex,follow"}));
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
