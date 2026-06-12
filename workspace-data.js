// === ID helper ===
let _idCounter = 0;
const nid = () => `b_${Date.now().toString(36)}_${(_idCounter++).toString(36)}`;
window.nid = nid;

// === Launch plan weeks (XALT pre-launch checklist) ===
const XALT_WEEKS = [
  { id:"w1", week:"Week 1", dates:"May 13–17", title:"Ignition",
    milestone:"Foundations locked — accounts live, OEM briefed, filming starts tomorrow.",
    targets:["OEM production confirmed","All social accounts created","First Reels filmed"],
    tasks:[
      {cat:"Product",text:"Brief OEM — confirm production start date, MOQ & batch timeline for launch"},
      {cat:"Product",text:"Lock final formulation sign-off on Daily & Focus SKUs"},
      {cat:"Design",text:"Brief freelance designer: packaging dieline & brand assets"},
      {cat:"Design",text:"Lock brand kit: logo, color palette, typography, sachet mockup files"},
      {cat:"Design",text:"Create Canva / Figma templates for Reels, Stories & carousels"},
      {cat:"Content",text:"Film first 3 Reels — 1x lifestyle, 1x BTS, 1x education"},
      {cat:"Content",text:"Write 4-week content calendar with daily posting slots"},
      {cat:"Content",text:"Set up Instagram — full bio, link, story highlights, pinned post"},
      {cat:"Content",text:"Set up Xiaohongshu (XHS) — full profile, first post drafted"},
      {cat:"Content",text:"Set up LinkedIn — brand page + founder profile optimized"},
      {cat:"Distribution",text:"Research Shopee & Lazada seller account requirements"},
      {cat:"Distribution",text:"List 10 target KL corporate offices / co-working spaces for B2B pipeline"},
    ]},
  { id:"w2", week:"Week 2", dates:"May 18–24", title:"Go Live",
    milestone:"First post published. Waitlist page live. Email system active.",
    targets:["First Reel published this weekend","Waitlist landing page live","Email capture running"],
    tasks:[
      {cat:"Content",text:"PUBLISH first Reel this Saturday — schedule in advance"},
      {cat:"Content",text:"Begin 3–5 Stories/day from today — no missed days until launch"},
      {cat:"Content",text:"Batch-film Week 2 Reels (3x) + shoot carousel assets"},
      {cat:"Marketing",text:"Build waitlist landing page (Carrd / Webflow) with email opt-in CTA"},
      {cat:"Marketing",text:"Set up Klaviyo / Mailchimp — 5-email welcome nurture sequence"},
      {cat:"Marketing",text:"Create lead magnet: '7-Day Hydration Guide' PDF"},
      {cat:"Design",text:"Complete packaging dieline — send to OEM for print approval"},
      {cat:"Design",text:"Design sachet box mockup for use in content shoots"},
      {cat:"Distribution",text:"Open Shopee seller account + complete KYC verification"},
      {cat:"Distribution",text:"Map fulfillment workflow: OEM → storage → courier → customer"},
      {cat:"Community",text:"Manually engage 20 target accounts/day"},
      {cat:"Influencer",text:"Send first 30 nano-influencer DMs — track in Google Sheet"},
    ]},
  { id:"w3", week:"Week 3", dates:"May 25–31", title:"Build Momentum",
    milestone:"200 followers. 500 waitlist signups. Content rhythm fully locked.",
    targets:["200 IG followers","500 waitlist emails","10 influencer conversations active"],
    tasks:[
      {cat:"Content",text:"Maintain 3 Reels + 1 carousel + daily Stories — zero missed days"},
      {cat:"Content",text:"Post first educational carousel: '6 Electrolytes Your Body Needs Daily'"},
      {cat:"Content",text:"Film founder BTS content: OEM factory visit or formulation story"},
      {cat:"Influencer",text:"Confirm first 5 nano-influencer partnerships (gifting-only, no fees)"},
      {cat:"Influencer",text:"Prepare influencer gifting kits: product + handwritten card + brief"},
      {cat:"Marketing",text:"Activate first Meta paid ad: waitlist capture (RM 300–500 test budget)"},
      {cat:"Marketing",text:"Install Meta Pixel on waitlist landing page"},
      {cat:"Distribution",text:"Begin building Shopee store: banners, categories, listing templates"},
      {cat:"Distribution",text:"Research 3PL options vs self-ship — decide and confirm model"},
      {cat:"Design",text:"Packaging: incorporate OEM feedback, finalize print-ready files"},
      {cat:"B2B",text:"Draft 1-page B2B corporate wellness pitch deck"},
      {cat:"B2B",text:"Identify 20 target companies: co-working spaces, law firms, banks, gyms"},
    ]},
  { id:"w4", week:"Week 4", dates:"Jun 1–7", title:"Amplify",
    milestone:"500 followers. 1.5K waitlist. Influencer samples dispatched.",
    targets:["500 combined IG + XHS followers","1,500 waitlist emails","Samples shipped to 10 influencers"],
    tasks:[
      {cat:"Content",text:"Publish first 'Build in Public' post — founder story, why XALT exists"},
      {cat:"Content",text:"Cross-post best-performing Reels to XHS with localized captions"},
      {cat:"Content",text:"Begin LinkedIn founder posts: 2–3/week cadence"},
      {cat:"Influencer",text:"Ship product samples to all confirmed nano-influencer partners"},
      {cat:"Influencer",text:"DM 10 micro-influencer (10K–100K) prospects in wellness/run niches"},
      {cat:"Marketing",text:"Review Meta ad Week 1 results — scale winners, kill losers"},
      {cat:"Marketing",text:"Boost top XHS lifestyle post with paid promotion"},
      {cat:"Distribution",text:"Shopee store product listings drafted (not public yet)"},
      {cat:"Distribution",text:"Set up courier accounts: J&T / Ninja Van / Poslaju — compare rates"},
      {cat:"Community",text:"Outreach to 5 KL run clubs for collab / co-content"},
      {cat:"Community",text:"Outreach to 5 yoga / pilates studios for event partnership"},
      {cat:"AI Systems",text:"Build AI content agent: Claude/GPT API → weekly brief automation"},
    ]},
  { id:"w5", week:"Week 5", dates:"Jun 8–14", title:"Proof of Traction",
    milestone:"1K followers. 3K waitlist. First influencer review content live.",
    targets:["1K IG followers","3K waitlist","1 influencer review post live"],
    tasks:[
      {cat:"Product",text:"Check in with OEM — confirm production is on track vs timeline"},
      {cat:"Product",text:"Draft QC checklist for when production batch arrives"},
      {cat:"Design",text:"Product photography shoot: flat lay, lifestyle, desk setup, gym bag"},
      {cat:"Design",text:"Design launch week countdown graphics & visual templates"},
      {cat:"Content",text:"Publish first UGC repost from influencer or early community member"},
      {cat:"Content",text:"Film ingredient deep-dive Reel series: Vitamin B6, Magnesium, Electrolytes"},
      {cat:"E-Commerce",text:"Build DTC website skeleton: product page, about, FAQ, contact"},
      {cat:"E-Commerce",text:"Set up Shopify / WooCommerce with checkout + Klaviyo integration"},
      {cat:"B2B",text:"Send first 10 B2B cold outreach emails to corporate wellness targets"},
      {cat:"B2B",text:"Set up HubSpot (free) CRM for B2B pipeline tracking"},
      {cat:"Distribution",text:"Confirm delivery packaging: outer box, tape, inserts, unboxing"},
      {cat:"Distribution",text:"Map pre-order fulfillment flow for launch day surge orders"},
    ]},
  { id:"w6", week:"Week 6", dates:"Jun 15–21", title:"Mid-Point Check",
    milestone:"2K followers. 4K waitlist. Launch event venue confirmed.",
    targets:["2K IG followers","4K waitlist","Launch event venue locked"],
    tasks:[
      {cat:"Launch Event",text:"Confirm launch event venue (gym, studio, co-working, F&B)"},
      {cat:"Launch Event",text:"Plan launch day activations: tasting station, photo moment, sign-ups"},
      {cat:"Launch Event",text:"Identify 3–5 community partners to co-host or co-promote"},
      {cat:"Design",text:"Design event collaterals: banner, backdrop, table cards, tote bags"},
      {cat:"Design",text:"Finalize launch week social ad creatives and grid reveal plan"},
      {cat:"Content",text:"Begin launch countdown Stories series: '8 weeks to XALT'"},
      {cat:"Content",text:"Create cornerstone 'What is XALT?' brand explainer Reel"},
      {cat:"E-Commerce",text:"DTC website first draft complete — copy, images, brand story"},
      {cat:"E-Commerce",text:"Shopee store fully optimized: keywords, pricing, bundles, vouchers"},
      {cat:"Marketing",text:"Email list review: target 2K+ — optimize open rates"},
      {cat:"Marketing",text:"Plan full launch week email sequence: teaser → D-day → D+3"},
      {cat:"Influencer",text:"Follow up with influencers who received samples — confirm post dates"},
    ]},
  { id:"w7", week:"Week 7", dates:"Jun 22–28", title:"Hype Engine ON",
    milestone:"3K followers. 5K waitlist. First hero review video live.",
    targets:["3K followers","5K waitlist","1 hero review video live"],
    tasks:[
      {cat:"Influencer",text:"First influencer hero review / unboxing video MUST be live this week"},
      {cat:"Content",text:"Launch 'XALT Ritual' content series: morning, gym, desk, travel"},
      {cat:"Content",text:"Begin weekly Instagram Lives: Q&A or BTS"},
      {cat:"Product",text:"First production batch QC — confirm quality, count, sachets integrity"},
      {cat:"Product",text:"Verify inventory count vs launch target (need 900+ boxes minimum)"},
      {cat:"Distribution",text:"Test full DTC order flow: checkout → payment → confirmation → fulfilment"},
      {cat:"Distribution",text:"Test Shopee order flow end-to-end"},
      {cat:"Launch Event",text:"Event invitations sent to community partners, influencers, press"},
      {cat:"Launch Event",text:"Early-bird offer confirmed: 15% off for waitlist members"},
      {cat:"Marketing",text:"Scale Meta ads to RM 1,500–2,000/month — focus on waitlist & lookalikes"},
      {cat:"AI Systems",text:"Set up AI B2B outreach agent via Clay.com + LinkedIn Sales Navigator"},
      {cat:"B2B",text:"Follow up all 10 B2B leads — aim for 3 confirmed interest calls"},
    ]},
  { id:"w8", week:"Week 8", dates:"Jun 29 – Jul 5", title:"Pre-Launch Locked",
    milestone:"4K followers. 7K waitlist. DTC website fully live and tested.",
    targets:["4K followers","7K waitlist","Website live & tested","Subscription option live"],
    tasks:[
      {cat:"E-Commerce",text:"DTC website 100% complete — all pages live, checkout tested"},
      {cat:"E-Commerce",text:"Subscription option live on DTC site (10–15% recurring discount)"},
      {cat:"E-Commerce",text:"Google Analytics 4 + Meta Pixel installed and verified"},
      {cat:"Design",text:"Launch day visual assets finalized — IG grid reveal sequence locked"},
      {cat:"Design",text:"Product insert cards designed and sent to printer"},
      {cat:"Content",text:"Film launch teaser content — mysterious, hype-building"},
      {cat:"Content",text:"Batch-create 2 weeks of Stories for launch period"},
      {cat:"Distribution",text:"Confirm courier / 3PL readiness for launch week volume"},
      {cat:"Distribution",text:"Plan 10% stock buffer above launch forecast"},
      {cat:"Marketing",text:"Draft all 5 launch week emails — send to founder for final approval"},
      {cat:"Community",text:"Run club + yoga studio partnerships confirmed"},
      {cat:"AI Systems",text:"Deploy AI customer support chatbot on website + Shopee"},
    ]},
  { id:"w9", week:"Week 9", dates:"Jul 6–12", title:"Final Assembly",
    milestone:"5K followers. 8.5K waitlist. Inventory received. All systems tested.",
    targets:["5K followers","8.5K waitlist","Full inventory received & QC'd","Order flow fully tested"],
    tasks:[
      {cat:"Product",text:"Launch inventory physically received and counted"},
      {cat:"Product",text:"Full packaging QC complete — boxes, inserts, sachets all verified"},
      {cat:"Design",text:"All launch day creative assets exported, organized in shared folder"},
      {cat:"Design",text:"Merchandise received and checked: bottles, totes, branded items"},
      {cat:"Launch Event",text:"Complete run-of-show document for launch event"},
      {cat:"Launch Event",text:"On-ground team briefed: roles, stations, setup, contingency"},
      {cat:"Launch Event",text:"Tasting setup confirmed: mixing station, cups, display, signage"},
      {cat:"Distribution",text:"Pre-pack first 50 boxes for launch day same-day dispatch"},
      {cat:"Distribution",text:"All courier accounts active — run test dispatch"},
      {cat:"Content",text:"'7 days to XALT' countdown Stories series begins"},
      {cat:"Content",text:"All launch week Reels + carousels pre-edited and scheduled"},
      {cat:"Marketing",text:"Teaser email sent to waitlist: 'Something big is coming…'"},
    ]},
  { id:"w10", week:"Week 10–11", dates:"Jul 13–26", title:"Countdown",
    milestone:"10K waitlist HIT. All paid ads at full budget. Press outreach sent.",
    targets:["5K+ followers","10K waitlist ACHIEVED","Full paid ads live","PR outreach sent"],
    tasks:[
      {cat:"Marketing",text:"Full Meta + XHS paid ad campaign at launch budget — monitor daily"},
      {cat:"Marketing",text:"KL wellness media PR outreach: press release + samples sent"},
      {cat:"Marketing",text:"Launch day email fully proofed and queued"},
      {cat:"Influencer",text:"All 3 hero review videos LIVE before launch week"},
      {cat:"Content",text:"Daily countdown Stories from Jul 20: '10 days', '9 days', '8 days'…"},
      {cat:"Content",text:"All launch week content scheduled in Later/Buffer"},
      {cat:"Launch Event",text:"Final event headcount confirmed with venue"},
      {cat:"Launch Event",text:"All event signage, backdrop, branded materials at venue or en route"},
      {cat:"Distribution",text:"Emergency restock plan ready: define reorder trigger with OEM"},
      {cat:"Distribution",text:"3+ confirmed B2B corporate accounts ready for post-launch supply"},
      {cat:"E-Commerce",text:"Shopee launch day flash sale fully configured and tested"},
      {cat:"E-Commerce",text:"DTC early-bird discount code created, tested, ready"},
    ]},
  { id:"w12", week:"Launch Week", dates:"Aug Week 2", title:"🚀 LAUNCH DAY",
    milestone:"100K views. 10K waitlist live. 900 boxes sold. XALT is in the world.",
    targets:["100K views across all platforms","900 boxes sold","Launch event executed","DTC + Shopee live"],
    tasks:[
      {cat:"Launch Event",text:"Execute launch event — tasting stations, sign-ups, photo moments, energy"},
      {cat:"Launch Event",text:"Film entire launch event — capture 3+ Reels worth of raw footage"},
      {cat:"Launch Event",text:"Convert 50+ on-site attendees from waitlist to Day 1 purchase"},
      {cat:"Distribution",text:"DTC website GOES LIVE — blast email to full waitlist"},
      {cat:"Distribution",text:"Shopee store GOES LIVE — launch day flash sale activated"},
      {cat:"Distribution",text:"All launch day orders dispatched within 24 hours"},
      {cat:"Marketing",text:"Launch day email blast to full waitlist with early-bird offer"},
      {cat:"Marketing",text:"Paid ads at maximum daily budget — monitor CPC + ROAS hourly"},
      {cat:"Content",text:"Go LIVE on Instagram during launch event"},
      {cat:"Content",text:"Post launch day Reel same day — raw, real, emotional founder moment"},
      {cat:"Content",text:"Stories throughout the day: behind-scenes, reactions, boxes going out"},
      {cat:"Product",text:"If 400+ boxes sold by evening — brief OEM for next production batch"},
    ]},
];

const CATEGORY_COLORS = {
  "Product":      { bg:"rgba(0,149,122,0.15)",  text:"#4dd4b0" },
  "Design":       { bg:"rgba(149,113,229,0.15)", text:"#b09cee" },
  "Distribution": { bg:"rgba(212,160,23,0.15)",  text:"#e8c460" },
  "Content":      { bg:"rgba(232,88,12,0.15)",   text:"#ff8c4d" },
  "Marketing":    { bg:"rgba(232,96,170,0.15)",  text:"#f399c8" },
  "Launch Event": { bg:"rgba(204,34,0,0.15)",    text:"#ff7a5c" },
  "E-Commerce":   { bg:"rgba(34,160,90,0.15)",   text:"#5dd49b" },
  "AI Systems":   { bg:"rgba(140,80,220,0.15)",  text:"#c4a3f5" },
  "B2B":          { bg:"rgba(220,120,40,0.15)",  text:"#f0a86b" },
  "Community":    { bg:"rgba(40,140,220,0.15)",  text:"#7ac4f5" },
  "Influencer":   { bg:"rgba(180,80,220,0.15)",  text:"#d5a3f5" },
  "Today":        { bg:"rgba(0,149,122,0.15)",   text:"#4dd4b0" },
  "Done":         { bg:"rgba(120,120,120,0.18)", text:"#aaa" },
};
window.CATEGORY_COLORS = CATEGORY_COLORS;

function weekBlocks(w) {
  return [
    { id: nid(), type:"heading", level:1, text:`${w.week} — ${w.title}` },
    { id: nid(), type:"text", text:w.dates },
    { id: nid(), type:"callout", icon:"🎯", text:w.milestone },
    { id: nid(), type:"heading", level:2, text:"Targets" },
    { id: nid(), type:"bullets", items: w.targets.map(t => ({ id: nid(), text:t })) },
    { id: nid(), type:"heading", level:2, text:"Tasks" },
    { id: nid(), type:"checklist", items: w.tasks.map(t => ({ id: nid(), text:t.text, dueDate:"", done:false })) },
  ];
}

// === Convert XALT Bible parsed data into pages (with new IDs) ===
function bibleBlocks(blocks) {
  // Re-id all blocks since they may collide
  return blocks.map(b => {
    const nb = { ...b, id: nid() };
    if (nb.items) nb.items = nb.items.map(it => ({ ...it, id: nid() }));
    if (nb.rows) nb.rows = nb.rows.map(r => ({ ...r, id: nid() }));
    return nb;
  });
}

function buildDefaultWorkspace() {
  const pages = {};
  const rootOrder = [];
  const childOrder = {}; // parentId -> array of child ids in order

  function addPage(p) {
    pages[p.id] = p;
    if (p.parentId) {
      if (!childOrder[p.parentId]) childOrder[p.parentId] = [];
      childOrder[p.parentId].push(p.id);
    } else {
      rootOrder.push(p.id);
    }
  }

  // === Cover / Home ===
  addPage({
    id: "home",
    parentId: null,
    title: "XALT — Home",
    icon: "🏠",
    blocks: [
      { id: nid(), type:"heading", level:1, text:"XALT Functional Hydration Co." },
      { id: nid(), type:"text", text:"Business Playbook & Strategic Plan · 2026" },
      { id: nid(), type:"callout", icon:"💧", text:'"Hydration that works for the everyday you."' },
      { id: nid(), type:"heading", level:2, text:"Revenue Targets" },
      { id: nid(), type:"kpis", items: [
        { id: nid(), label:"2026 Target", value:"RM 200K", change:"End of Year" },
        { id: nid(), label:"2027 Target", value:"RM 1M", change:"Scale Phase" },
        { id: nid(), label:"Launch", value:"Q3 2026", change:"Aug–Sep" },
        { id: nid(), label:"Year 1 Margin", value:"70%", change:"Sachet DTC" },
      ]},
      { id: nid(), type:"heading", level:2, text:"Today's Tasks" },
      { id: nid(), type:"checklist", items: [
        { id: nid(), text:"Review weekly priorities", done:false, dueDate:"" },
        { id: nid(), text:"Update KPI dashboard", done:false, dueDate:"" },
        { id: nid(), text:"Check launch checklist progress", done:true, dueDate:"" },
      ]},
      { id: nid(), type:"divider" },
      { id: nid(), type:"heading", level:2, text:"Quick navigation" },
      { id: nid(), type:"text", text:"📘 XALT Bible — full strategy doc with 10 sections (see sidebar)" },
      { id: nid(), type:"text", text:"🚀 Launch Plan — week-by-week checklist with categorized tasks" },
      { id: nid(), type:"text", text:"🎯 KPIs — your custom metrics dashboard" },
      { id: nid(), type:"text", text:"👥 Team — roster of who does what" },
    ],
  });

  // === XALT Bible (parent + 10 sub-pages from parsed doc) ===
  addPage({
    id: "bible",
    parentId: null,
    title: "📘 XALT Bible",
    icon: "📘",
    blocks: [
      { id: nid(), type:"heading", level:1, text:"XALT Bible" },
      { id: nid(), type:"text", text:"Your complete brand & business playbook. 10 sections covering vision, customers, product, finance, GTM, marketing, KPIs, hiring, timeline, and culture." },
      ...(window.XALT_BIBLE?.cover ? bibleBlocks(window.XALT_BIBLE.cover) : []),
    ],
  });

  // Add bible sub-pages
  if (window.XALT_BIBLE?.pages) {
    window.XALT_BIBLE.pages.forEach((bp, idx) => {
      const pageId = `bible_${idx}`;
      addPage({
        id: pageId,
        parentId: "bible",
        title: bp.title,
        icon: "📄",
        blocks: bibleBlocks(bp.blocks),
      });
    });
  }

  // === Launch Plan + 11 weekly sub-pages ===
  addPage({
    id: "launch",
    parentId: null,
    title: "🚀 Launch Plan",
    icon: "🚀",
    blocks: [
      { id: nid(), type:"heading", level:1, text:"Pre-Launch Master Plan" },
      { id: nid(), type:"callout", icon:"🚀", text:"Launch Day: August, Week 2 — 100K views, 5–10K followers/platform, 10K waitlist, 900 boxes sold" },
      { id: nid(), type:"heading", level:2, text:"Launch Targets" },
      { id: nid(), type:"kpis", items: [
        { id: nid(), label:"Views target", value:"100K", change:"across platforms" },
        { id: nid(), label:"Followers", value:"5–10K", change:"per platform" },
        { id: nid(), label:"Waitlist", value:"10K", change:"emails captured" },
        { id: nid(), label:"Boxes sold", value:"900", change:"launch week" },
      ]},
      { id: nid(), type:"heading", level:2, text:"Weekly schedule" },
      { id: nid(), type:"text", text:"Open each week in the sidebar →" },
    ],
  });
  XALT_WEEKS.forEach(w => addPage({
    id: w.id, parentId:"launch",
    title: `${w.week} · ${w.title}`,
    icon: "📅",
    blocks: weekBlocks(w),
  }));

  // === KPIs ===
  addPage({
    id: "kpis",
    parentId: null,
    title: "🎯 KPIs & OKRs",
    icon: "🎯",
    blocks: [
      { id: nid(), type:"heading", level:1, text:"KPIs & OKRs" },
      { id: nid(), type:"text", text:"Track your custom metrics here. Click any number to edit." },
      { id: nid(), type:"heading", level:2, text:"Growth (Pre-Launch)" },
      { id: nid(), type:"kpis", items: [
        { id: nid(), label:"Instagram", value:"0", change:"Target: 5K" },
        { id: nid(), label:"XHS", value:"0", change:"Target: 5K" },
        { id: nid(), label:"Waitlist Emails", value:"0", change:"Target: 10K" },
        { id: nid(), label:"B2B Leads", value:"0", change:"Target: 20" },
      ]},
      { id: nid(), type:"heading", level:2, text:"Revenue" },
      { id: nid(), type:"kpis", items: [
        { id: nid(), label:"MTD Revenue", value:"RM 0", change:"Target: RM 16K/mo" },
        { id: nid(), label:"Boxes Sold", value:"0", change:"Launch target: 900" },
        { id: nid(), label:"Subscription Rate", value:"0%", change:"Target: 15%" },
      ]},
      { id: nid(), type:"heading", level:2, text:"Custom Metrics" },
      { id: nid(), type:"text", text:"Add your own metrics below. Type /kpi to add more." },
    ],
  });

  // === Team ===
  addPage({
    id: "team",
    parentId: null,
    title: "👥 Team & Roles",
    icon: "👥",
    blocks: [
      { id: nid(), type:"heading", level:1, text:"Team & Roles" },
      { id: nid(), type:"table", headers:["Name","Role","Email","Focus area"], rows:[
        { id: nid(), cells:["Founder","CEO","founder@xalt.co","Strategy · Brand · Content"] },
        { id: nid(), cells:["Co-founder","COO","ops@xalt.co","Operations · Distribution · Finance"] },
      ]},
    ],
  });

  // === Roadmap ===
  addPage({
    id: "roadmap",
    parentId: null,
    title: "🗺️ Product Roadmap",
    icon: "🗺️",
    blocks: [
      { id: nid(), type:"heading", level:1, text:"Product Roadmap" },
      { id: nid(), type:"table", headers:["Feature","Quarter","Priority","Status"], rows:[
        { id: nid(), cells:["Daily SKU launch","Q3 2026","High","In progress"] },
        { id: nid(), cells:["Focus SKU launch","Q3 2026","High","In progress"] },
        { id: nid(), cells:["Subscription model","Q4 2026","Medium","Planned"] },
        { id: nid(), cells:["B2B office pack","Q4 2026","Medium","Backlog"] },
        { id: nid(), cells:["SG market expansion","Q2 2027","High","Backlog"] },
      ]},
    ],
  });

  // === Notes ===
  addPage({
    id: "notes",
    parentId: null,
    title: "💡 Notes & Ideas",
    icon: "💡",
    blocks: [
      { id: nid(), type:"heading", level:1, text:"Notes & Ideas" },
      { id: nid(), type:"text", text:"Free-form workspace. Type / to insert any block." },
    ],
  });

  return { pages, rootOrder, childOrder, currentPageId: "home" };
}

function blockHeading(level, text) {
  return { id: nid(), type:"heading", level, text };
}

function blockText(text) {
  return { id: nid(), type:"text", text };
}

function blockCallout(icon, text) {
  return { id: nid(), type:"callout", icon, text };
}

function blockBullets(items) {
  return { id: nid(), type:"bullets", items: items.map((text) => ({ id: nid(), text })) };
}

function blockTable(headers, rows) {
  return { id: nid(), type:"table", headers, rows: rows.map((cells) => ({ id: nid(), cells })) };
}

function blockKpis(items) {
  return { id: nid(), type:"kpis", items: items.map((item) => ({ id: nid(), ...item })) };
}

function blockMilestones(items) {
  return { id: nid(), type:"milestones", items: items.map((item) => ({ id: nid(), ...item })) };
}

function blockChecklist(items) {
  return { id: nid(), type:"checklist", items: items.map((item) => ({
    id: nid(),
    text: item.text,
    dueDate: item.dueDate || "",
    done: !!item.done,
  })).filter((item) => item.done) };  // only keep done items by default
}

function buildChurnsContentIntelligencePage() {
  return {
    id: "churns_content_intelligence",
    parentId: null,
    title: "Content Intelligence Report",
    icon: "🧠",
    date: "2026-05-15",
    blocks: [
      blockHeading(1, "CHURNS AI — Content Intelligence Report v3"),
      blockText("Platform stats · algorithm deep dives · what works · side-by-side voice comparison · 30 hooks"),
      blockCallout("🎯", "For business owners who are curious about AI but stuck on where to start."),
      blockHeading(2, "Table of Contents"),
      blockBullets([
        "Platform statistics overview",
        "LinkedIn, X, Threads and Instagram algorithm notes",
        "Cross-platform comparison",
        "High-performing content patterns",
        "Try-hard vs real voice comparison",
        "30 hooks ready to adapt",
        "Master cheat sheet",
      ]),
      blockHeading(1, "01 — Platform Statistics Overview"),
      blockText("Four platforms. Different rules. Different audiences. Different formats that win. The biggest mistake is treating them the same."),
      blockTable(["Platform", "Primary role for Churns", "Best format", "Key signal", "Best time MY"], [
        ["LinkedIn", "Authority + B2B leads", "Carousel PDF", "Saves + deep comments", "Tue/Wed 7:30-8:30am"],
        ["X", "Sharp takes + global reach", "Short text / thread", "Bookmarks + reply depth", "8-10am + 12-1pm"],
        ["Threads", "Daily founder voice + SEA community", "Under 500 chars + image", "Replies + originality", "7:30am + 12:30pm"],
        ["Instagram", "Discovery + visual proof", "Reels 15-30 sec", "DM shares + watch time + saves", "7-9am + 11am-1pm"],
      ]),

      blockHeading(1, "02 — LinkedIn"),
      blockCallout("💼", "One-line strategy: carousels for reach and saves, sharp text for conversation, native video for trust, links only in comments, reply to everything in the first hour."),
      blockText("LinkedIn uses separate ranking systems for Feed, Notifications and Search. Shares, saves, comments, depth of reading and comment quality now matter more than surface likes. A post with 5 genuine comments can outperform one with 50 likes."),
      blockTable(["Metric", "Number", "What it means for Churns"], [
        ["Carousel PDF engagement", "6.60% avg", "Post 1 carousel per week minimum. 6-8 slides, one idea per slide."],
        ["Video engagement", "5.10%", "Native video only. YouTube links reduce reach."],
        ["Text post engagement", "0.5-2%", "Works when the observation is sharp. Longer thoughtful posts can win."],
        ["External links", "-60% reach", "Never put links in the body. First comment only."],
        ["Comments vs likes", "Comments 2x more valuable", "Make people describe their own situation in reply."],
        ["Document saves", "2.6x higher save rate", "Make carousels useful enough to revisit."],
        ["Best time MY", "Tue/Wed 7:30-8:30am", "Decision makers check before work starts."],
        ["Reply speed", "Within 60 min = 2.4x reach", "Reply to every comment in the first hour."],
        ["Personal vs company page", "Personal profile gets 561% more reach", "Post from founder profile. Company page is secondary."],
      ]),

      blockHeading(1, "03 — X"),
      blockCallout("✕", "One-line strategy: short sharp observations daily, 1-2 threads per week, no links in posts, bookmarks are the metric that matters."),
      blockText("X ranks content by engagement velocity: how fast and how deeply people interact in the first few hours. Bookmarks are the strongest signal, followed by reply depth. Likes are weak."),
      blockTable(["Metric", "Number", "What it means for Churns"], [
        ["Text vs video", "Text wins by 30%", "This is the platform for sharp observations."],
        ["Short post length", "71-100 chars gives +17% engagement", "Cut setup. Say the thing quickly."],
        ["Threads", "4-8 tweets", "Use for complex ideas 1-2 times per week."],
        ["External links", "30-50% reach drop", "Links in replies only."],
        ["Bookmarks", "5x multiplier vs likes", "Write observations and frameworks worth saving."],
        ["Reply depth", "+75 vs +0.5 for like", "Reply chains are far more valuable than likes."],
        ["Premium reach", "About 10x per post", "Worth considering if X becomes a serious channel."],
        ["Best time MY", "8-10am + 12-1pm", "Commute and lunch scrolling windows."],
      ]),

      blockHeading(1, "04 — Threads"),
      blockCallout("🧵", "One-line strategy: 2-3 posts per day. Short, opinionated, real. Add an image when you have one. Reply fast. Repeat the same topic cluster every week."),
      blockText("Threads is topic-based, not purely social-graph based. It learns the themes people engage with and routes posts into those topic clusters. Consistency teaches the algorithm what category you own."),
      blockTable(["Metric", "Number", "What it means for Churns"], [
        ["Daily active users", "141.5M Jan 2026", "Early mover advantage is still open."],
        ["Images vs text", "Images outperform text by 60%", "Add screenshots or simple graphics to your best posts."],
        ["Median engagement vs X", "73.6% higher", "Smaller audience, better per-post engagement."],
        ["Best content type", "Questions + strong opinions", "Drive replies with a clear view."],
        ["Length sweet spot", "Under 500 characters", "One observation. No setup."],
        ["Links in posts", "+17% performance", "Links work now, but images still usually win."],
        ["Engagement bait", "Actively downranked", "Never ask for likes, follows or shares."],
        ["Largest age group", "25-34", "Strong match for founders and operators."],
      ]),

      blockHeading(1, "05 — Instagram Algorithm Breakdown 2026"),
      blockCallout("📱", "Instagram is no longer one algorithm. Feed, Stories, Reels, Explore, Search and recommendations each rank differently. Views are now the shared performance metric across formats."),
      blockHeading(2, "Priority Signals"),
      blockTable(["Signal", "Weight", "What it means in practice"], [
        ["Watch time", "#1 ranking factor", "Hook in the first 3 seconds. Every second must earn the next."],
        ["DM shares", "#2 discovery signal", "Make content people send to a friend."],
        ["Likes per reach", "#3", "Useful with existing followers, weaker for discovery."],
        ["Saves", "High for carousels", "Build save-and-return content."],
        ["Comments", "Medium", "Genuine comments matter more than emoji comments."],
        ["Profile visit rate", "Rising fast", "Make viewers tap and find exactly what they just liked."],
      ]),
      blockHeading(2, "How Each Surface Works"),
      blockTable(["Surface", "How it ranks", "Churns action"], [
        ["Feed", "Relationship, past engagement, quick interaction and profile visit rate", "Use carousels and founder observations that make people tap profile."],
        ["Reels", "Completion, rewatch, DM share, follow after viewing", "Show the result first, then explain. No intro."],
        ["Stories", "Closeness, replies, reactions, DM frequency", "3-5 per day for warm audience relationship."],
        ["Explore", "Strong prior surface performance, 95% completion, linger time, follows", "Optimise Reels first. Explore follows."],
      ]),
      blockHeading(2, "Reels Ranking Factors"),
      blockTable(["Factor", "What it means", "Your action"], [
        ["First 3-second retention", "Critical threshold for wider distribution", "Start at the most interesting moment."],
        ["Watch to completion", "Signals full Reel delivered value", "Cut anything slow."],
        ["DM share rate", "Strongest non-follower discovery signal", "Make it useful to send to a friend."],
        ["Rewatch rate", "Signals surprising or dense content", "Use proof, numbers, or visual walkthroughs."],
        ["Follow after viewing", "High-intent signal", "Keep profile niche-consistent."],
        ["Audio usage", "Trend-fit can improve reach", "Use trending audio only when natural."],
      ]),
      blockHeading(2, "What Instagram Penalises"),
      blockTable(["What gets penalised", "Why", "Do instead"], [
        ["TikTok watermarks / CapCut artefacts", "Detected as non-original media", "Re-export without watermarks."],
        ["Recycled content without added value", "Aggregator behavior is downranked", "Add your own perspective and voice."],
        ["Engagement bait", "Detected and downranked", "Earn engagement naturally."],
        ["External links in posts", "Takes users off-platform", "Link in bio or first comment only."],
        ["AI content with no human layer", "Easy for audience and algorithm to ignore", "Draft with AI, rewrite in your voice."],
        ["Account Status restrictions", "Suppress reach across surfaces", "Check Account Status monthly."],
      ]),
      blockHeading(2, "SEO Over Hashtags"),
      blockText("Keywords in captions, on-screen text, profile and account history now matter more than hashtags. For Churns, captions should contain terms like AI, clinic, WhatsApp, automation, receptionist and Malaysia. Use 3-5 tightly relevant hashtags, not 20-30 generic tags."),
      blockHeading(2, "Format Performance"),
      blockTable(["Format", "Engagement / reach signal", "Best for", "Optimal length"], [
        ["Reels", "2.46% engagement, 30.81% reach rate", "Discovery and non-followers", "30-90 seconds"],
        ["Carousels", "3x more dwell time than single image", "Trust building and saves", "6-10 slides"],
        ["Static image", "Declining YoY", "Quotes and sharp graphics", "Single frame"],
        ["Stories", "55-75% completion", "Warm audience relationship", "3-5 per day"],
      ]),
      blockHeading(2, "Churns Instagram Application"),
      blockTable(["Content type", "Best format", "Length", "Hook approach", "CTA"], [
        ["Use case: AI handling messages", "Reel, phone screen/app recording", "20-35 sec", "Show result in first 2 seconds", "Save this if you want to see how it works."],
        ["The stuck feeling", "Face-to-camera Reel", "15-25 sec", "Start with the feeling", "Drop STUCK in my DMs."],
        ["System walkthrough", "Screen recording with captions", "60-90 sec", "Show the most interesting part first", "Save this. Full breakdown in DMs."],
        ["Educational breakdown", "Carousel", "6-8 slides", "Slide 1 is the tension", "Save and share with someone who needs it."],
        ["Real outcome", "Carousel or Reel", "5 slides / 30 sec", "Lead with the number", "DM me if you want this for your business."],
        ["Founder observation", "Face-to-camera or text on screen", "15-20 sec", "Say the one true thing", "No CTA needed."],
      ]),
      blockCallout("🧩", "Reels bring them in. Carousels make them stay. Stories keep them warm."),

      blockHeading(1, "06 — Cross-Platform Comparison"),
      blockTable(["Metric", "LinkedIn", "X", "Threads", "Instagram"], [
        ["Primary role", "Authority + B2B leads", "Sharp takes + global reach", "Daily founder voice", "Discovery + visual proof"],
        ["Best format", "Carousel PDF", "Short text / thread", "Under 500 chars + image", "Reels 15-90 sec"],
        ["Key signal", "Saves + deep comments", "Bookmarks + reply depth", "Replies + topic consistency", "Watch time + DM shares"],
        ["External links", "First comment only", "Replies only", "Works now", "Bio only"],
        ["Best time MY", "Tue/Wed 7:30-8:30am", "8-10am + 12-1pm", "7:30am + 12:30pm", "7-9am + 11am-1pm"],
        ["Kills reach", "Engagement bait + links", "Low-quality replies", "Engagement bait", "Watermarks + no hook + AI-only content"],
        ["Frequency", "3-4x/week", "2-3x/day", "2-3x/day", "1 Reel/day + 3-5 Stories"],
      ]),

      blockHeading(1, "07 — High-Performing Content Patterns"),
      blockTable(["Pattern", "What it is", "Share trigger", "Best platform", "Example"], [
        ["Relatable Truth", "States something the reader has felt but not heard said", "Recognition", "Threads + X", "The hardest part of AI is not learning it. It is knowing where to point it first."],
        ["Specific Outcome", "Real numbers from a real situation", "Proof", "Instagram + LinkedIn", "23 messages. 4 bookings. 0 human replies. One Saturday night."],
        ["Reframe", "Flips a common belief", "Cognitive dissonance", "X + LinkedIn", "AI is not going to take your job. Your competitor who uses it might."],
        ["Honest Moment", "Something went wrong or surprised you", "Honesty", "All platforms", "The AI gave a patient wrong pricing. Here is what changed."],
        ["Comparison", "Before/after contrast", "Save + share", "Instagram + X", "Before: 40% evening enquiries missed. After: 3%."],
        ["Carousel Save Magnet", "One idea per slide, designed to revisit", "Saves", "LinkedIn", "You tried AI. It felt like a toy. Here is why."],
      ]),

      blockHeading(1, "08 — Side-by-Side: Try-Hard vs Real Voice"),
      blockTable(["Try-hard version", "Real voice version"], [
        ["Here is the difference between a chatbot and a vertical AI operating system and why that changes everything.", "People keep calling what I build a chatbot. It is not a chatbot. A chatbot waits to be asked. What I build goes and gets the booking."],
        ["A clinic in KL was losing 40% of their WhatsApp enquiries. Here is what we found when we mapped the data.", "A clinic was losing 40% of its evening enquiries. Not bad service. Just nobody there to reply. Fixed it."],
        ["Revenue leak audit I ran for a client: 4 specific points where the business was losing leads.", "There are 4 moments in every service business where a warm lead quietly disappears and nobody notices until the end of the month."],
        ["Running two companies using AI as the operating infrastructure. Here is the honest breakdown.", "Two companies. No team. AI does the ops. I do the decisions. Weirdly manageable."],
        ["OpenAI launched a $4B company. Here is my complete take on what it means for business owners in KL.", "OpenAI raised $4B to work with Fortune 500s. The clinic owner in PJ is not in that conversation. That gap is where I build."],
        ["The follow-up problem that kills 60% of warm leads. The data says 4-7 touches are needed.", "Most businesses follow up once then call the lead cold. The lead was never cold. You just stopped showing up."],
        ["I started ChurnsOS this week. Here is why it is the most important thing I built.", "Started a folder where every system I build goes. By client 10 I will be reusing 80% of it. The folder is the product."],
      ]),
      blockCallout("✂️", "Rule: try-hard announces what is coming. Real voice just says the thing. Cut the last sentence. It is almost always where you explain what the post meant."),

      blockHeading(1, "09 — 30 Hooks Ready to Adapt"),
      blockHeading(2, "The Stuck Feeling"),
      blockBullets([
        "The hardest part of AI is not learning it. It is knowing where to point it first.",
        "Everyone tried ChatGPT. Most people stopped there. The value starts one step after that.",
        "You tried it. It felt like a toy. That is not a you problem. Nobody showed you where to aim.",
        "Hot take: most business owners do not need more AI tools. They need someone to help them pick one and go deep.",
        "The gap between dabbling with AI and actually getting value is not knowledge. It is specificity.",
      ]),
      blockHeading(2, "Real Outcomes"),
      blockBullets([
        "[Number] messages. [Number] bookings. Zero human replies. One [day].",
        "XALT got [X] customer messages last week. I handled [Y]. The business ran anyway.",
        "Before: 40% of evening enquiries missed. After: 3%. Same business. Same team. Different system.",
        "Hired an AI employee. RM 200/month. Never sick. Never late. Never misses a follow-up.",
        "Client message this week: \"I stopped checking my phone at night.\" That is the product.",
      ]),
      blockHeading(2, "Reframes"),
      blockBullets([
        "AI is not going to take your job. Your competitor who uses it might. Different conversation.",
        "AI did not replace my staff. It meant I never needed to hire them in the first place.",
        "Most people use AI like a search engine. The ones getting results use it like a new hire.",
        "Running lean is not about doing less. It is about making sure the right things still get done.",
        "The problem is not that people do not understand AI. Nobody helped them find the right problem.",
      ]),
      blockHeading(2, "Honest Moments"),
      blockBullets([
        "The AI gave a client wrong information. I got the angry message at 9pm. Here is what I did and what I changed.",
        "Thought the hardest part of building AI for a business would be the AI. It was getting the client to write down their own process.",
        "Week where nothing clicked. Posted anyway. That is the whole job.",
        "What I know now that I did not know 60 days ago about posting online.",
        "Month 1 of building in public. Expected to attract clients. Also attracted people who just wanted to talk. Both are useful.",
      ]),
      blockHeading(2, "Entertainment & Comparison"),
      blockBullets([
        "POV: you finally try AI properly and realise you have been doing something manually for 2 years that takes 10 minutes.",
        "Two companies. No team. AI does the inbox, follow-up, reports. I do the decisions. Weirdly manageable.",
        "The peace of mind AI gives you is underrated. Knowing the inbox is handled while you sleep is worth more than the cost.",
        "OpenAI raised $4B to work with Fortune 500s. The clinic owner in PJ is not in that conversation. That gap is where I build.",
        "Most AI content talks about what AI can do. Nobody talks about what it cannot do yet. That gap is more useful.",
      ]),
      blockHeading(2, "DM Drivers"),
      blockBullets([
        "If AI still feels like a toy to you, drop STUCK in my DMs. I will show you where it fits in 30 minutes.",
        "Every business owner I talk to says the same thing: I know I should use AI but I do not know where to start. That conversation is one I can help with.",
        "Not for developers. Not for tech teams. If you run a real business and AI has not clicked yet, that is exactly who I build for.",
        "The moment AI clicks is different for every business. It is usually the day you realise you were doing something manually that did not need to be.",
        "If this resonates, you are probably the person I am talking to. Say hi.",
      ]),

      blockHeading(1, "10 — Master Cheat Sheet"),
      blockTable(["Fact", "Platform", "Action"], [
        ["Carousels get 6.60% engagement", "LinkedIn", "1 carousel per week. 6-8 slides. One idea per slide."],
        ["Comments count 2x more than likes", "LinkedIn", "End with a specific question."],
        ["External links reduce reach 30-60%", "LinkedIn + X", "Links in first comment or reply only."],
        ["Bookmarks are 5x vs likes", "X", "Create reference material and sharp observations."],
        ["Text beats video by 30%", "X", "Say the thing in fewer words."],
        ["Images outperform text by 60%", "Threads", "Add screenshot or graphic to best posts."],
        ["Threads overtook X in DAU", "Threads", "Post consistently while early advantage remains."],
        ["Personal profile gets 561% more reach", "LinkedIn", "Post from founder profile."],
        ["Watch time is #1 ranking signal", "Instagram", "Hook in 3 seconds. Cut anything slow."],
        ["DM shares are the discovery signal", "Instagram", "Make content people send to a friend."],
        ["First 3 seconds decide Reel fate", "Instagram", "Start at the most interesting moment."],
        ["Lo-fi beats polished", "Instagram", "Phone recording + captions beats studio production."],
        ["85% watched without sound", "Instagram", "Always add text captions."],
        ["3-5 hashtags beat 20+", "Instagram", "Use targeted hashtags and keyword-rich captions."],
        ["TikTok watermarks suppress reach", "Instagram", "Always re-export without watermarks."],
        ["AI content without human voice is penalised", "Instagram", "Draft with AI, rewrite in your voice."],
        ["Engagement bait is penalised", "All", "Never say comment YES, like if you agree, or follow for more."],
      ]),
      blockCallout("✅", "Teach. Prove. Resonate. Never sell."),
    ],
  };
}

function buildChurnsWeek1FounderContentPages() {
  const parentId = "churns_60_day_content";
  const weekId = "churns_60_day_week_1";
  const child = (id, title, icon, blocks, date = "") => ({ id, parentId: weekId, title, icon, date, blocks });

  const weekPage = {
    id: weekId,
    parentId,
    title: "Week 1 — AI Founder Content Playbook",
    icon: "1️⃣",
    date: "2026-05-17",
    blocks: [
      blockHeading(1, "Week 1 AI Founder Content Playbook"),
      blockText("Instagram · Threads · LinkedIn · Sunday 17 May to Sunday 24 May"),
      blockCallout("✅", "Verdict: this angle is well-timed. The winning position is founder-led, practical AI building for business owners who feel overloaded and do not know where to start."),
      blockKpis([
        { label: "Timing Score", value: "9.1", change: "excellent window" },
        { label: "Positioning", value: "8.3", change: "strong founder fit" },
        { label: "Virality", value: "7.5", change: "high if specific" },
        { label: "Demand Signal", value: "High", change: "AI workflows" },
      ]),
      blockHeading(2, "Platform Intelligence"),
      blockTable(["Platform", "Signal", "What to do this week"], [
        ["Instagram", "Reels get about 55% more interactions than static posts.", "Post 3 Reels and 1 carousel. Hook in the first 3 seconds."],
        ["Threads", "Median engagement is around 6.25%, higher than X.", "Post daily short founder observations and reply to your own post with extra context."],
        ["LinkedIn", "PDF carousels average around 6.60% engagement.", "Post 2 serious business pieces. No external links in the body."],
      ]),
      blockHeading(2, "What Works"),
      blockBullets([
        "I built X with AI story format.",
        "Before and after workflow automation.",
        "Mistake or failure posts with the real lesson.",
        "Free audit or build offer as a lead magnet.",
        "Specific prompts, tools, and real business cases.",
      ]),
      blockHeading(2, "Avoid"),
      blockBullets([
        "Vague AI news commentary without a personal take.",
        "Agree? style engagement bait.",
        "Over-polished Threads posts.",
        "External links in LinkedIn post body.",
        "Pitching the service directly inside AI news posts.",
      ]),
      blockHeading(2, "Week 1 Subpages"),
      blockBullets([
        "Instagram Week 1 Topics",
        "Threads Week 1 Topics",
        "LinkedIn Week 1 Topics",
        "Additional Content Ideas",
      ]),
    ],
  };

  const instagram = child("churns_week_1_instagram", "Instagram — Week 1 Topics", "📸", [
    blockHeading(1, "Instagram — Week 1 Topics"),
    blockCallout("🎯", "Plan: 3 Reels + 1 carousel. Make every Reel concrete, visual, and tied to a real build."),
    blockTable(["Asset", "Hook", "Content", "CTA"], [
      ["Reel 1 — Launch Intro", "For the last 9 months, I have been building businesses with AI almost every single day.", "Founder intro: not ex-Meta, genuinely curious, building websites, automations, WhatsApp agents, content systems, client workflows, and learning in public.", "DM JOIN for the free AI community."],
      ["Reel 2 — I Built My Own Notion With AI", "I got tired of Notion. So I used AI to build my own.", "Show the custom workspace, teammate icon, Supabase or realtime setup, and how one prompt turned into a working tool.", "Comment PROMPT or DM your workflow pain."],
      ["Reel 3 — WhatsApp Agent Demo", "This AI workflow saved my WhatsApp inbox from dying.", "Demo inquiry, AI response, lead captured, and follow-up. Local SME pain point.", "Save this if you want to see how it works for your business."],
      ["Carousel — My AI Stack", "Stop paying for tools you do not need.", "5 AI tools used weekly, one use case per slide, time saved, rating, and one tool you wish you knew sooner.", "DM WORKFLOW for which tool fits your business."],
    ]),
    blockHeading(2, "Instagram Rules"),
    blockBullets([
      "Best time: 7-9 AM or 6-8 PM.",
      "Reels should be 30-90 seconds.",
      "Use 3-5 niche hashtags, not 20 generic ones.",
      "Reply to every comment in the first hour.",
      "Carousels should be built for saves and resharing.",
    ]),
  ]);

  const threads = child("churns_week_1_threads", "Threads — Week 1 Topics", "🧵", [
    blockHeading(1, "Threads — Week 1 Topics"),
    blockCallout("🧵", "Threads should feel real, short, and founder-led. Conversations outperform perfect posts."),
    blockTable(["Day", "Topic", "Draft Angle", "CTA"], [
      ["Sunday 17 May", "Free workflow offer", "I will build 1 automation for you, no charge. I want to understand real business problems, not just talk AI theory.", "DM WORKFLOW."],
      ["Monday 18 May", "AI prompt of the day", "The prompt I use every Monday morning to plan my whole week with AI.", "Save this."],
      ["Tuesday 19 May", "AI news hot take", "Take one current AI story and translate what it actually means for a 10-person business.", "Ask what people think this changes."],
      ["Wednesday 20 May", "I built my own Notion", "I got tired of Notion. So I asked Claude to build the workspace I actually wanted.", "Drop your workflow pain."],
      ["Thursday 21 May", "Mistake story", "I spent 3 weeks building an AI system that completely broke. Here is what I learned.", "Ask what system they tried to automate."],
      ["Friday 22 May", "Mini case study", "How a business owner saved 10 hours a week with one AI workflow.", "DM AUDIT."],
      ["Saturday 23 May", "Caption prompt", "The prompt that writes my Instagram captions for me and still sounds like me.", "Drop a writing emoji if they want more."],
      ["Sunday 24 May", "Week reflection", "Week 1 of building in public. Here is what actually happened.", "Ask what they want next week."],
    ]),
    blockHeading(2, "Growth Hack"),
    blockBullets([
      "Reply to your own post after 20-30 minutes with an extra insight or question.",
      "Jump into AI creators' threads with useful replies, not promo.",
      "Post one clear topic cluster repeatedly: practical AI workflows for business owners.",
    ]),
  ]);

  const linkedin = child("churns_week_1_linkedin", "LinkedIn — Week 1 Topics", "💼", [
    blockHeading(1, "LinkedIn — Week 1 Topics"),
    blockCallout("💼", "LinkedIn is for authority and B2B trust. Use carousels, real workflow breakdowns, and specific questions."),
    blockTable(["Post", "Title", "Format", "Core Angle"], [
      ["Post 1", "I automated my entire CPG brand launch with AI. Here is the breakdown.", "PDF carousel, 6 slides", "Show the business phases: naming, positioning, competitor research, label copy, launch planning, and what AI handled."],
      ["Post 2", "Most businesses have AI tools. Almost none have AI workflows.", "Long-form text, 1300+ characters", "Contrast scattered tools with an orchestration system. End with a specific workflow question."],
    ]),
    blockHeading(2, "Future LinkedIn Series"),
    blockTable(["Series", "Concept", "Why it works"], [
      ["The AI Workflow Audit", "One workflow weekly: customer onboarding, lead follow-up, invoice, content planning.", "Positions you as the workflow expert."],
      ["What I Built This Week", "Weekly Friday build log: what was built, what broke, what changed.", "Founder-led proof compounds fast."],
      ["The Mistake That Cost Me X", "Failure story posts with lessons and what you would do differently.", "Trust builder with strong comment potential."],
    ]),
    blockCallout("⚠️", "Use AI to structure LinkedIn posts, but rewrite in your own voice. AI-sounding LinkedIn content is easier to detect and usually performs worse."),
  ]);

  const dayPages = [
    child("churns_week_1_sun_17", "Sunday 17 May", "☀️", [
      blockHeading(1, "Sunday 17 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Instagram", "Launch Intro Reel", "Use the 9-month founder story. Add the information-overload angle."],
        ["Threads", "Free Workflow Offer", "I will build 1 automation for you, no charge. Pick 3-5 real businesses."],
        ["LinkedIn", "Profile prep", "Update headline, about section, and pin an intro post if needed."],
      ]),
      blockChecklist([
        { cat: "Instagram", text: "Record and post the Launch Intro Reel." },
        { cat: "Threads", text: "Post the free workflow offer and reply with a follow-up question." },
        { cat: "Community", text: "Prepare JOIN DM response and community invite flow." },
      ]),
    ], "2026-05-17"),
    child("churns_week_1_mon_18", "Monday 18 May", "📌", [
      blockHeading(1, "Monday 18 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Threads", "AI Prompt of the Day", "Share the Monday planning prompt with exact copy-paste prompt."],
        ["LinkedIn", "CPG Brand Launch With AI", "Publish as PDF carousel around 8-9 AM."],
        ["Instagram", "Story support", "Show behind-the-scenes of planning the week with AI."],
      ]),
      blockCallout("🧠", "Prompt angle: the prompt I use every Monday morning to plan my whole week with AI."),
    ], "2026-05-18"),
    child("churns_week_1_tue_19", "Tuesday 19 May", "🔥", [
      blockHeading(1, "Tuesday 19 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Instagram", "I Built My Own Notion With AI", "Screen record the custom workspace and live teammate icon."],
        ["Threads", "AI News Hot Take", "Translate one AI story into what it means for a small business."],
        ["LinkedIn", "Commenting day", "Leave thoughtful comments on 10 founder or AI posts."],
      ]),
      blockCallout("🎬", "Reel hook: I got tired of Notion. So I used AI to build my own."),
    ], "2026-05-19"),
    child("churns_week_1_wed_20", "Wednesday 20 May", "🧪", [
      blockHeading(1, "Wednesday 20 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Instagram", "CPG Brand Build Episode 1", "Show AI helping with product naming, positioning, competitor research, and label copy."],
        ["Threads", "I Built My Own Notion Thread", "Repurpose the Reel into a short build thread."],
        ["LinkedIn", "Prep Post 2", "Draft the AI tools vs AI workflows post."],
      ]),
    ], "2026-05-20"),
    child("churns_week_1_thu_21", "Thursday 21 May", "🛠️", [
      blockHeading(1, "Thursday 21 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Threads", "Mistake Story", "I spent 3 weeks building an AI system that completely broke."],
        ["Instagram", "Stories", "Show one thing that broke and what you changed."],
        ["LinkedIn", "AI Tools vs AI Workflows", "Publish the long-form thought leadership post."],
      ]),
    ], "2026-05-21"),
    child("churns_week_1_fri_22", "Friday 22 May", "📈", [
      blockHeading(1, "Friday 22 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Threads", "Mini Case Study", "How a business owner saved 10 hours a week with one AI workflow."],
        ["Instagram", "WhatsApp Agent Demo", "Problem-solution demo for SME inbox pain."],
        ["LinkedIn", "Engage first hour", "Reply to every comment from the AI workflows post."],
      ]),
    ], "2026-05-22"),
    child("churns_week_1_sat_23", "Saturday 23 May", "🧰", [
      blockHeading(1, "Saturday 23 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Instagram", "My AI Stack Carousel", "5 tools, one use case each, time saved, rating."],
        ["Threads", "Caption Prompt", "Prompt that writes captions and still sounds like you."],
        ["LinkedIn", "Repurpose planning", "Turn best-performing thread into next week LinkedIn post."],
      ]),
    ], "2026-05-23"),
    child("churns_week_1_sun_24", "Sunday 24 May", "📝", [
      blockHeading(1, "Sunday 24 May"),
      blockTable(["Platform", "Post", "Notes"], [
        ["Threads", "Week 1 Reflection", "What worked, what surprised you, DMs received, what you will change."],
        ["Instagram", "Story recap", "Share weekly lessons and tease next week."],
        ["LinkedIn", "No main post", "Review metrics and decide what drove DMs, not likes."],
      ]),
      blockChecklist([
        { cat: "Metrics", text: "Record followers, DMs, saves, comments, newsletter signups, discovery calls." },
        { cat: "Content", text: "Choose 2 winning ideas to repeat next week." },
      ]),
    ], "2026-05-24"),
  ];

  const additional = child("churns_week_1_additional_ideas", "Additional Content Ideas", "💡", [
    blockHeading(1, "Additional Content Ideas"),
    blockHeading(2, "Hook Library"),
    blockTable(["Hook", "Why it works", "Best platform"], [
      ["For the last 9 months, I have been building businesses with AI almost every single day.", "Curiosity plus credibility without corporate credentials.", "All"],
      ["I was drowning in information overload, so I started learning AI myself.", "Shared pain and identity.", "Instagram / Threads"],
      ["Most businesses have AI tools. Almost none have AI workflows.", "Contrarian and useful.", "LinkedIn / Threads"],
      ["I used AI to do something that used to take me 3 hours in 8 minutes.", "Specific promise.", "Instagram Reels"],
      ["I built a system that broke. Here is what I learned.", "Story tension.", "Threads / Instagram"],
      ["Show me 1 workflow in your business and I will tell you where AI fits.", "Direct value offer.", "Threads / Instagram"],
      ["Hot take: you do not need more AI tools.", "Contrarian and service-adjacent without hard selling.", "Threads / LinkedIn"],
      ["Here is the prompt I use every Monday.", "Utility and saves.", "Threads / Instagram"],
      ["I am building a CPG brand with AI.", "Series promise.", "Instagram Reels"],
      ["I am not a corporate AI expert.", "Anti-credential positioning.", "All"],
    ]),
    blockHeading(2, "Claude Rate Limit Content"),
    blockText("Hook: Claude just hit my rate limit. Mid-project. Again."),
    blockBullets([
      "If you use Claude seriously, you will hit the wall right when the context is perfect.",
      "Switch to ChatGPT temporarily with the same context.",
      "Use Claude Projects to preserve the session.",
      "Use Gemini as a third tab for research tasks.",
      "Never rely on one AI. Build a rotation.",
    ]),
    blockHeading(2, "Full Content Universe"),
    blockTable(["Format", "Ideas"], [
      ["Instagram Reels", "Launch Intro, Built My Own Notion, WhatsApp Agent Demo, CPG Build Ep.1, Claude Rate Limit, AI Saved Me 10 Hours, Automation That Broke"],
      ["Instagram Carousel", "My AI Stack, How to Automate Your Workflow in 5 Steps, 5 AI Use Cases You Have Not Tried Yet"],
      ["Threads", "Claude Rate Limit, Built My Own Notion, Free Workflow Offer, AI Prompt, AI News Hot Take, Mistake Story, Mini Case Study, Week Reflection"],
      ["LinkedIn", "CPG AI Launch Breakdown, AI Tools vs AI Workflows, Workflow Audit Series, What I Built This Week, Mistake That Cost Me X"],
    ]),
  ]);

  return [weekPage, instagram, threads, linkedin, additional];
}

function buildChurns60DayContentPages() {
  const parentId = "churns_60_day_content";
  const platformHeaders = ["Day", "Threads", "X", "LinkedIn", "Instagram"];
  const weeklyPage = (id, title, icon, summary, goal, kpi, rows, newsletter) => ({
    id,
    parentId,
    title,
    icon,
    date: "",
    blocks: [
      blockHeading(1, title),
      blockCallout("🎯", `${summary} Goal: ${goal}`),
      blockHeading(2, "KPI Gate"),
      blockText(kpi),
      blockHeading(2, "Posting Plan"),
      blockTable(platformHeaders, rows),
      blockHeading(2, "Newsletter"),
      blockText(newsletter),
    ],
  });

  const parent = {
    id: parentId,
    parentId: null,
    title: "Churns 60 Days Content",
    icon: "🗓️",
    date: "2026-05-17",
    blocks: [
      blockHeading(1, "CHURNS AI — 60-Day Content Plan"),
      blockText("How to start · day by day · platform by platform · what to post"),
      blockCallout("🎯", "Posting starts Sunday 17 May. Audience: business owners who are curious about AI but stuck on where to start."),
      blockHeading(2, "60-Day Milestone Targets"),
      blockKpis([
        { label:"Personal Brand Followers", value:"2,000", change:"total target" },
        { label:"Newsletter Subscribers", value:"500", change:"owned audience" },
        { label:"Discovery Calls", value:"30", change:"qualified calls" },
        { label:"Clients Closed", value:"6", change:"content-sourced" },
        { label:"Total Revenue", value:"RM 30K", change:"target" },
      ]),
      blockHeading(2, "The One Rule"),
      blockCallout("🍽️", "Before writing any post, ask: would I say this to a friend at mamak who runs a business? If yes, post it exactly like that. If no, rewrite until you would."),
      blockHeading(2, "Setup Checklist Before Day 1"),
      blockChecklist([
        { cat:"Content", text:"Update bio on all 4 platforms with the Churns AI positioning." },
        { cat:"Content", text:"Pin one intro post on each platform: who you are, who this is for, what you post about." },
        { cat:"AI Systems", text:"Set up n8n STUCK keyword bot: DM STUCK -> 3 questions -> calendar or resource." },
        { cat:"ChurnsOS", text:"Create ChurnsOS Phase 0 library with /agents /workflows /schemas /sops /reports." },
        { cat:"Content", text:"Create Notion content tracker: idea, pillar, platform, status, impressions, DMs generated." },
      ]),
      blockHeading(2, "Weekly Production System"),
      blockTable(["Day", "Action", "Time", "Output"], [
        ["Monday", "Record 15-20 min voice note or Loom: what you built, what surprised you, what a client said, what you noticed.", "20 min", "Raw material for the week"],
        ["Monday", "Feed transcript to Claude and extract 5 post ideas: observation, use case, honest moment, reframe, entrepreneur take.", "10 min", "5 drafted post outlines"],
        ["Tuesday", "Write all posts and schedule LinkedIn, Threads, X, and Instagram.", "45 min", "Full week scheduled"],
        ["Tuesday", "Record 1 IG Reel: face to camera or screen recording with narration and captions.", "20 min", "1-2 video pieces"],
        ["Daily AM", "Reply to every comment and DM within first hour. Move hot leads personally.", "15 min", "Pipeline moved"],
        ["Saturday", "Review which posts drove DMs, comments, saves. Double down next week.", "15 min", "Insight for next Loom"],
      ]),
      blockHeading(2, "The Four Content Types"),
      blockTable(["Type", "What it is", "Share trigger", "Platform fit"], [
        ["Observation", "One true thing. No setup. No lesson.", "Recognition", "Threads + X"],
        ["Use Case", "One real scenario: what happened, what AI did, what changed.", "Proof", "Instagram + LinkedIn"],
        ["Carousel", "6-8 slides, one idea all the way, designed to be saved.", "Save", "LinkedIn"],
        ["Honest Moment", "Something went wrong or surprised you. Vulnerability without victimhood.", "Vulnerability", "All platforms"],
      ]),
      blockHeading(2, "Weekly Subpages"),
      blockBullets([
        "Week 1 — AI Founder Content Playbook",
        "Week 2 — Real Use Cases",
        "Week 3 — Founder Operating Model",
        "Week 4 — Proof Week",
        "Week 5 — SEA AI Commentary",
        "Week 6 — 60-Day Debrief Signals",
        "Week 7 — Education Angle",
        "Week 8 — Category Voice",
      ]),
      blockCallout("📌", "The number that matters most is DMs, not likes or impressions. A post with 20 likes and 3 DMs is more valuable than a post with 200 likes and 0 DMs."),
    ],
  };

  const week1FounderPages = buildChurnsWeek1FounderContentPages();
  const pages = [
    parent,
    ...week1FounderPages,
    weeklyPage(
      "churns_60_day_week_2",
      "Week 2 — Real Use Cases",
      "2️⃣",
      "Theme: Show, do not tell.",
      "Make the value concrete. Use cases beat arguments.",
      "First DM qualified through bot. 200+ new followers. 1 carousel with 500+ saves.",
      [
        ["Mon", "XALT got 60 customer messages last week. I handled 3. The business ran anyway.", "Running lean is not about doing less. It is about making sure the right things still get done.", "What the first 30 days of running a consumer brand on AI looked like: numbers only.", "Reel: split screen. 60 messages left, \"3 needed me\" right. 25 seconds."],
        ["Tue", "A buyer asked about a sold-out unit at 2am. By 9am the agent had a qualified lead waiting.", "The most expensive hour in a service business is the one where a hot lead was not answered.", "The conversations happening in your business right now that nobody is reading, and what that costs.", "Timeline: message 2am, booking confirmed 9am. Caption as observation."],
        ["Wed", "Most businesses follow up once then call the lead cold. The lead was never cold. You just stopped showing up.", "60% of warm leads die not because the business did not care. Because nobody remembered.", "Carousel: 5 things business owners do with AI that actually work.", "Reel: n8n workflow running. Caption: \"This is the follow-up sequence. No humans required.\""],
        ["Thu", "POV: you finally try AI properly and realise you have been doing something manually for 2 years that takes 10 minutes.", "AI is not going to take your job. Your competitor who uses it might.", "The 3 workflows I see in every business that should have been automated yesterday.", "Face: \"Let me show you 10 minutes that would save you 5 hours a week.\""],
        ["Fri", "DM me STUCK if AI still feels overwhelming. I will show you where it fits in 30 minutes. No pitch.", "DM STUCK if you want to find where AI fits in your business.", "Who I actually build for, and who I cannot help.", "Text on screen: DM STUCK. 5 spots this week for a free workflow audit call."],
      ],
      "Issue 2: Real use cases: what AI actually looks like in a Malaysian business, not theory."
    ),
    weeklyPage(
      "churns_60_day_week_3",
      "Week 3 — Founder Operating Model",
      "3️⃣",
      "Theme: Running lean on AI.",
      "Show what the day-to-day operating model looks like. XALT is live proof.",
      "500+ followers on at least one platform. 10+ DMs per week.",
      [
        ["Mon", "Running two companies. No team. AI does the inbox, follow-up, reports. I do the decisions. Weirdly manageable.", "Leverage beat headcount. That shift happened faster than anyone expected.", "What my actual week looks like running Churns AI and XALT simultaneously with near-zero headcount.", "Week calendar breakdown: what AI handles, what I handle."],
        ["Tue", "The peace of mind AI gives you is underrated. Knowing messages are handled while you sleep is worth more than the cost.", "When operational noise is handled you can finally think about the business.", "The moment I realised AI was not a productivity tool for me. It was a clarity tool.", "XALT messages overnight. \"I did not check my phone until 9am.\""],
        ["Wed", "Most business owners think AI is for big companies with tech teams. The ones who figured it out are running solo.", "Solo founder plus AI is not a compromise. It is a different operating model.", "Carousel: Running two companies with no team. What AI handles vs what still needs me.", "Carousel Reel adapted for IG."],
        ["Thu", "What I wish someone told me before building AI systems: the technology is the easy part.", "You cannot automate a process you have not written down yet.", "The one thing every business needs before any AI system can work.", "Face: \"Before we build anything, I always ask this one question.\""],
        ["Fri", "Month 1 of building in public. Here is what I know now that I did not know 30 days ago.", "Build in public long enough and the audience self-selects into who you want to talk to.", "30-day honest debrief: what drove DMs, what drove likes, and the difference.", "Face: 30-day debrief on what drove business vs likes."],
      ],
      "Issue 3: The founder operating model: running lean, running on AI, and what that actually looks like."
    ),
    weeklyPage(
      "churns_60_day_week_4",
      "Week 4 — Proof Week",
      "4️⃣",
      "Theme: Real numbers and real moments.",
      "Turn proof into trust. First client should come from the content funnel.",
      "1 paying client closed from content funnel. 1 post with 5K+ impressions.",
      [
        ["Mon", "30 days since a client deployed their AI system. Here are the actual numbers. No rounding.", "The metric that surprised the client most was not bookings. It was messages handled after 6pm.", "30-day case study: what changed, what did not, what surprised them.", "Before/after graphic: response time, missed messages, bookings."],
        ["Tue", "Client message this week: \"I stopped checking my phone at night.\" That is the product.", "The goal was never automation. It was peace of mind.", "Carousel: Every business owner I talk to says the same thing. Here is the answer.", "Screenshot of client message. One sentence caption."],
        ["Wed", "Most AI agency content shows demos. I show what happened 30 days later. Different thing.", "A demo shows potential. Data shows reality. Show the data.", "The 3 metrics I track for every client that tell you if the system is working.", "Dashboard screen recording: what the monthly report looks like."],
        ["Thu", "The first step is never as hard as the thinking about it.", "Overthinking is the real bottleneck. Not the technology.", "What the first 90 days of working with a business owner on AI looks like.", "Reel: 3-step process from stuck to running."],
        ["Fri", "If you run a business and AI still feels overwhelming, DM me STUCK.", "DM STUCK. 30 minutes. No pitch. Just where it fits.", "Who converted this month from content and what they said when they first reached out.", "Face: Opening 3 more audit call spots."],
      ],
      "Issue 4: 30-day case study: what changed for a real client and why the first step is always hardest."
    ),
    weeklyPage(
      "churns_60_day_week_5",
      "Week 5 — SEA AI Commentary",
      "5️⃣",
      "Theme: SEA opportunity, creator economy, and entrepreneurship.",
      "Expand reach and establish a clear SEA AI voice.",
      "1K Threads followers. Newsletter at 300 subscribers. 15+ DMs per week.",
      [
        ["Mon", "OpenAI raised $4B to work with Fortune 500s. The clinic owner in PJ is not in that conversation. That gap is where I build.", "Big tech is going upmarket. That leaves the middle open. That is the real opportunity.", "What the OpenAI deployment company means for business owners in SEA, and what to do instead.", "Reel: What OpenAI's new company means for your business."],
        ["Wed", "The creator economy in SEA is a RM 100B market running on manual WhatsApp replies and Excel sheets.", "What a creator MCN has in common with a clinic: same inbox problem, same AI solution.", "Carousel: The AI conversation your business is not having yet, creator edition.", "Screen: creator DMs stacking during a live stream."],
        ["Fri", "Consistency is not a content strategy. It is a character test.", "Build in public long enough and the audience tells you exactly what they want.", "What building in public feels like when the numbers are not moving, and why you post anyway.", "Face: Week where nothing clicked. Posted anyway."],
      ],
      "Issue 5: The SEA AI opportunity US companies cannot see, and why that is exactly the point."
    ),
    weeklyPage(
      "churns_60_day_week_6",
      "Week 6 — 60-Day Debrief Signals",
      "6️⃣",
      "Theme: What people actually say when AI feels overwhelming.",
      "Use real audience feedback to sharpen positioning and conversion.",
      "Newsletter at 300+ subscribers. 15+ DMs per week. Clear pattern on what drives inbound.",
      [
        ["Mon", "Ran the DM STUCK bot for 30 days. Here is what people actually told me was stopping them.", "The answer was never \"I do not understand the technology.\" It was always something else.", "The 5 most common things people said when I asked what makes AI feel overwhelming.", "Carousel: 5 reasons people are stuck. One per slide."],
        ["Wed", "60 days of posting. Here is what actually drove inbound vs what just got likes.", "Likes are vanity. DMs are signal. Build for DMs.", "60-day honest debrief: what worked, what did not, what I changed.", "Graph: post type vs DMs generated. Real data from tracker."],
        ["Fri", "Started building in public expecting clients. Also got people who just wanted to talk about AI. Both useful.", "The audience self-selects when you are specific enough for long enough.", "What I know about building a content funnel now that I did not know 60 days ago.", "Face: Eight weeks in. The honest version of what happened."],
      ],
      "Issue 6: 60-day honest debrief: what drove business, what drove followers, what I am changing."
    ),
    weeklyPage(
      "churns_60_day_week_7",
      "Week 7 — Education Angle",
      "7️⃣",
      "Theme: Help people unstick themselves.",
      "Signal the education product before announcing it.",
      "Newsletter at 500 subscribers. Audit calls converting 30%+ to clients.",
      [
        ["Mon", "The most important question you can ask about your business: where do you repeat yourself every single day?", "Find the repetition. That is where AI goes. Every time.", "The 3 questions I use to find where AI fits in any business, regardless of industry.", "Reel: walk through the 3 questions. Face to camera."],
        ["Wed", "You do not need to understand how AI works. You need to understand your own workflow well enough to know where you keep losing time.", "The workflow knowledge is the hard part. The AI is just the tool.", "Carousel: The stuck feeling is real. Here is how to break out.", "Carousel Reel adapted for IG."],
        ["Fri", "Thinking about running a workshop. Half day. For business owners who want to figure out where AI fits. Would you come?", "Thinking of running a half-day workshop for business owners stuck on AI. DM WORKSHOP if interested.", "Soft announcement: gathering interest for a workshop, who it is for, what it covers.", "Face: Thinking about running a workshop. Here is what I am planning."],
      ],
      "Issue 7: Workshop announcement and the 3 questions that help a business find where AI fits."
    ),
    weeklyPage(
      "churns_60_day_week_8",
      "Week 8 — Category Voice",
      "8️⃣",
      "Theme: Specificity beats technical knowledge.",
      "Position as the person who helps business owners cross from curious to useful.",
      "Newsletter at 500 subscribers. 30 discovery calls. 6 clients closed. RM 30K revenue target in sight.",
      [
        ["Mon", "The businesses winning with AI right now are not the most technical ones. They are the most specific ones.", "Specific beats smart every time when it comes to AI.", "What 2 months of client builds taught me about who actually gets value from AI.", "Reel: before and after workflow. Two businesses. One specific, one vague."],
        ["Fri", "8 weeks of building in public. Here is the one thing I would do differently from Day 1.", "What I know now. What I would change. What I am keeping exactly the same.", "8-week comprehensive debrief: what drove clients, what drove followers, what is next.", "Face: Eight weeks in. The honest version of what happened."],
      ],
      "Issue 8: 8-week debrief: what drove clients, what drove followers, and what comes next."
    ),
  ];

  return pages;
}

function buildXaltWeek1ScriptPages() {
  const parentId = "xalt_week_1_script";
  return [
    {
      id: parentId,
      parentId: null,
      title: "Week 1 Script",
      icon: "🎬",
      date: "2026-05-17",
      blocks: [
        blockHeading(1, "Week 1 Script"),
        blockCallout("🎬", "XALT founder-led content scripts for Week 1. Keep the reel clean, premium, personal, and honest."),
        blockHeading(2, "Episode List"),
        blockBullets(["Episode 1 — The Real Reason We Started XALT (45s Founder Reel)"]),
        blockHeading(2, "Week 1 Creative Rule"),
        blockText("Use subtitles only for the exact words spoken. Do not add extra callouts, explanatory captions, or clutter. The reel should feel like a founder story, not an ad."),
      ],
    },
    {
      id: "xalt_episode_1_reel_script",
      parentId,
      title: "Episode 1 Reel Script",
      icon: "🎥",
      date: "2026-05-17",
      blocks: [
        blockHeading(1, "XALT — Episode 1 Reel Guide"),
        blockText("45-second founder-led script + iPhone footage direction"),
        blockCallout("🎯", "Creative direction: Keep the reel clean and premium. No extra on-screen text. Only use subtitles that match exactly what is spoken in the hook, voiceover, and CTA."),

        // ── SECTION 1: SCRIPT (for reading) ──────────────────────────────
        blockHeading(2, "Script — For Reading"),
        blockCallout("📖", "Open a timer while recording. 45 seconds total. Read this aloud during takes."),
        blockHeading(3, "Hook (Scene 1) — Both to camera"),
        blockText("Male: \"Here’s the real reason…\""),
        blockText("Female: \"…we started XALT.\""),
        blockHeading(3, "Hospital Story (Scene 2) — Female voiceover"),
        blockText("\"A few months ago, I was admitted to the hospital for kidney stones.\""),
        blockText("\"Not once — four times in two years.\""),
        blockText("\"Same diagnosis every time: I wasn’t hydrating properly.\""),
        blockHeading(3, "Chat Moment (Scene 3) — Female voiceover"),
        blockText("\"So we did what any reasonable person would do…\""),
        blockText("\"We went to Chat and typed:\""),
        blockText("\"How should I stay hydrated?\""),
        blockHeading(3, "Realisation (Scene 4) — Female voiceover"),
        blockText("\"Turns out, humans don’t just hydrate with water.\""),
        blockText("\"So we started looking for something better.\""),
        blockHeading(3, "Convenience Store Problem (Scene 5) — Male voiceover"),
        blockText("\"But every drink we picked up felt the same.\""),
        blockText("\"Dipotassium phosphate. Sucralose.\""),
        blockText("\"Ingredients we could barely pronounce.\""),
        blockText("\"And the ones we did understand were usually just sugar.\""),
        blockHeading(3, "The Bigger Problem (Scene 6) — Male voiceover"),
        blockText("\"Other drinks we found on the shelf felt too intense, too clinical, too serious.\""),
        blockText("\"Like they were made for someone finishing an Ironman at 5am.\""),
        blockHeading(3, "Everyday People (Scene 7) — Male voiceover"),
        blockText("\"But what about people like us?\""),
        blockText("\"Working, running errands, going gym, and trying not to crash by 3pm.\""),
        blockHeading(3, "XALT (Scene 8) — Female voiceover"),
        blockText("\"So we stopped looking.\""),
        blockText("\"And started building XALT.\""),
        blockText("\"An electrolyte drink made for everyday hydration with obsessive flavours.\""),
        blockText("\"Something you’d actually look forward to daily — like your morning coffee.\""),
        blockHeading(3, "CTA (Scene 9) — Both to camera"),
        blockText("Female: \"We’re documenting every step of this journey.\""),
        blockText("Male: \"So follow along.\""),

        // ── SECTION 2: SHOT LIST (for filming) ───────────────────────────
        blockHeading(2, "Shot List — For Filming"),
        blockCallout("🎬", "Shoot everything vertical in 9:16. iPhone back camera. 4K — 24fps or 30fps. Keep B-roll clips short: 2–4 seconds each."),
        blockHeading(3, "Scene 1 — Hook"),
        blockBullets([
          "Founder looks into camera and says the line",
          "Film at the cafe — chest-up vertical shot, keep it casual",
          "Record with the wireless mic",
          "Take 3 versions: calm and serious / more casual / slight pause before \"XALT\"",
        ]),
        blockHeading(3, "Scene 2 — Hospital Story"),
        blockBullets([
          "Close-up of hospital photo on phone",
          "Finger swiping through hospital photo",
          "Founder sitting quietly looking at the photo",
          "Close-up of hand holding phone",
          "Optional: hospital wristband, medicine, discharge paper if comfortable",
          "Blur or avoid showing sensitive medical details",
        ]),
        blockHeading(3, "Scene 3 — Chat Moment"),
        blockBullets([
          "Founder opening laptop or phone",
          "Close-up of typing: \"How should I stay hydrated?\"",
          "Founder leaning back and thinking",
          "Glass of water beside laptop",
          "Over-the-shoulder shot of the screen",
          "Screen record and bubble it — 1–2 seconds on the question",
        ]),
        blockHeading(3, "Scene 4 — Realisation"),
        blockBullets([
          "Founder looking at a glass of water",
          "Close-up of water bottle on table",
          "Founder drinking plain water, then reacting: \"Is this enough?\"",
          "Founder and partner walking into convenience store",
          "Hand reaching for phone, zoom-out transition to POV view of fridge from inside",
        ]),
        blockHeading(3, "Scene 5 — Convenience Store Problem"),
        blockBullets([
          "Opening convenience store fridge",
          "Wide shot of drinks inside the fridge",
          "Hand picking up a bottle",
          "Close-up of turning the bottle to read ingredients",
          "Finger pointing at the ingredient list",
          "Founder squinting or reacting subtly",
          "Founder showing bottle to partner — partner gives \"what is this?\" reaction",
          "Founder puts the drink back",
          "Close-up of another bottle’s sugar/nutrition panel",
          "Avoid showing competitor brand logos too clearly — focus on hands, labels, fridge movement",
        ]),
        blockHeading(3, "Scene 6 — Too Sporty / Too Clinical"),
        blockBullets([
          "Founder standing in front of fridge, overwhelmed by choices",
          "Close-up of sports drink-style bottles without brand logos",
          "Founder putting bottle back",
          "Walking away from the fridge",
          "Optional gym transition: tying shoelaces, entering gym, looking at workout equipment",
          "Mood: slightly humorous, not angry",
        ]),
        blockHeading(3, "Scene 7 — Everyday People"),
        blockBullets([
          "Cafe: founder working on laptop, coffee beside laptop",
          "Cafe: founder rubbing eyes or looking tired",
          "Cafe: close-up of calendar, notebook, laptop, phone messages",
          "Gym: tying shoelaces, walking on treadmill, filling water bottle, resting between sets",
          "Errands: walking on street, carrying grocery bag, getting into car, crossing road or parking area",
          "Walk into the cafe door (transition shot)",
          "Keep it real daily life — not athlete-commercial",
        ]),
        blockHeading(3, "Scene 8 — XALT Building Moment"),
        blockBullets([
          "Founders sitting at cafe table discussing (change cafe location from earlier scenes)",
          "Laptop open with moodboard or notes",
          "Notebook with \"XALT\" written on it",
          "Sketching packaging ideas",
          "Close-up of hands typing",
          "Founder pointing at laptop, both reacting naturally",
          "Coffee cup beside notes",
          "Product not ready yet — keep this as founder journey / idea-building moment",
        ]),
        blockHeading(3, "Scene 9 — CTA"),
        blockBullets([
          "Option 1: both founders say it directly to camera, same style as hook",
          "Option 2: voiceover over B-roll of founders walking away, closing laptop, or writing XALT",
          "Good shots: founders walking out of cafe, closing laptop, writing XALT in notebook, walking side by side, quick final look to camera",
          "End frame: XALT logo or simple blank screen — no extra captions besides subtitle",
        ]),

        // ── SECTION 3: EDIT STRUCTURE ─────────────────────────────────────
        blockHeading(2, "Edit Structure"),
        blockTable(["Timing", "Content"], [
          ["0–3s", "Hook to camera"],
          ["3–10s", "Hospital photo + personal story voiceover"],
          ["10–15s", "Typing into Chat — screen record bubble"],
          ["15–25s", "Convenience store fridge + ingredient problem"],
          ["25–32s", "Too sporty / too clinical / not made for everyday people"],
          ["32–39s", "Cafe, errands, gym daily-life montage"],
          ["39–45s", "Building XALT moment + CTA to camera"],
        ]),

        // ── SECTION 4: SUBTITLE RULES ─────────────────────────────────────
        blockHeading(2, "Subtitle Rules"),
        blockCallout("📝", "Use subtitles only for the exact words spoken. Do not add extra text labels, callouts, or explanatory captions."),
        blockBullets([
          "Do NOT add: \"4 hospital visits\", \"Too much sugar\", \"Everyday hydration\", \"Follow the build\", or \"Made for 3PM crash\"",
          "Use white subtitle, clean font, medium size, bottom center",
          "Add slight black shadow or translucent background for readability",
          "Only highlight key words if needed: kidney stones, four times, Chat, Dipotassium phosphate, Sucralose, sugar, XALT",
          "Do not overdo highlights — the reel should feel clean and premium",
        ]),

        // ── SECTION 5: RECORDING SETUP ────────────────────────────────────
        blockHeading(2, "Recording Setup"),
        blockBullets([
          "Record the hook and CTA with the wireless mic directly into the iPhone",
          "Record the rest as a clean voiceover after filming — this keeps visuals moving fast while story stays clear",
          "Shoot everything vertical in 9:16",
          "Use the iPhone back camera when possible for better quality",
          "Use 4K — either 24fps or 30fps",
          "Keep most B-roll clips short: 2–4 seconds each",
          "Final feeling: real problem → personal reason → market frustration → why XALT exists",
        ]),

        // ── SECTION 6: THINGS TO BRING ────────────────────────────────────
        blockHeading(2, "Things to Bring"),
        blockChecklist([
          { cat:"Shoot", text:"Laptop x 2" },
          { cat:"Shoot", text:"iPad + Apple Pencil" },
          { cat:"Shoot", text:"Notebook + pen" },
          { cat:"Shoot", text:"2–3 cloth / outfit sets" },
          { cat:"Shoot", text:"Gym apparel" },
          { cat:"Shoot", text:"Gym shoes" },
          { cat:"Shoot", text:"Coffee" },
          { cat:"Shoot", text:"Tripod" },
          { cat:"Shoot", text:"Wireless mic" },
        ]),

        // ── SECTION 7: INSTAGRAM CAPTION ─────────────────────────────────
        blockHeading(2, "Instagram Caption"),
        blockCallout("✍️", "Write the caption AFTER reviewing the final cut. Match the tone: honest, warm, founder-led. No hype language."),
        blockHeading(3, "Caption Draft"),
        blockText("Here’s the real reason we started XALT."),
        blockText("A few months ago, I ended up in the hospital for kidney stones. Not once — four times in two years. Same answer every time: not hydrating properly."),
        blockText("So we went looking for something better. What we found on every shelf felt the same — ingredients we couldn’t pronounce, too much sugar, or drinks built for elite athletes who wake up at 5am."),
        blockText("We’re everyday people. Working, running errands, going to the gym, and trying not to crash by 3pm."),
        blockText("So we stopped looking. And started building XALT."),
        blockText("An electrolyte drink made for everyday hydration — with obsessive flavours you’d actually look forward to."),
        blockText("We’re documenting every step of this journey. Follow along."),
        blockHeading(3, "Caption Hashtags"),
        blockText("#XALT #EverydayHydration #FounderStory #BuildingInPublic #Electrolytes #StartupMalaysia #DrinkXALT"),
        blockHeading(3, "Caption Notes"),
        blockBullets([
          "Keep line breaks — Instagram rewards readability, and short lines stop the scroll",
          "First line is the hook — must match or riff off what’s said in the video",
          "CTA at the end: \"Follow along\" is soft and honest — do not add \"link in bio\" unless there’s a real destination",
          "Hashtags: 5–10 relevant ones, not spammy — mix brand + niche + broad",
          "Review caption against final cut before posting — the story must feel consistent",
        ]),
      ],
    },
  ];
}

function buildChurnsWorkspace() {
  const pages = {};
  const rootOrder = [];
  const childOrder = {};
  const addPage = (page) => {
    pages[page.id] = page;
    if (page.parentId) {
      if (!childOrder[page.parentId]) childOrder[page.parentId] = [];
      childOrder[page.parentId].push(page.id);
    } else {
      rootOrder.push(page.id);
    }
  };

  addPage({
    id: "churns_home",
    parentId: null,
    title: "Churns AI — Home",
    icon: "🧠",
    blocks: [
      blockHeading(1, "Churns AI — Operating Bible"),
      blockText("Strategy · Business Plan · Customer Journey OS · Agent Architecture · ChurnsOS · 10-Year Model"),
      blockCallout("🎯", "I design and build AI systems that run the full customer journey for SEA businesses — from first enquiry to repeat sale."),
      blockHeading(2, "North Star"),
      blockKpis([
        { label:"Q4 2027 MRR", value:"RM 4.5M", change:"target model" },
        { label:"2026 Focus", value:"Agency", change:"audit -> build -> retainer" },
        { label:"First vertical", value:"Clinics", change:"high enquiry + sticky" },
        { label:"Platform path", value:"ChurnsOS", change:"library -> report -> dashboard -> portal" },
      ]),
      blockHeading(2, "Core Pages"),
      blockBullets([
        "Identity and thesis: what Churns is, what it is not, and why SEA customer journeys are the wedge.",
        "Business model: agency, vertical SaaS, education, and platform sequencing.",
        "Customer Journey OS: GET, CONVERT, KEEP stages and audit flow.",
        "Agent architecture: classifier, conversation, booking, objection, follow-up, reporting, and guard rails.",
        "Milestones and KPIs: RM 10K to RM 1M MRR path, weekly dashboard, hiring triggers.",
      ]),
    ],
  });

  addPage({
    id: "churns_identity",
    parentId: null,
    title: "Identity & Thesis",
    icon: "🧭",
    blocks: [
      blockHeading(1, "Identity & Thesis"),
      blockCallout("🧠", "Churns AI is not a chatbot company. It is a Customer Journey Operating System company that uses AI agents as the delivery mechanism."),
      blockHeading(2, "What Churns Is Not"),
      blockTable(["Not this", "This"], [
        ["AI chatbot company", "Customer Journey Operating System using AI agents"],
        ["Technology company", "Business outcomes company that uses technology"],
        ["Agency that builds whatever clients ask for", "Consultancy that audits the journey first, then builds the fix"],
        ["Company that sells tools", "Company that sells reply rates, conversion, staff hours saved, revenue recovered"],
      ]),
      blockHeading(2, "The Thesis"),
      blockBullets([
        "The AI wrapper era is over; the surviving moat is integration depth into real customer journeys.",
        "SEA has structural advantages: WhatsApp-first behaviour, local language complexity, fragmented payment rails, and business cultures Western SaaS does not map cleanly.",
        "The real problem is not that owners do not know about AI. Nobody has helped them find the right starting point.",
        "Bootstrap is right because agency cashflow funds vertical SaaS, and every client build becomes a paid product spec.",
      ]),
      blockHeading(2, "Audience Language"),
      blockTable(["Audience", "What to say"], [
        ["Clinic owner", "Stop losing leads to slow WhatsApp replies and missed follow-ups."],
        ["Property team", "Handle enquiries instantly, qualify serious buyers, and follow up consistently."],
        ["Creator / MCN", "Handle DMs, comments, and post-stream follow-up at scale."],
        ["Small founder", "Run customer operations on AI before hiring ahead of cashflow."],
      ]),
    ],
  });

  addPage({
    id: "churns_business_model",
    parentId: null,
    title: "Business Model",
    icon: "💸",
    blocks: [
      blockHeading(1, "Business Model"),
      blockCallout("📌", "Sequencing rule: Phase 1 funds Phase 2. Phase 2 funds Phase 3. Phase 3 builds the audience that makes Phase 4 possible. Right now: Phase 1 only."),
      blockHeading(2, "Four Phases"),
      blockTable(["Phase", "What you do", "Revenue model", "Enter when"], [
        ["Phase 1 — Agency", "Customer Journey Audit -> build the AI system that fixes breaks", "Setup RM 3K-8K + retainer RM 1.5K-8K/mo", "Now"],
        ["Phase 2 — Vertical SaaS", "Package builds into Clinic OS, Creator OS, Property OS", "RM 5K-25K/mo retainers", "After 10 builds templated"],
        ["Phase 3 — Education", "Workshops, cohorts, masterclasses for non-coders", "RM 500-50K per engagement", "After RM 25K MRR + 5 case studies"],
        ["Phase 4 — Platform", "Self-serve ChurnsOS: pick vertical, answer 10 questions, live in 48 hours", "RM 1.5K/mo subscriptions", "After delivery fully templated"],
      ]),
      blockHeading(2, "Revenue Engine"),
      blockKpis([
        { label:"Agency delivery", value:"RM 12K", change:"ARPU/mo" },
        { label:"SaaS whale", value:"RM 80K", change:"ARPU/mo" },
        { label:"Education", value:"80-90%", change:"margin" },
        { label:"Self-serve", value:"RM 1.5K", change:"subscription/mo" },
      ]),
      blockHeading(2, "Quarterly MRR Ramp"),
      blockTable(["Quarter", "Agency", "SaaS", "Education", "Platform", "Total"], [
        ["Q2 2026", "RM 10K", "RM 0", "RM 0", "RM 0", "RM 10K"],
        ["Q3 2026", "RM 30K", "RM 8K", "RM 5K", "RM 0", "RM 43K"],
        ["Q4 2026", "RM 70K", "RM 25K", "RM 18K", "RM 0", "RM 125K"],
        ["Q2 2027", "RM 200K", "RM 400K", "RM 90K", "RM 30K", "RM 780K"],
        ["Q4 2027", "RM 360K", "RM 2.85M", "RM 480K", "RM 585K", "RM 4.5M"],
      ]),
    ],
  });

  addPage({
    id: "churns_journey_os",
    parentId: null,
    title: "Customer Journey OS",
    icon: "🗺️",
    blocks: [
      blockHeading(1, "Customer Journey Operating System"),
      blockText("Every build maps the full customer journey from first message to repeat sale, then deploys AI agents to fix the breaks revealed by the audit."),
      blockHeading(2, "Three Stages"),
      blockTable(["GET", "CONVERT", "KEEP"], [
        ["First contact", "Lead qualification", "Post-sale follow-up"],
        ["Enquiry handling", "Objection handling", "Complaint resolution"],
        ["FAQ response", "Pricing conversation", "Review request"],
        ["Lead capture", "Booking confirmation", "Reactivation"],
        ["Channel routing", "Proposal follow-up", "Referral trigger"],
      ]),
      blockHeading(2, "Audit Flow"),
      blockBullets([
        "Business basics: volume, channels, team size, urgency.",
        "Stage 1 GET: reply speed, after-hours coverage, FAQ consistency.",
        "Stage 2 CONVERT: follow-up frequency, nurture system, booking friction.",
        "Stage 3 KEEP: post-sale process, complaints, reviews, reactivation.",
        "The map is filled live and sent as the one-page output within 24 hours.",
      ]),
    ],
  });

  addPage({
    id: "churns_verticals",
    parentId: null,
    title: "Verticals",
    icon: "🏥",
    blocks: [
      blockHeading(1, "Vertical Strategy"),
      blockCallout("⚖️", "Three primary verticals, one research track. Never more than two primary at once."),
      blockHeading(2, "Clinics & Healthcare"),
      blockTable(["Segment", "Core pain", "ARPU"], [
        ["Aesthetic clinics", "Missing evening/weekend enquiries, inconsistent follow-up", "RM 3K-12K/mo"],
        ["Dental clinics", "Same FAQs all day, booking calls backed up", "RM 2.5K-8K/mo"],
        ["Sports rehab / physio", "Patients ghost after first session, no reactivation", "RM 3K-10K/mo"],
        ["Multi-branch clinic groups", "Inconsistent answers across locations", "RM 15K-50K/mo"],
      ]),
      blockHeading(2, "Creator Economy & Livestream Commerce"),
      blockBullets([
        "Fastest path to accounts above RM 25K/mo.",
        "Fixes DM/comment flood during streams, post-stream revenue bleed, product knowledge inconsistency, and multilingual audience gaps.",
        "MCN compounding move: prove one creator, then sell the system across 30 creators.",
      ]),
      blockHeading(2, "Property & Finance"),
      blockBullets([
        "Property is opportunistic until clinic retention is proven at RM 100K MRR.",
        "Finance is the highest ceiling in SEA, but do not enter without a domain partner and compliance validation.",
      ]),
    ],
  });

  addPage({
    id: "churns_agent_architecture",
    parentId: null,
    title: "Agent Architecture",
    icon: "🤖",
    blocks: [
      blockHeading(1, "Agent Architecture"),
      blockHeading(2, "GET Agents"),
      blockTable(["Agent", "What it does", "Never does"], [
        ["Intake Agent", "Receives first message, logs contact, routes next agent", "Acts before classifying intent"],
        ["Classifier Agent", "Assigns enquiry, booking, complaint, opt-out, urgent, unclear", "Assumes without reading"],
        ["FAQ Agent", "Answers high-frequency questions from knowledge base", "Invents prices or policies"],
      ]),
      blockHeading(2, "CONVERT Agents"),
      blockTable(["Agent", "What it does", "Never does"], [
        ["Conversation Agent", "Replies naturally in brand voice", "Overpromises outcomes"],
        ["Objection Agent", "Handles price, trust, timing, and comparison objections", "Argues or pressures"],
        ["Booking Agent", "Confirms slots, captures details, prepares handoff", "Books without required details"],
      ]),
      blockHeading(2, "KEEP Agents"),
      blockTable(["Agent", "What it does", "Never does"], [
        ["Review Agent", "Requests reviews after successful delivery", "Spams unhappy customers"],
        ["Reactivation Agent", "Finds cold customers and restarts the conversation", "Messages opt-outs"],
        ["Reporting Agent", "Turns Supabase events into monthly business reports", "Hides bad metrics"],
      ]),
      blockHeading(2, "Guard Rails"),
      blockBullets([
        "Never claim certainty where the business has not provided a rule.",
        "Escalate urgent, medical, legal, refund, complaint, or high-risk cases.",
        "Maintain customer memory, but do not repeat questions already answered.",
        "All client-facing AI must log why it made a handoff or qualification decision.",
      ]),
    ],
  });

  addPage({
    id: "churns_churnsos",
    parentId: null,
    title: "ChurnsOS Platform",
    icon: "🧩",
    blocks: [
      blockHeading(1, "ChurnsOS Platform"),
      blockCallout("🧱", "ChurnsOS is not a future product. It is the organised, reusable form of everything built today."),
      blockTable(["Phase", "What it is", "When", "Looks like"], [
        ["0 — Library", "Every workflow, prompt, schema organised by function", "This week", "Folders, READMEs, no UI"],
        ["1 — Report", "Monthly PDF from Supabase via Claude", "After 3 clients", "Scheduled n8n -> Claude -> PDF"],
        ["2 — Dashboard", "Retool or Next.js UI with live Supabase data", "After 8 clients", "Client dashboard link"],
        ["3 — Portal", "Clients update KB, see benchmarks, submit requests", "After 15 clients", "Next.js + Supabase Auth"],
        ["4 — Self-serve", "Pick vertical, connect WhatsApp, live in 48 hours", "After RM 500K MRR", "ChurnsOS product"],
      ]),
      blockHeading(2, "Tech Stack"),
      blockTable(["Layer", "Tool", "Build or buy"], [
        ["Omni-inbox", "Chatwoot self-hosted", "Buy"],
        ["Workflow automation", "n8n self-hosted", "Buy"],
        ["Memory and CRM", "Supabase / Postgres", "Buy"],
        ["AI model", "Claude + OpenAI", "Buy API"],
        ["Client portal", "Next.js on n8n API", "Build"],
        ["Auth and billing", "Supabase Auth + Stripe", "Buy"],
      ]),
    ],
  });

  addPage({
    id: "churns_delivery",
    parentId: null,
    title: "Delivery System",
    icon: "🛠️",
    blocks: [
      blockHeading(1, "Delivery System"),
      blockHeading(2, "14-Day Implementation Plan"),
      blockTable(["Day", "Action"], [
        ["Day 1", "Kickoff, scope lock, access, SOP and FAQ intake, success metrics"],
        ["Days 2-3", "Knowledge base: services, FAQs, booking rules, escalation, prices"],
        ["Days 4-5", "Database setup: leads, messages, booking state, summary, handoff"],
        ["Days 6-7", "Agent setup: classifier, conversation, booking, extraction, handoff"],
        ["Day 8", "Chatwoot and channel integration, staff accounts"],
        ["Days 9-10", "Testing: FAQs, booking, complaint, opt-out, unclear, retrieval accuracy"],
        ["Day 11", "Staff handoff training and escalation playbook"],
        ["Day 12", "Soft launch with 12-hour monitoring"],
        ["Days 13-14", "Fix, tune prompts, improve logs, prepare first report"],
      ]),
      blockHeading(2, "IP Created After Every Build"),
      blockBullets([
        "Reusable workflow diagram and n8n JSON export.",
        "Prompt versions, system rules, guard rails, and failure cases.",
        "Database schema and field definitions added to ChurnsOS library.",
        "Generic SOP version extracted from client-specific SOP.",
        "Screenshots and screen recordings for content and demos.",
      ]),
    ],
  });

  addPage({
    id: "churns_content_funnel",
    parentId: null,
    title: "Content Funnel",
    icon: "📣",
    blocks: [
      blockHeading(1, "Content Funnel: Post to Paying Client"),
      blockCallout("✍️", "Content is not marketing. It is proof of work."),
      blockTable(["Step", "What happens", "Your job", "Bot's job"], [
        ["1. Post", "Someone sees a true observation", "Write one clean observation", "Nothing"],
        ["2. Follow", "They follow because it resonated", "Keep same voice and truth", "Nothing"],
        ["3. Consume", "Trust builds over 5-10 posts", "Post observations, use cases, honest moments", "Nothing"],
        ["4. Keyword", "They DM STUCK, AUDIT, or START", "Set n8n keyword trigger", "Ask 3 qualification questions"],
        ["5. Qualify", "Bot scores hot/warm/cold", "Jump into hot leads within 2 hours", "Route hot/warm/cold"],
        ["6. Audit call", "30 minutes to map journey", "Prepare 3 specific observations", "Reminder and resource follow-up"],
        ["7. Proposal", "Gap, fix, price, timeline", "One page, no jargon", "Follow up at 48 hours"],
        ["8. Signed", "Setup fee paid, build begins", "Onboard fast", "Send welcome and kickoff questionnaire"],
      ]),
      blockHeading(2, "Message Tone"),
      blockText("Right: \"Hey — saw you dropped STUCK. That word comes up in almost every conversation I have with business owners right now. What kind of business do you run?\""),
    ],
  });

  addPage(buildChurnsContentIntelligencePage());
  buildChurns60DayContentPages().forEach(addPage);

  addPage({
    id: "churns_milestones",
    parentId: null,
    title: "Milestones",
    icon: "🏁",
    blocks: [
      blockHeading(1, "Milestone Map"),
      blockMilestones([
        { name:"M1 — RM 10K MRR", date:"2026-06-30", status:"pending" },
        { name:"M2 — RM 25K MRR", date:"2026-07-31", status:"pending" },
        { name:"M3 — RM 50K MRR", date:"2026-08-31", status:"pending" },
        { name:"M4 — RM 100K MRR", date:"2026-12-31", status:"pending" },
        { name:"M5 — RM 250K MRR", date:"2027-03-31", status:"pending" },
        { name:"M6 — RM 1M MRR", date:"2027-06-30", status:"pending" },
      ]),
      blockHeading(2, "Kill Criteria"),
      blockBullets([
        "M1: zero paying clients by end of June -> stop content and run 10 more calls.",
        "M2: zero DMs after 30 posts -> posts are too educational; make them more observational.",
        "M3: delivery still takes 14 days -> stop new clients and template existing builds first.",
        "M4: below RM 70K MRR by end of Q4 -> freeze product work, revisit offer and pricing.",
        "M6: self-serve below 50 signups in 60 days -> return to assisted onboarding.",
      ]),
    ],
  });

  addPage({
    id: "churns_kpis_hiring",
    parentId: null,
    title: "KPIs & Hiring",
    icon: "📊",
    blocks: [
      blockHeading(1, "KPI Dashboard & Hiring Plan"),
      blockHeading(2, "Weekly KPI Dashboard"),
      blockTable(["Metric", "Green", "Amber", "Red"], [
        ["MRR total", "Growing month-on-month", "Flat 3+ weeks", "Declining"],
        ["Net new MRR", "Above stage target", "50-80% of target", "Below 50%"],
        ["Active retainer clients", "Growing", "Flat", "Losing clients"],
        ["Client retention", "Above 90%", "80-90%", "Below 80%"],
        ["Audit calls/week", "5+", "2-4", "0-1"],
        ["DMs received/week", "10+", "4-9", "0-3"],
        ["Content posts/week", "10+", "5-9", "Below 5"],
        ["XALT funding status", "Fully covered", "Partially covered", "Needs savings"],
      ]),
      blockHeading(2, "Hiring Triggers"),
      blockTable(["Hire", "Trigger", "Role", "Cost/mo"], [
        ["Part-time contractor", "RM 25K-35K, delivery-blocked", "SOP prep, testing, documentation", "RM 2K-4K"],
        ["AI Automation Specialist", "RM 50K stable", "Own delivery, frees founder to sell/create", "RM 6K-9K"],
        ["Senior Builder / Engineer", "RM 100K", "ChurnsOS library, reliability, integrations", "RM 10K-15K"],
        ["Sales and CS Lead", "20+ clients or overwhelmed", "Onboarding, renewals, upsell", "RM 7K-10K + commission"],
        ["Content Support", "RM 250K-500K", "Repurpose content, newsletter, community", "RM 5K-8K"],
      ]),
    ],
  });

  addPage({
    id: "churns_xalt_connection",
    parentId: null,
    title: "XALT Connection",
    icon: "💧",
    blocks: [
      blockHeading(1, "XALT Connection"),
      blockCallout("💧", "XALT is not a distraction from Churns. It is the most powerful live case study Churns has."),
      blockTable(["XALT operation", "AI system used", "Churns content angle"], [
        ["Customer service", "AI receptionist on Chatwoot + n8n", "XALT got 60 messages last week. I handled 3. Here is the flow."],
        ["Post-purchase follow-up", "Review agent + reactivation sequence", "Repeat purchase rate moved from 18% to 28%. Here is the architecture."],
        ["Influencer management", "n8n automation for briefs and deadlines", "Managing 20 influencers with zero staff."],
        ["Content distribution", "Marketing agent: one input, 4 platforms", "One product shot -> 5 pieces of content automatically."],
      ]),
      blockHeading(2, "Posting Filter"),
      blockBullets([
        "Post it on founder page if AI is the protagonist and the interesting thing is what the machine did.",
        "Do not post it on founder page if the product, flavour, event, or community is the interesting thing. That goes to XALT account.",
      ]),
    ],
  });

  addPage({
    id: "churns_locked_decisions",
    parentId: null,
    title: "Locked Decisions",
    icon: "🔒",
    blocks: [
      blockHeading(1, "Locked Decisions & 10-Year Model"),
      blockTable(["Decision", "Why locked"], [
        ["Primary audience: non-coders who are curious but stuck", "Large enough, pays well, underserved"],
        ["Bootstrap only through 2026", "Agency cashflow funds everything"],
        ["No build below RM 3K/mo retainer", "Below this is freelancing, not a business"],
        ["No more than 2 primary verticals at once", "Every new vertical dilutes delivery and content"],
        ["Every build goes into ChurnsOS library", "If not in the library, it costs twice what it should"],
        ["Platform phases cannot be skipped", "Library -> Report -> Dashboard -> Portal -> Self-serve"],
      ]),
      blockHeading(2, "10-Year Shape"),
      blockTable(["Year", "Business shape", "Primary risk"], [
        ["2026", "Solo founder agency, clinics and creators, ChurnsOS Phase 0-1", "Founder burnout, too many verticals"],
        ["2027", "Team 8-15, full agent stack proven, ChurnsOS beta", "Client concentration, platform timing"],
        ["2028", "Platform at scale, 3 vertical packs, education standalone", "Model commoditisation"],
        ["2030", "Regional SEA AI company across MY, SG, ID, TH", "Talent war, regulatory divergence"],
        ["2035", "Category-defining, founder optional in daily ops", "Franchise or exit decision"],
      ]),
    ],
  });

  return { pages, rootOrder, childOrder, currentPageId: "churns_home" };
}

function buildXaltStrategyWorkspace() {
  const pages = {};
  const rootOrder = [];
  const childOrder = {};

  function addPage(page) {
    pages[page.id] = page;
    if (page.parentId) {
      if (!childOrder[page.parentId]) childOrder[page.parentId] = [];
      childOrder[page.parentId].push(page.id);
    } else {
      rootOrder.push(page.id);
    }
  }

  addPage({
    id: "xalt_home",
    parentId: null,
    title: "XALT — Home",
    icon: "💧",
    date: "2026-05-15",
    blocks: [
      blockHeading(1, "XALT — Functional Hydration Co."),
      blockText("Strategic Master Plan 2026 to 9-Figure Exit · Updated May 2026"),
      blockCallout("💧", "\"Your daily without the drag.\""),
      blockHeading(2, "Key Metrics at a Glance"),
      blockKpis([
        { label:"2026 Revenue Target", value:"RM 208K", change:"cashflow-funded" },
        { label:"2027 Revenue Target", value:"RM 1M", change:"scale phase" },
        { label:"Launch Timeline", value:"Q3 2026", change:"Aug-Sep" },
        { label:"Gross Margin", value:"70%", change:"sachet DTC" },
      ]),
      blockHeading(2, "Launch Day Goals — August Week 2"),
      blockTable(["Goal", "Target", "Notes"], [
        ["Views per Video", "100,000", "Across IG, XHS, LinkedIn"],
        ["Followers per Platform", "5,000-10,000", "IG primary focus"],
        ["Waitlist Captured", "10,000", "Pre-launch email list"],
        ["Boxes Sold at Launch", "900", "DTC + event + Shopee combined"],
        ["Launch Week Impressions", "100,000+", "Total cross-platform reach"],
        ["Q3 Revenue", "RM 108,000", "900 boxes x RM 120 avg"],
      ]),
      blockHeading(2, "Workspace Map"),
      blockBullets([
        "Brand DNA and positioning define what XALT should feel like in every channel.",
        "Product, finance, distribution, marketing, AI systems, KPI, hiring, milestone, and exit pages hold the operating plan.",
        "The pre-launch checklist is split by execution phase so the team can track tasks directly inside this workspace.",
      ]),
    ],
  });

  addPage({
    id: "xalt_identity",
    parentId: null,
    title: "Vision, Mission & Brand DNA",
    icon: "🧬",
    blocks: [
      blockHeading(1, "Vision, Mission & Brand DNA"),
      blockHeading(2, "Vision"),
      blockText("To become Southeast Asia's most trusted everyday hydration brand — the one people reach for without thinking twice, because it actually works and feels like it was made for their real life."),
      blockHeading(2, "Mission"),
      blockText("XALT makes functional hydration effortless, honest, and worth sharing. We create clean, effective electrolyte products for people who show up daily — at their desk, in the gym, on the move — and need to feel sharp, not stimulated."),
      blockHeading(2, "Brand DNA"),
      blockTable(["Element", "Description"], [
        ["Personality", "Vibrant, approachable, honest, science-backed. Poppi energy meets functional wellness."],
        ["Promise", "No nasties. No sugar crash. No confusion. Just hydration that works."],
        ["Feeling", "Calm clarity. Like you've got your life together, quietly."],
        ["Aesthetic", "Clean, modern, desk-chic. Something you're proud to be seen with."],
        ["Signal", "The Strava log of hydration. A daily ritual you post about."],
      ]),
      blockHeading(2, "Taglines & Voice"),
      blockTable(["Type", "Tagline", "Use"], [
        ["Primary", "Your daily without the drag.", "Core brand and daily habit positioning"],
        ["Original", "Hydration that works for the everyday you.", "Long copy and packaging"],
        ["Alternative", "The one thing you'll actually do every day.", "Habit formation and relatable humor"],
        ["Cheeky", "Future me says thanks.", "Instagram, Stories, captions"],
        ["Community", "Made for people who show up, not show off.", "Events and community content"],
      ]),
      blockHeading(2, "Operating Principles"),
      blockBullets([
        "Consistency beats intensity in hydration and in business.",
        "Transparency first: build in public and share wins and losses with the community.",
        "Ingredient honesty: no hidden nasties, ever.",
        "Community over customers: build tribes, not transactions.",
        "Earn before you scale: cashflow funds growth.",
        "Sweat the details on flavour because great taste drives repeat purchase.",
      ]),
      blockHeading(2, "What XALT Will Never Do"),
      blockBullets([
        "Add sugar or artificial stimulants to hit a sales metric.",
        "Overstate efficacy claims without scientific backing.",
        "Partner with creators who do not authentically align with the brand.",
        "Scale before the product experience is right.",
      ]),
    ],
  });

  addPage({
    id: "xalt_market",
    parentId: null,
    title: "Customer Profile & Positioning",
    icon: "🎯",
    blocks: [
      blockHeading(1, "Customer Profile & Market Positioning"),
      blockHeading(2, "Primary: Young Adult Women 18-35"),
      blockTable(["Dimension", "Detail"], [
        ["Job type", "Corporate desk, entrepreneur, salesperson, content creator, university student"],
        ["Daily life", "Office 9-5, gym/yoga/pilates 3x per week, travel 1-2x per month, side hustle evenings"],
        ["Pain point", "3pm brain fog, constant bathroom trips from plain water, jet lag, feeling puffy not sharp"],
        ["Self-talk", "I need to stay hydrated and focused all day. Something desk-chic, not Gatorade."],
        ["When she buys", "Morning desk ritual, pre/post workout, airport lounge, post-run club share"],
        ["Not for", "Hardcore CrossFit, stimulant seekers, sedentary non-actives"],
      ]),
      blockHeading(2, "Secondary Segments"),
      blockBullets([
        "Active teens 13-18: school, tuition, weekend sports, dry skin, headachy afternoons, and a shareable product identity.",
        "Men 18-35 functional minimalists: work, gym, social, better habits, no gimmicks, no loud sports-drink vibe.",
      ]),
      blockCallout("📌", "Positioning: Daily hydration with the perfect amount of electrolytes for the everyday you. Calm focus plus adequate sweat replacement. Zero sugar. 3 essential vitamins, 6 key electrolytes, clean ingredients."),
      blockHeading(2, "Competitive Differentiation"),
      blockTable(["Attribute", "XALT", "Isotonic Sports Drinks", "Vitamin Waters"], [
        ["Sugar", "Zero", "High carbs", "Medium"],
        ["Electrolytes", "6 key daily-dose electrolytes", "High sodium only", "Minimal"],
        ["Vitamins", "B6, D, C", "None", "Some low dose"],
        ["Vibe", "Calm daily habit", "Loud and sporty", "Fake wellness"],
        ["Who for", "Everyday active", "Athletes", "Mass market"],
      ]),
    ],
  });

  addPage({
    id: "xalt_product",
    parentId: null,
    title: "Product Info & Roadmap",
    icon: "📦",
    blocks: [
      blockHeading(1, "Product Strategy"),
      blockHeading(2, "SKU 1: XALT Daily Hydration Sachet"),
      blockTable(["Spec", "Detail"], [
        ["Electrolytes", "Na 500mg, K 300mg, Mg 100mg, Ca, Phosphorus, Chloride"],
        ["Vitamins", "Vitamin B6 for focus, Vitamin D for bones/immune, Vitamin C antioxidant"],
        ["Format", "30 sachets per box, dissolves in 300-500ml water"],
        ["Price", "RM 120 per box, RM 4.00 per sachet"],
        ["COGS", "RM 36 per box, RM 84 gross profit, 70% margin"],
        ["Target use", "Morning ritual, desk hydration, light workout, travel"],
      ]),
      blockHeading(2, "SKU 2: XALT Focus Hydration Sachet"),
      blockTable(["Spec", "Detail"], [
        ["Includes", "Everything in Daily plus prebiotic 2g"],
        ["Extra", "Gut-brain clarity and cognitive focus positioning"],
        ["Format", "30 sachets per box, dissolves in 300-500ml water"],
        ["Price", "RM 140 per box, RM 4.67 per sachet"],
        ["COGS", "RM 39 per box, RM 101 gross profit, 72% margin"],
        ["Target use", "Deep work, exam prep, long-haul travel, post-travel recovery"],
      ]),
      blockHeading(2, "Flavour Direction"),
      blockBullets([
        "2 launch flavours in a tropical-light direction: lychee, yuzu, watermelon lime.",
        "Refreshing, not sweet, with no artificial aftertaste.",
        "Q4 2026: add 2 flavour extensions based on DTC feedback.",
      ]),
      blockHeading(2, "Product Roadmap"),
      blockTable(["Phase", "Timeline", "Product"], [
        ["Phase 1", "Q3 2026", "Daily + Focus sachets, 2 flavours each"],
        ["Phase 2", "Q4 2026", "2 new flavour extensions + limited seasonal SKU"],
        ["Phase 3", "Q1-Q2 2027", "RTD bottle + Hydration Gummies"],
        ["Phase 4", "Q3-Q4 2027", "Athlete Recovery Sachet + Corporate wellness bundles"],
      ]),
      blockCallout("✅", "R&D complete. OEM partner confirmed. Launch batch is 30,000 sachets across 2 flavours x 2 SKUs. Next: packaging finalisation, branding lock, content production."),
    ],
  });

  addPage({
    id: "xalt_finance",
    parentId: null,
    title: "Unit Economics & Financial Plan",
    icon: "💰",
    blocks: [
      blockHeading(1, "Unit Economics & Financial Plan"),
      blockHeading(2, "Per-Unit Economics"),
      blockTable(["Metric", "Daily SKU", "Focus SKU"], [
        ["Selling Price / sachet", "RM 4.00", "RM 4.67"],
        ["COGS / sachet", "RM 1.20", "RM 1.30"],
        ["Gross Margin / sachet", "RM 2.80 (70%)", "RM 3.37 (72%)"],
        ["Price / box", "RM 120", "RM 140"],
        ["COGS / box", "RM 36", "RM 39"],
        ["Gross Profit / box", "RM 84", "RM 101"],
      ]),
      blockHeading(2, "2026 Revenue Roadmap"),
      blockTable(["Quarter", "Boxes Sold", "Avg Price", "Revenue", "Gross Profit", "Notes"], [
        ["Q2 Pre-launch", "0", "-", "-", "-", "R&D + brand build"],
        ["Q3 Launch", "900", "RM 120", "RM 108,000", "RM 75,600", "Launch event + DTC"],
        ["Q4 Scale", "800", "RM 125", "RM 100,000", "RM 70,000", "B2B + Shopee"],
        ["2026 Total", "1,700", "RM 122", "RM 208,000", "RM 145,600", "Target: RM 200K+"],
      ]),
      blockHeading(2, "Launch CAPEX Budget"),
      blockTable(["Item", "Low", "High"], [
        ["Product / OEM", "RM 36,000", "RM 40,000"],
        ["Branding & packaging design", "RM 5,000", "RM 8,000"],
        ["Influencer marketing + paid ads", "RM 5,000", "RM 10,000"],
        ["Launch event & community activation", "RM 5,000", "RM 8,000"],
        ["Promotions & sampling", "RM 8,000", "RM 12,000"],
        ["Merchandise", "RM 3,000", "RM 5,000"],
        ["E-commerce setup", "RM 1,500", "RM 3,000"],
        ["Total Launch CAPEX", "RM 63,500", "RM 86,000"],
      ]),
      blockHeading(2, "2027 Scale Target"),
      blockBullets([
        "RM 1,000,000 revenue from about 8,200 boxes across DTC, Shopee/Lazada, B2B and retail.",
        "Expand to 200+ retail touchpoints: Guardian, Watson, boutique gyms, cafes.",
        "Launch RTD product and Hydration Gummies habit line.",
        "Subscription model at 20-30% repeat rate by Q2 2027.",
        "Corporate wellness bundles create recurring B2B revenue.",
      ]),
    ],
  });

  addPage({
    id: "xalt_distribution",
    parentId: null,
    title: "GTM & Distribution",
    icon: "🚚",
    blocks: [
      blockHeading(1, "Go-To-Market & Distribution"),
      blockHeading(2, "Distribution Mix"),
      blockTable(["Channel", "% Revenue", "Strategy"], [
        ["DTC Website", "45%", "Highest margin. Email capture, subscription push, social-to-site conversion."],
        ["Shopee / Lazada", "25%", "Volume driver. Flash sales, influencer affiliate links, bundled discounts."],
        ["B2B Corporate/Office", "15%", "Recurring employee wellness orders. Minimum 50 boxes per order."],
        ["Events & Pop-ups", "10%", "Brand awareness and trial. Convert to DTC post-event."],
        ["Affiliate / Influencer", "5%", "Nano/micro creators, commission-based, run/yoga/wellness niches."],
      ]),
      blockHeading(2, "Launch Event Strategy"),
      blockBullets([
        "Wellness activation with pop-ups, tasting stations, both SKUs, both flavours, and fitness challenges.",
        "On-spot subscription sign-ups with 15% early-bird pricing for waitlist members.",
        "Partner with 3-5 fitness communities: run clubs, yoga studios, pilates.",
        "Targets: 900 boxes sold, 10,000 waitlist captures, 100,000+ launch week impressions.",
      ]),
      blockHeading(2, "Community & Events Calendar 2026"),
      blockTable(["Month", "Activity", "Goal"], [
        ["Apr-Jun", "Pre-launch community building", "2K email list, 10K IG/XHS followers, formulation locked"],
        ["Jul", "Influencer seeding", "Build buzz, 3 hero review videos live before launch"],
        ["Aug", "Launch event + DTC + Shopee live", "900 boxes, 10K waitlist, 100K impressions"],
        ["Sep-Oct", "5 KL run/yoga/pilates events", "5K tribe, 30% repeat order rate"],
        ["Nov-Dec", "B2B push + Shopee 12.12 sale", "50 corporate accounts, RM 200K YTD"],
      ]),
    ],
  });

  addPage({
    id: "xalt_marketing",
    parentId: null,
    title: "Marketing & Content Strategy",
    icon: "📣",
    blocks: [
      blockHeading(1, "Marketing & Content Strategy"),
      blockHeading(2, "Social Channel Strategy"),
      blockTable(["Platform", "Priority", "Role", "Cadence"], [
        ["Instagram", "#1 Primary", "Organic content, brand identity, community, Reels engine", "5-7 posts/week + daily Stories"],
        ["Xiaohongshu", "#2", "Lifestyle aesthetic and Malaysian female wellness audience", "3-4 posts/week"],
        ["LinkedIn", "#3", "Build-in-public, B2B pitches, thought leadership", "2-3 posts/week"],
        ["Meta", "#4", "Paid retargeting, community groups, older audience", "Paid ads + 1-2 organic/week"],
      ]),
      blockHeading(2, "Weekly Content Machine"),
      blockTable(["Format", "Frequency", "Detail"], [
        ["Reels", "3/week", "Tue, Thu, Sat: lifestyle + education + BTS"],
        ["Carousel", "1/week", "Sunday educational deep-dive or social proof"],
        ["Stories", "3-5/day", "Polls, tips, countdown, community"],
        ["Lives", "Weekly", "Q&A or BTS during pre-launch and launch period"],
      ]),
      blockHeading(2, "Content Pillars"),
      blockTable(["Pillar", "%", "Content Examples"], [
        ["Behind the Scenes", "25%", "OEM factory, formulation story, packaging reveal, founder moments"],
        ["Product Education", "25%", "Electrolytes, ingredient transparency, zero sugar explained"],
        ["Lifestyle / Identity", "20%", "Morning ritual, gym bag, desk setup"],
        ["Social Proof / UGC", "15%", "Customer photos, energy stories, run club moments"],
        ["Build in Public", "10%", "Revenue milestones, challenges, decisions"],
        ["Community", "5%", "Run club events, yoga coverage, tribe member highlights"],
      ]),
      blockHeading(2, "Influencer Strategy"),
      blockTable(["Tier", "Creators", "Model", "Role"], [
        ["Nano", "20 creators", "Gifting only", "Authentic niche audiences: run, yoga, desk wellness, travel"],
        ["Micro", "5-8 creators", "Commission + gifting", "Key brand partners with promo codes"],
        ["Macro", "1-2 per quarter", "Negotiated fee", "Awareness spikes around launches and product drops"],
      ]),
    ],
  });

  addPage({
    id: "xalt_ai_sales",
    parentId: null,
    title: "AI Marketing & Sales System",
    icon: "🤖",
    blocks: [
      blockHeading(1, "AI-Powered Marketing & Sales System"),
      blockHeading(2, "AI Agent Stack"),
      blockTable(["Agent", "Function", "Tools"], [
        ["AI Content Agent", "Reel scripts, carousel copy, Stories prompts, captions in XALT voice. Cuts production time 60%.", "Claude API, Notion"],
        ["AI Lead Nurture Agent", "Waitlist welcome, cart abandon, post-purchase flows personalized by source and behavior.", "Klaviyo / Mailchimp"],
        ["AI Influencer Outreach", "Finds nano/micro creators, writes DMs, tracks responses, follows up.", "n8n / Make.com"],
        ["AI B2B Sales Agent", "LinkedIn outreach, cold email, 7-touch follow-up, routes hot leads to founder.", "Clay.com, HubSpot"],
        ["AI Analytics Agent", "KPI dashboard from IG, Shopee, email and ads. Weekly auto-report.", "Looker Studio, n8n"],
        ["AI Support Agent", "24/7 DMs, Shopee chat, website FAQ and order support with escalation.", "Tidio / Intercom"],
      ]),
      blockHeading(2, "Build Priority"),
      blockTable(["Phase", "When", "System", "Priority"], [
        ["Phase 1", "This week", "AI Content Agent + Email Automation", "Critical"],
        ["Phase 2", "Week 3", "AI Influencer Outreach Agent", "High"],
        ["Phase 3", "Week 5", "AI B2B Sales Agent", "High"],
        ["Phase 4", "Week 8", "Analytics Dashboard + Customer Support", "Medium"],
      ]),
    ],
  });

  addPage({
    id: "xalt_kpis",
    parentId: null,
    title: "KPIs & Monthly Scorecard",
    icon: "📊",
    blocks: [
      blockHeading(1, "KPIs & Monthly Scorecard"),
      blockHeading(2, "2026 Annual KPI Scorecard"),
      blockTable(["KPI", "Q3 Launch", "Q4 Scale", "Full Year 2026"], [
        ["Revenue", "RM 108,000", "RM 100,000", "RM 208,000"],
        ["Boxes Sold", "900", "800+", "1,700+"],
        ["Email / Waitlist Size", "9,000-10,000", "15,000", "20,000+"],
        ["Social Tribe", "5,000", "15,000", "30,000+"],
        ["Repeat Purchase Rate", "20%", "30%", "35%"],
        ["B2B Accounts Active", "5-10", "30-50", "50+"],
        ["Influencer Partners", "10", "25", "40+"],
        ["Launch Impressions", "100,000", "-", "500,000+"],
        ["Gross Margin", "68%+", "70%+", "70%+"],
      ]),
      blockHeading(2, "Weekly KPI Checkpoints"),
      blockTable(["Metric", "Week 4", "Week 8", "Launch Day"], [
        ["IG Followers", "500", "2,500", "5,000+"],
        ["XHS Followers", "200", "1,000", "2,500+"],
        ["LinkedIn Followers", "300", "800", "1,500+"],
        ["Waitlist Signups", "500", "3,000", "10,000+"],
        ["Email List", "200", "1,500", "5,000+"],
        ["Reels Published", "8", "24", "40+"],
        ["Influencer Partners", "3", "10", "20+"],
        ["Best Reel Views", "2,000", "20,000", "100,000+"],
      ]),
    ],
  });

  addPage({
    id: "xalt_hiring",
    parentId: null,
    title: "Hiring Plan",
    icon: "👥",
    blocks: [
      blockHeading(1, "Hiring Plan"),
      blockHeading(2, "Phase 1 — Q2-Q3 2026: Lean Founder-Led"),
      blockTable(["Role", "Type", "Scope"], [
        ["Founder / CEO", "Full-time", "Strategy, brand, content, community, sales"],
        ["OEM / Manufacturing", "Vendor", "Production, quality control, fulfillment"],
        ["Freelance Graphic Designer", "Project-based", "Packaging, content templates, brand assets"],
        ["Part-time Social / Community", "Contract 10 hrs/wk", "IG/XHS scheduling, engagement, DMs"],
        ["E-commerce VA", "Part-time contract", "Shopee/Lazada management, order tracking"],
      ]),
      blockHeading(2, "Phase 2 — Q4 2026: First Hires"),
      blockTable(["Role", "Trigger", "Scope"], [
        ["Marketing & Content Lead", "RM 100K revenue hit", "Full content strategy + community management"],
        ["Sales & B2B Lead", "50+ B2B enquiries/month", "Corporate accounts, retail pitches, wholesale"],
        ["Operations / Fulfillment", "1,000 boxes/month", "Inventory, logistics, Shopee fulfillment, returns"],
      ]),
    ],
  });

  addPage({
    id: "xalt_milestones",
    parentId: null,
    title: "Timeline & Milestones",
    icon: "🏁",
    blocks: [
      blockHeading(1, "Master Timeline & Milestones"),
      blockMilestones([
        { name:"Ignition — foundations locked", date:"2026-05-17", status:"pending" },
        { name:"Go Live — first post + waitlist live", date:"2026-05-24", status:"pending" },
        { name:"Build Momentum — 200 followers + 500 waitlist", date:"2026-05-31", status:"pending" },
        { name:"Amplify — samples shipped + Meta ads activated", date:"2026-06-07", status:"pending" },
        { name:"Proof of Traction — 1K followers + 3K waitlist", date:"2026-06-14", status:"pending" },
        { name:"Mid-Point Check — event venue confirmed", date:"2026-06-21", status:"pending" },
        { name:"Hype Engine ON — hero review video live", date:"2026-06-28", status:"pending" },
        { name:"Pre-Launch Locked — DTC live + subscription active", date:"2026-07-05", status:"pending" },
        { name:"Final Assembly — inventory received and QC'd", date:"2026-07-12", status:"pending" },
        { name:"Countdown — 10K waitlist and full ads live", date:"2026-07-26", status:"pending" },
        { name:"Launch Week — XALT is in the world", date:"2026-08-14", status:"pending" },
      ]),
      blockHeading(2, "13-Week Countdown"),
      blockTable(["Period", "Phase", "Key Actions & Milestones"], [
        ["May 13-17", "Ignition", "OEM brief confirmed, accounts live, first 3 Reels filmed, brand kit locked"],
        ["May 18-24", "Go Live", "First Reel published, waitlist page live, email platform set up"],
        ["May 25-31", "Build Momentum", "200 followers, 500 waitlist, 5 influencer partnerships confirmed"],
        ["Jun 1-7", "Amplify", "500 followers, 1.5K waitlist, samples shipped, Meta ads activated"],
        ["Jun 8-14", "Proof of Traction", "1K followers, 3K waitlist, first influencer review live"],
        ["Jun 15-21", "Mid-Point Check", "2K followers, 4K waitlist, launch event venue confirmed"],
        ["Jun 22-28", "Hype Engine ON", "3K followers, 5K waitlist, hero review video live, order flow tested"],
        ["Jun 29-Jul 5", "Pre-Launch Locked", "4K followers, 7K waitlist, DTC live, subscription active"],
        ["Jul 6-12", "Final Assembly", "5K followers, 8.5K waitlist, full inventory QC'd"],
        ["Jul 13-26", "Countdown", "5K+ followers, 10K waitlist, full ads live, press outreach sent"],
        ["Aug W2", "Launch", "100K views, 10K waitlist, 900 boxes, RM 108K Q3 begins"],
      ]),
      blockHeading(2, "Full Year 2026 Timeline"),
      blockTable(["Period", "Phase", "Key Actions & Milestones"], [
        ["Apr-May 2026", "R&D Done to Brand Lock", "OEM finalised, formulation locked, packaging, content starts May"],
        ["Jun 2026", "Pre-Launch", "Waitlist live, content 3x/week, influencer gifting, email to 2K, Shopee setup"],
        ["Jul 2026", "Pre-Launch Push", "Influencer content live, 3 hero videos, 5K email list, countdown, B2B pitches"],
        ["Aug 2026", "Launch", "Launch event, DTC + Shopee live, 900 boxes, 10K waitlist, 100K impressions"],
        ["Sep-Oct 2026", "Community Scale", "5 run/yoga/pilates events, B2B pitches, 30% reorder rate"],
        ["Nov-Dec 2026", "Q4 Drive", "Shopee 11.11 + 12.12, B2B gifting, flavour tease, RM 200K YTD"],
        ["Q1 2027", "Scale Phase", "200 retail points, Gummies/RTD intro, subscription launch"],
      ]),
    ],
  });

  addPage({
    id: "xalt_exit",
    parentId: null,
    title: "9-Figure Exit Strategy",
    icon: "🚀",
    blocks: [
      blockHeading(1, "9-Figure Business Model & Exit Strategy"),
      blockCallout("🚀", "The 9-figure path is not just selling more sachets. XALT becomes the Liquid I.V. / Athletic Greens / Poppi of Southeast Asia, then exits to a global wellness or beverage giant, or lists on Bursa."),
      blockHeading(2, "4-Stage Growth Plan"),
      blockTable(["Stage", "Timeline", "Revenue", "Valuation", "Strategy"], [
        ["Stage 1: Prove DTC", "2026", "RM 200K-500K", "RM 2-5M", "Validate PMF. Cash-flow funded. Brand-first."],
        ["Stage 2: Build the Platform", "2027-2028", "RM 3-8M", "RM 30-80M", "Subscription + RTD + SG/TH/ID expansion."],
        ["Stage 3: Regional Domination", "2029-2031", "RM 20-50M", "RM 200-500M", "5 SEA markets, 200+ SKUs, 50K+ touchpoints."],
        ["Stage 4: 9-Figure Exit", "2032-2033", "RM 80-120M+", "RM 800M-RM 1.2B+", "Acquirer or Bursa IPO path."],
      ]),
      blockHeading(2, "Revenue Stream Roadmap"),
      blockTable(["Revenue Stream", "Starts", "Description"], [
        ["DTC Subscription", "Q4 2026", "Monthly auto-ship at 10-15% off. 20-30% of customers by Q2 2027."],
        ["B2B Corporate Wellness", "Aug 2026", "Standing monthly office, gym, and co-working orders."],
        ["Retail Expansion", "Q1 2027", "Guardian, Watson, boutique gyms, cafes, 200+ touchpoints."],
        ["RTD Bottle", "Q1 2027", "Premium RTD at RM 8-12/unit with bigger ticket and shelf placement."],
        ["Wellness Gift Bundles", "Q4 2026", "Corporate Raya/CNY gifting, onboarding kits, premium sets."],
        ["Licensing / White-label", "2028+", "Asset-light regional expansion into new SEA markets."],
      ]),
      blockHeading(2, "Exit Options"),
      blockTable(["Exit Type", "Timeline", "Target Acquirers", "Expected Multiple"], [
        ["Strategic Acquisition", "2031-2033", "PepsiCo, Keurig Dr Pepper, Suntory, Nestle Health Science, Grab Health", "12-15x revenue"],
        ["PE Buyout", "2029-2031", "Northstar, KKR Asia, Creador", "8-10x EBITDA"],
        ["IPO / Bursa Listing", "2032+", "Bursa Malaysia ACE to Main Market", "15-25x earnings"],
      ]),
      blockHeading(2, "Premium Exit Assets"),
      blockTable(["Asset", "Description", "Timeline"], [
        ["Brand Moat", "A community-first brand acquirers pay a premium for.", "Building now"],
        ["Subscription Revenue", "30%+ recurring revenue creates a higher multiple.", "Q4 2026"],
        ["First-Party Customer Data", "30K+ emails with behavioral data.", "Start now"],
        ["Regional Presence", "SG to TH to ID to PH. Multi-market SEA story.", "2027-2028"],
        ["Formulation IP", "Patent or trademark unique formulations where possible.", "2026"],
        ["Distribution Network", "200+ retail touchpoints + B2B recurring accounts.", "2027"],
      ]),
    ],
  });

  addPage({
    id: "xalt_checklist",
    parentId: null,
    title: "Pre-Launch Checklist",
    icon: "✅",
    blocks: [
      blockHeading(1, "Pre-Launch Checklist"),
      blockCallout("✅", "Use this as the working execution board. Add due dates to tasks so the Tasks by Due Date tab can group them properly."),
      blockHeading(2, "Week 1-2 — Foundation & Go Live"),
      blockChecklist([
        { cat:"Product", text:"Brief OEM: confirm start date, MOQ and delivery milestone for 30,000 sachet launch batch" },
        { cat:"Product", text:"Lock final formulation sign-off for Daily + Focus sachets" },
        { cat:"Design", text:"Brief freelance designer on packaging dieline and brand asset kit" },
        { cat:"Design", text:"Lock brand kit: logo, clean whites, soft teals, typography and mockup files" },
        { cat:"Content", text:"Film first 3 Reels: lifestyle ritual, BTS/founder, electrolytes education" },
        { cat:"Content", text:"Create and optimise Instagram, XHS and LinkedIn profiles" },
        { cat:"Marketing", text:"Build waitlist landing page with email opt-in and 15% early-bird offer" },
        { cat:"Marketing", text:"Set up Klaviyo or Mailchimp 5-email welcome sequence" },
        { cat:"Distribution", text:"Open Shopee seller account and complete KYC verification" },
        { cat:"Distribution", text:"Map fulfillment workflow from OEM to warehouse to courier to customer" },
      ]),
      blockHeading(2, "Week 3-4 — Momentum & Amplify"),
      blockChecklist([
        { cat:"Content", text:"Maintain 3 Reels + 1 carousel + 3-5 Stories/day with no missed days" },
        { cat:"Influencer", text:"Confirm first 5 nano-influencer partnerships on gifting-only terms" },
        { cat:"Influencer", text:"Ship influencer kits with product, handwritten card, brief and promo code" },
        { cat:"Marketing", text:"Activate first Meta paid ad test at RM 300-500" },
        { cat:"Distribution", text:"Build Shopee store banners, categories and product templates" },
        { cat:"B2B", text:"Draft 1-page corporate wellness pitch deck" },
        { cat:"B2B", text:"Identify 20 target companies: co-working spaces, law firms, banks and gyms" },
        { cat:"AI Systems", text:"Build AI content agent for Notion content brief automation" },
      ]),
      blockHeading(2, "Week 5-8 — Traction, Hype & Pre-Launch Lock"),
      blockChecklist([
        { cat:"Product", text:"Check OEM production progress and flag any delay immediately" },
        { cat:"Design", text:"Execute product photography shoot: flat lay, desk, gym bag and airport" },
        { cat:"Content", text:"Publish first UGC repost from influencer or early community member" },
        { cat:"E-Commerce", text:"Build DTC website with Daily + Focus product pages, about, FAQ and checkout" },
        { cat:"Launch Event", text:"Confirm launch event venue in KL" },
        { cat:"Launch Event", text:"Plan tasting station, photo moment and on-site sign-ups" },
        { cat:"Influencer", text:"Publish first influencer hero review or unboxing video" },
        { cat:"Distribution", text:"Test full DTC and Shopee order flows end-to-end" },
        { cat:"Marketing", text:"Scale Meta ads to RM 1,500-2,000/month" },
        { cat:"AI Systems", text:"Set up AI B2B outreach agent with Clay.com and LinkedIn sequence" },
      ]),
      blockHeading(2, "Week 9-11 & Launch Week"),
      blockChecklist([
        { cat:"Product", text:"Receive and QC all launch inventory: boxes, sachets and inserts" },
        { cat:"Launch Event", text:"Complete minute-by-minute run-of-show document" },
        { cat:"Distribution", text:"Pre-pack first 50 boxes for same-day launch dispatch" },
        { cat:"Marketing", text:"Send press outreach and queue launch day email blast" },
        { cat:"Influencer", text:"Make sure all 3 hero review videos are live before launch week" },
        { cat:"Content", text:"Schedule all launch week Reels, carousels and countdown Stories" },
        { cat:"Launch Event", text:"Execute launch event and capture at least 3 Reels worth of raw footage" },
        { cat:"Distribution", text:"DTC website and Shopee store go live with launch offer" },
        { cat:"Marketing", text:"Monitor paid ads, CPC and ROAS hourly on launch day" },
        { cat:"Product", text:"If 400+ boxes sell by evening, brief OEM for next production batch" },
      ]),
    ],
  });

  buildXaltWeek1ScriptPages().forEach(addPage);

  return { pages, rootOrder, childOrder, currentPageId: "xalt_home" };
}

const XALT_WORKSPACE_DEFAULT = buildXaltStrategyWorkspace();
const CHURNS_WORKSPACE_DEFAULT = buildChurnsWorkspace();
window.CHURNS_CONTENT_INTELLIGENCE_PAGE = buildChurnsContentIntelligencePage();
window.CHURNS_WEEK_1_FOUNDER_CONTENT_PAGES = buildChurnsWeek1FounderContentPages();
window.CHURNS_60_DAY_CONTENT_PAGES = buildChurns60DayContentPages();
window.XALT_WEEK_1_SCRIPT_PAGES = buildXaltWeek1ScriptPages();

// Empty workspace for new users / self-hosted downloads
const buildEmptyWorkspace = () => ({
  pages: {
    home: {
      id: "home",
      parentId: null,
      title: "Home",
      icon: "doc",
      blocks: [{ id: nid(), type: "text", text: "" }],
    }
  },
  rootOrder: ["home"],
  childOrder: {},
  currentPageId: "home",
});

const EMPTY_WORKSPACE_DEFAULT = buildEmptyWorkspace();

// Fresh installs / self-hosted downloads start with ONE empty workspace.
// XALT / Churns are no longer seeded — each user builds their own, stored in their Firebase.
// (The XALT/Churns builders above are kept dormant for reference but are not loaded.)
window.WORKSPACE_SEEDS = [
  { id: "local_default", seedKey: "default", name: "My Workspace", data: EMPTY_WORKSPACE_DEFAULT },
];
window.WORKSPACE_DEFAULT = EMPTY_WORKSPACE_DEFAULT;
