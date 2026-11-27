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
  "productivity": "<section><h2>How to choose an AI productivity tool</h2><p>Productivity tools can help organize tasks, summarize information, automate repetitive work, manage meetings or connect business applications. Choose based on the workflow you want to improve, not the number of AI features on a product page.</p><h2>What to compare</h2><ul><li><strong>Workflow fit:</strong> Identify the exact repetitive task and the people involved.</li><li><strong>Integrations:</strong> Confirm that the apps, calendars, files and databases you use are supported.</li><li><strong>Automation control:</strong> Check approval steps, error handling, logs and the ability to undo changes.</li><li><strong>Reliability:</strong> Test what happens when an app is unavailable or data is missing.</li><li><strong>Security:</strong> Review permissions, data retention and access controls for connected accounts.</li><li><strong>Cost:</strong> Compare task, credit, user and API limits at the scale you expect.</li></ul><h2>A practical automation workflow</h2><ol><li>Map the current process from trigger to outcome.</li><li>Start with a small test using non-sensitive data.</li><li>Require human approval for payments, external messages or important record changes.</li><li>Test failure cases and monitor each run.</li><li>Document ownership and a manual fallback before depending on automation.</li></ol></section><section><h2>Measure whether automation helps</h2><p>Compare the time, error rate and handoff quality of the original process with the automated version. Keep a manual fallback for outages, and make sure someone owns the workflow when integrations or permissions change. For actions that send external messages, alter customer records or spend money, add explicit approval and an audit trail.</p></section>",
  "research": "<section><h2>How to choose an AI research tool</h2><p>Research assistants can search the web, read documents, compare sources, summarize findings or produce longer reports. Their value depends on the quality of the sources and how clearly they show where claims came from. Choose a tool that matches the depth and evidence standard of your research.</p><h2>What to evaluate</h2><ul><li><strong>Source coverage:</strong> Check whether it searches the open web, selected databases, uploaded files or a defined corpus.</li><li><strong>Citations:</strong> Open links and confirm that each source supports the sentence it is attached to.</li><li><strong>Freshness:</strong> Check publication dates and whether the tool can distinguish current information from older material.</li><li><strong>Research depth:</strong> Compare quick answers with multi-step research, document extraction and report exports.</li><li><strong>Transparency:</strong> Look for source lists, quotes, uncertainty and a way to inspect the underlying material.</li><li><strong>Privacy:</strong> Review how uploaded documents and queries are handled.</li></ul><h2>A reliable research workflow</h2><ol><li>Turn the topic into a specific question and define the time period.</li><li>Ask for a source list before requesting a final summary.</li><li>Prioritize primary sources, official documents and original research.</li><li>Compare conflicting claims and record what remains uncertain.</li><li>Keep citations and notes so another person can reproduce the work.</li></ol></section><section><h2>Keep a reproducible research trail</h2><p>Record the exact question, date searched, source URLs and any filters used. Separate primary evidence from commentary, and do not treat a generated citation as proof until you open the linked page. For business, health, legal or financial topics, confirm conclusions with authoritative sources and qualified professionals.</p></section>",
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
    overview: "Make is a visual automation platform for connecting apps, data sources and AI models into repeatable workflows. Users can build scenarios with a drag-and-drop canvas, describe an automation in natural language, or start from an AI chat and refine the result visually. It is designed for individuals and teams that want to coordinate work across connected services without writing every integration from scratch.",
    bestFor: ["Connecting business apps so information moves between them automatically", "Automating repetitive steps such as lead routing, notifications and data updates", "Building workflows that include AI models alongside ordinary app actions", "Making multi-step processes visible so teams can inspect how each run behaves"],
    workflow: ["Write down the trigger, the information that enters the workflow and the final outcome you want.", "Search Make's integration catalogue for the apps involved and confirm the actions each connector supports.", "Build a small scenario with one trigger and one action before adding branches or AI steps.", "Test normal, missing-data and failure cases; inspect each module's input and output.", "Add error handling, usage monitoring and access controls before relying on the workflow in production."],
    considerations: ["A visual builder still requires careful logic: incorrect filters or mappings can send or change the wrong data.", "Usage is measured through plan-specific credits and limits; check current pricing and quotas before scaling.", "Some apps or actions may require custom API connections, permissions or paid plans.", "Review data access, retention and security requirements before connecting business or customer information."],
    sourceLabel: "Make official platform overview",
    sourceUrl: "https://www.make.com/"
  },
  poe: {
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
    "sourceUrl": "https://spinbot.com/paraphrasing-tool"
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

const profileDescriptions = {
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
  "chatiq": "Explore ChatIQ's AI customer-support chatbot, company knowledge base and automated ticketing workflow."
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
  const canonical = `${origin}/tool/${tool.slug}`;
  const profile = curatedToolProfiles[tool.slug] || (tool.name.toLowerCase() === "chatgpt" ? curatedToolProfiles.chatgpt : null);
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
  fs.writeFileSync(claimOut, render({title:claimTitle,description:claimDescription,canonical:claimCanonical,body:claimBody,jsonLd:claimJsonLd,robots:"noindex,nofollow"}));

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
  fs.writeFileSync(goOut, render({title:goTitle,description:goDescription,canonical:goCanonical,body:goBody,jsonLd:goJsonLd,robots:"noindex,nofollow"}));
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
