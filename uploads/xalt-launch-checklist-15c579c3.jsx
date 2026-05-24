import { useState, useEffect } from "react";

const C = {
  bg: "#f7f5f0",
  paper: "#ffffff",
  ink: "#1a1a1a",
  muted: "#888",
  faint: "#e8e4dc",
  border: "#ddd8ce",
  teal: "#00957a",
  tealLight: "#e6f5f1",
  orange: "#e8580c",
  gold: "#b88a00",
  goldLight: "#fdf8e6",
  purple: "#5b3fb5",
  purpleLight: "#f0ecfb",
  red: "#cc2200",
};

const CATEGORY_COLORS = {
  "Product":      { bg: "#e6f5f1", text: "#00957a", dot: "#00957a" },
  "Design":       { bg: "#f0ecfb", text: "#5b3fb5", dot: "#5b3fb5" },
  "Distribution": { bg: "#fdf8e6", text: "#b88a00", dot: "#b88a00" },
  "Content":      { bg: "#fdf0ea", text: "#e8580c", dot: "#e8580c" },
  "Marketing":    { bg: "#fff0f6", text: "#b52060", dot: "#b52060" },
  "Launch Event": { bg: "#fdf0ee", text: "#cc2200", dot: "#cc2200" },
  "E-Commerce":   { bg: "#f0fdf4", text: "#15803d", dot: "#15803d" },
  "AI Systems":   { bg: "#f5f0ff", text: "#6d28d9", dot: "#6d28d9" },
  "B2B":          { bg: "#fff7ed", text: "#c2410c", dot: "#c2410c" },
  "Community":    { bg: "#f0f9ff", text: "#0369a1", dot: "#0369a1" },
  "Influencer":   { bg: "#fdf4ff", text: "#9333ea", dot: "#9333ea" },
};

const WEEKS = [
  {
    id:"w1", week:"WEEK 1", dates:"May 13–17", title:"Ignition", color:"#e8580c",
    milestone:"Foundations locked — accounts live, OEM briefed, filming starts tomorrow.",
    targets:["OEM production confirmed","All social accounts created","First Reels filmed"],
    tasks:[
      {id:"1-1",cat:"Product",text:"Brief OEM — confirm production start date, MOQ & batch timeline for launch"},
      {id:"1-2",cat:"Product",text:"Lock final formulation sign-off on Daily & Focus SKUs"},
      {id:"1-3",cat:"Design",text:"Brief freelance designer: packaging dieline & brand assets"},
      {id:"1-4",cat:"Design",text:"Lock brand kit: logo, color palette, typography, sachet mockup files"},
      {id:"1-5",cat:"Design",text:"Create Canva / Figma templates for Reels, Stories & carousels"},
      {id:"1-6",cat:"Content",text:"Film first 3 Reels TODAY / TOMORROW — 1x lifestyle, 1x BTS, 1x education"},
      {id:"1-7",cat:"Content",text:"Write 4-week content calendar with daily posting slots"},
      {id:"1-8",cat:"Content",text:"Set up Instagram — full bio, link, story highlights, pinned post"},
      {id:"1-9",cat:"Content",text:"Set up Xiaohongshu (XHS) — full profile, first post drafted"},
      {id:"1-10",cat:"Content",text:"Set up LinkedIn — brand page + founder profile optimized"},
      {id:"1-11",cat:"Distribution",text:"Research Shopee & Lazada seller account requirements — begin registration"},
      {id:"1-12",cat:"Distribution",text:"List 10 target KL corporate offices / co-working spaces for B2B pipeline"},
    ],
  },
  {
    id:"w2", week:"WEEK 2", dates:"May 18–24", title:"Go Live", color:"#e8580c",
    milestone:"First post published. Waitlist page live. Email system active.",
    targets:["First Reel published this weekend","Waitlist landing page live","Email capture running"],
    tasks:[
      {id:"2-1",cat:"Content",text:"PUBLISH first Reel this Saturday — schedule in advance"},
      {id:"2-2",cat:"Content",text:"Begin 3–5 Stories/day from today — no missed days until launch"},
      {id:"2-3",cat:"Content",text:"Batch-film Week 2 Reels (3x) + shoot carousel assets"},
      {id:"2-4",cat:"Marketing",text:"Build waitlist landing page (Carrd / Webflow) with email opt-in CTA"},
      {id:"2-5",cat:"Marketing",text:"Set up Klaviyo / Mailchimp — create 5-email welcome nurture sequence"},
      {id:"2-6",cat:"Marketing",text:"Create lead magnet: '7-Day Hydration Guide' PDF for waitlist sign-ups"},
      {id:"2-7",cat:"Design",text:"Complete packaging dieline — send to OEM for print approval"},
      {id:"2-8",cat:"Design",text:"Design sachet box mockup for use in content shoots"},
      {id:"2-9",cat:"Distribution",text:"Open Shopee seller account + complete KYC verification"},
      {id:"2-10",cat:"Distribution",text:"Map fulfillment workflow: OEM → storage → courier → customer"},
      {id:"2-11",cat:"Community",text:"Manually engage 20 target accounts/day (run clubs, wellness pages, XHS)"},
      {id:"2-12",cat:"Influencer",text:"Send first 30 nano-influencer DMs — track all in Google Sheet"},
    ],
  },
  {
    id:"w3", week:"WEEK 3", dates:"May 25–31", title:"Build Momentum", color:"#b88a00",
    milestone:"200 followers. 500 waitlist signups. Content rhythm fully locked.",
    targets:["200 IG followers","500 waitlist emails","10 influencer conversations active"],
    tasks:[
      {id:"3-1",cat:"Content",text:"Maintain 3 Reels + 1 carousel + daily Stories — zero missed days"},
      {id:"3-2",cat:"Content",text:"Post first educational carousel: '6 Electrolytes Your Body Needs Daily'"},
      {id:"3-3",cat:"Content",text:"Film founder BTS content: OEM factory visit or formulation story"},
      {id:"3-4",cat:"Influencer",text:"Confirm first 5 nano-influencer partnerships (gifting-only, no fees)"},
      {id:"3-5",cat:"Influencer",text:"Prepare influencer gifting kits: product + handwritten card + content brief"},
      {id:"3-6",cat:"Marketing",text:"Activate first Meta paid ad: waitlist capture (RM 300–500 test budget)"},
      {id:"3-7",cat:"Marketing",text:"Install Meta Pixel on waitlist landing page for retargeting setup"},
      {id:"3-8",cat:"Distribution",text:"Begin building Shopee store: banners, categories, product listing templates"},
      {id:"3-9",cat:"Distribution",text:"Research 3PL options vs self-ship — decide and confirm model"},
      {id:"3-10",cat:"Design",text:"Packaging: incorporate OEM feedback, finalize print-ready files"},
      {id:"3-11",cat:"B2B",text:"Draft 1-page B2B corporate wellness pitch deck"},
      {id:"3-12",cat:"B2B",text:"Identify 20 target companies: co-working spaces, law firms, banks, gyms"},
    ],
  },
  {
    id:"w4", week:"WEEK 4", dates:"Jun 1–7", title:"Amplify", color:"#b88a00",
    milestone:"500 followers. 1.5K waitlist. Influencer samples dispatched.",
    targets:["500 combined IG + XHS followers","1,500 waitlist emails","Samples shipped to 10 influencers"],
    tasks:[
      {id:"4-1",cat:"Content",text:"Publish first 'Build in Public' post — founder story, why XALT exists"},
      {id:"4-2",cat:"Content",text:"Cross-post best-performing Reels to XHS with localized captions"},
      {id:"4-3",cat:"Content",text:"Begin LinkedIn founder posts: 2–3/week cadence (revenue updates, learnings)"},
      {id:"4-4",cat:"Influencer",text:"Ship product samples to all confirmed nano-influencer partners"},
      {id:"4-5",cat:"Influencer",text:"DM 10 micro-influencer (10K–100K) prospects in wellness/run niches"},
      {id:"4-6",cat:"Marketing",text:"Review Meta ad Week 1 results — scale winning creative, kill losers"},
      {id:"4-7",cat:"Marketing",text:"Boost top XHS lifestyle post with paid promotion"},
      {id:"4-8",cat:"Distribution",text:"Shopee store product listings drafted (not public yet — prepare only)"},
      {id:"4-9",cat:"Distribution",text:"Set up courier accounts: J&T / Ninja Van / Poslaju — compare rates"},
      {id:"4-10",cat:"Community",text:"Outreach to 5 KL run clubs for collab / co-content opportunity"},
      {id:"4-11",cat:"Community",text:"Outreach to 5 yoga / pilates studios for event partnership"},
      {id:"4-12",cat:"AI Systems",text:"Build AI content agent: Claude/GPT API → weekly content brief automation"},
    ],
  },
  {
    id:"w5", week:"WEEK 5", dates:"Jun 8–14", title:"Proof of Traction", color:"#00957a",
    milestone:"1K followers. 3K waitlist. First influencer review content live.",
    targets:["1K IG followers","3K waitlist","1 influencer review post live"],
    tasks:[
      {id:"5-1",cat:"Product",text:"Check in with OEM — confirm production is on track vs timeline"},
      {id:"5-2",cat:"Product",text:"Draft QC checklist for when production batch arrives"},
      {id:"5-3",cat:"Design",text:"Product photography shoot: flat lay, lifestyle, desk setup, gym bag"},
      {id:"5-4",cat:"Design",text:"Design launch week countdown graphics & visual templates"},
      {id:"5-5",cat:"Content",text:"Publish first UGC repost from influencer or early community member"},
      {id:"5-6",cat:"Content",text:"Film ingredient deep-dive Reel series: Vitamin B6, Magnesium, Electrolytes"},
      {id:"5-7",cat:"E-Commerce",text:"Build DTC website skeleton: product page, about, FAQ, contact"},
      {id:"5-8",cat:"E-Commerce",text:"Set up Shopify / WooCommerce with checkout + Klaviyo integration"},
      {id:"5-9",cat:"B2B",text:"Send first 10 B2B cold outreach emails to corporate wellness targets"},
      {id:"5-10",cat:"B2B",text:"Set up HubSpot (free) CRM for B2B pipeline tracking"},
      {id:"5-11",cat:"Distribution",text:"Confirm delivery packaging: outer box, tape, inserts, unboxing experience"},
      {id:"5-12",cat:"Distribution",text:"Map pre-order fulfillment flow for launch day surge orders"},
    ],
  },
  {
    id:"w6", week:"WEEK 6", dates:"Jun 15–21", title:"Mid-Point Check", color:"#00957a",
    milestone:"2K followers. 4K waitlist. Launch event venue confirmed.",
    targets:["2K IG followers","4K waitlist","Launch event venue locked"],
    tasks:[
      {id:"6-1",cat:"Launch Event",text:"Confirm launch event venue (gym, studio, co-working space, F&B spot)"},
      {id:"6-2",cat:"Launch Event",text:"Plan launch day activations: tasting station, photo moment, on-spot sign-ups"},
      {id:"6-3",cat:"Launch Event",text:"Identify 3–5 community partners to co-host or co-promote the event"},
      {id:"6-4",cat:"Design",text:"Design event collaterals: banner, backdrop, table cards, tote bags"},
      {id:"6-5",cat:"Design",text:"Finalize launch week social ad creatives and scheduled grid reveal plan"},
      {id:"6-6",cat:"Content",text:"Begin launch countdown Stories series: '8 weeks to XALT'"},
      {id:"6-7",cat:"Content",text:"Create cornerstone 'What is XALT?' brand explainer Reel"},
      {id:"6-8",cat:"E-Commerce",text:"DTC website first draft complete — product copy, images, brand story"},
      {id:"6-9",cat:"E-Commerce",text:"Shopee store fully optimized: keywords, pricing, bundle offers, vouchers"},
      {id:"6-10",cat:"Marketing",text:"Email list review: target 2K+ — optimize open rates and subject lines"},
      {id:"6-11",cat:"Marketing",text:"Plan full launch week email sequence: teaser → day-before → D-day → D+3"},
      {id:"6-12",cat:"Influencer",text:"Follow up with influencers who received samples — confirm post publish dates"},
    ],
  },
  {
    id:"w7", week:"WEEK 7", dates:"Jun 22–28", title:"Hype Engine ON", color:"#5b3fb5",
    milestone:"3K followers. 5K waitlist. First hero review video live.",
    targets:["3K followers","5K waitlist","1 hero review video live on IG/XHS"],
    tasks:[
      {id:"7-1",cat:"Influencer",text:"First influencer hero review / unboxing video MUST be live this week"},
      {id:"7-2",cat:"Content",text:"Launch 'XALT Ritual' content series: morning, gym, desk, travel"},
      {id:"7-3",cat:"Content",text:"Begin weekly Instagram Lives: Q&A or BTS (even if 50 viewers — just start)"},
      {id:"7-4",cat:"Product",text:"First production batch QC — confirm quality, count, sachets integrity"},
      {id:"7-5",cat:"Product",text:"Verify inventory count vs launch target (need 900+ boxes minimum)"},
      {id:"7-6",cat:"Distribution",text:"Test full DTC order flow: checkout → payment → confirmation → fulfilment"},
      {id:"7-7",cat:"Distribution",text:"Test Shopee order flow end-to-end — place test order, check courier pickup"},
      {id:"7-8",cat:"Launch Event",text:"Event invitations sent to community partners, influencers, press contacts"},
      {id:"7-9",cat:"Launch Event",text:"Early-bird offer confirmed: 15% off for waitlist members at launch event"},
      {id:"7-10",cat:"Marketing",text:"Scale Meta ads to RM 1,500–2,000/month — focus on waitlist & lookalikes"},
      {id:"7-11",cat:"AI Systems",text:"Set up AI B2B outreach agent via Clay.com + LinkedIn Sales Navigator"},
      {id:"7-12",cat:"B2B",text:"Follow up all 10 B2B leads — aim for 3 confirmed interest calls booked"},
    ],
  },
  {
    id:"w8", week:"WEEK 8", dates:"Jun 29 – Jul 5", title:"Pre-Launch Locked", color:"#5b3fb5",
    milestone:"4K followers. 7K waitlist. DTC website fully live and tested.",
    targets:["4K followers","7K waitlist","Website live & tested","Subscription option live"],
    tasks:[
      {id:"8-1",cat:"E-Commerce",text:"DTC website 100% complete — all pages live, checkout tested with real card"},
      {id:"8-2",cat:"E-Commerce",text:"Subscription option live on DTC site (10–15% recurring discount)"},
      {id:"8-3",cat:"E-Commerce",text:"Google Analytics 4 + Meta Pixel installed and verified on website"},
      {id:"8-4",cat:"Design",text:"Launch day visual assets finalized — IG grid reveal sequence locked"},
      {id:"8-5",cat:"Design",text:"Product insert cards designed and sent to printer (thank you card + guide)"},
      {id:"8-6",cat:"Content",text:"Film launch teaser content — mysterious, hype-building, no product shown yet"},
      {id:"8-7",cat:"Content",text:"Batch-create 2 weeks of Stories for launch period — schedule in advance"},
      {id:"8-8",cat:"Distribution",text:"Confirm courier / 3PL readiness for launch week volume — get written confirmation"},
      {id:"8-9",cat:"Distribution",text:"Plan 10% stock buffer above launch forecast to handle order surge"},
      {id:"8-10",cat:"Marketing",text:"Draft all 5 launch week emails — send to founder for final approval"},
      {id:"8-11",cat:"Community",text:"Run club + yoga studio partnerships confirmed — co-promo content planned"},
      {id:"8-12",cat:"AI Systems",text:"Deploy AI customer support chatbot (Tidio / Intercom) on website + Shopee"},
    ],
  },
  {
    id:"w9", week:"WEEK 9", dates:"Jul 6–12", title:"Final Assembly", color:"#cc2200",
    milestone:"5K followers. 8.5K waitlist. Inventory received. All systems tested.",
    targets:["5K followers","8.5K waitlist","Full inventory received & QC'd","Order flow fully tested"],
    tasks:[
      {id:"9-1",cat:"Product",text:"Launch inventory physically received and counted at warehouse or home"},
      {id:"9-2",cat:"Product",text:"Full packaging QC complete — boxes, inserts, sachets all verified"},
      {id:"9-3",cat:"Design",text:"All launch day creative assets exported, organized in shared folder"},
      {id:"9-4",cat:"Design",text:"Merchandise received and checked: bottles, totes, branded items"},
      {id:"9-5",cat:"Launch Event",text:"Complete run-of-show document for launch event (minute-by-minute)"},
      {id:"9-6",cat:"Launch Event",text:"On-ground team briefed: roles, stations, setup timeline, contingency plan"},
      {id:"9-7",cat:"Launch Event",text:"Tasting setup confirmed: mixing station, cups, display, flavor signage"},
      {id:"9-8",cat:"Distribution",text:"Pre-pack first 50 boxes for launch day same-day dispatch"},
      {id:"9-9",cat:"Distribution",text:"All courier accounts active — run test dispatch and confirm tracking works"},
      {id:"9-10",cat:"Content",text:"'7 days to XALT' countdown Stories series begins"},
      {id:"9-11",cat:"Content",text:"All launch week Reels + carousels pre-edited and scheduled in Later/Buffer"},
      {id:"9-12",cat:"Marketing",text:"Teaser email sent to waitlist: 'Something big is coming this week…'"},
    ],
  },
  {
    id:"w10", week:"WEEK 10–11", dates:"Jul 13–26", title:"Countdown", color:"#cc2200",
    milestone:"5K followers. 10K waitlist HIT. All paid ads at full budget. Press outreach sent.",
    targets:["✅ 5K+ followers","✅ 10K waitlist ACHIEVED","Full paid ads live","PR outreach sent"],
    tasks:[
      {id:"10-1",cat:"Marketing",text:"Full Meta + XHS paid ad campaign at launch budget — monitor daily"},
      {id:"10-2",cat:"Marketing",text:"KL wellness media PR outreach: press release + product sample packages sent"},
      {id:"10-3",cat:"Marketing",text:"Launch day email fully proofed and queued — ready for one-click send"},
      {id:"10-4",cat:"Influencer",text:"All 3 hero review videos LIVE before launch week — no exceptions"},
      {id:"10-5",cat:"Content",text:"Daily countdown Stories from Jul 20: '10 days', '9 days', '8 days'…"},
      {id:"10-6",cat:"Content",text:"All launch week content scheduled in Later/Buffer — no manual posting"},
      {id:"10-7",cat:"Launch Event",text:"Final event headcount confirmed with venue"},
      {id:"10-8",cat:"Launch Event",text:"All event signage, backdrop, branded materials at venue or en route"},
      {id:"10-9",cat:"Distribution",text:"Emergency restock plan ready: define reorder trigger point with OEM"},
      {id:"10-10",cat:"Distribution",text:"3+ confirmed B2B corporate accounts ready for post-launch supply"},
      {id:"10-11",cat:"E-Commerce",text:"Shopee launch day flash sale fully configured and tested"},
      {id:"10-12",cat:"E-Commerce",text:"DTC early-bird discount code created, tested, ready for waitlist blast"},
    ],
  },
  {
    id:"w12", week:"LAUNCH WEEK", dates:"Aug Week 2", title:"🚀 LAUNCH DAY", color:"#00957a",
    milestone:"100K views. 10K waitlist live. 900 boxes sold. XALT is in the world.",
    targets:["100K views across all platforms","900 boxes sold","Launch event executed","DTC + Shopee live"],
    tasks:[
      {id:"11-1",cat:"Launch Event",text:"Execute launch event — tasting stations, sign-ups, photo moments, energy"},
      {id:"11-2",cat:"Launch Event",text:"Film entire launch event — capture 3+ Reels worth of raw footage"},
      {id:"11-3",cat:"Launch Event",text:"Convert 50+ on-site attendees from waitlist to Day 1 purchase"},
      {id:"11-4",cat:"Distribution",text:"DTC website GOES LIVE — blast email to full waitlist simultaneously"},
      {id:"11-5",cat:"Distribution",text:"Shopee store GOES LIVE — launch day flash sale activated"},
      {id:"11-6",cat:"Distribution",text:"All launch day orders dispatched within 24 hours — no delays"},
      {id:"11-7",cat:"Marketing",text:"Launch day email blast to full waitlist with early-bird offer"},
      {id:"11-8",cat:"Marketing",text:"Paid ads at maximum daily budget — monitor CPC + ROAS every hour"},
      {id:"11-9",cat:"Content",text:"Go LIVE on Instagram during launch event — even 30 minutes"},
      {id:"11-10",cat:"Content",text:"Post launch day Reel same day — raw, real, emotional founder moment"},
      {id:"11-11",cat:"Content",text:"Stories throughout the day: behind-scenes, reactions, boxes going out"},
      {id:"11-12",cat:"Product",text:"If 400+ boxes sold by evening — immediately brief OEM for next production batch"},
    ],
  },
];

const STORAGE_KEY = "xalt_todo_v2";

export default function XALTChecklist() {
  const [checked, setChecked] = useState({});
  const [activeWeek, setActiveWeek] = useState("w1");
  const [filter, setFilter] = useState("All");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setChecked(JSON.parse(s));
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checked)); } catch {}
  }, [checked, loaded]);

  const toggle = (id) => setChecked(p => ({ ...p, [id]: !p[id] }));

  const cur = WEEKS.find(w => w.id === activeWeek);
  const cats = ["All", ...Array.from(new Set(cur.tasks.map(t => t.cat)))];
  const visible = filter === "All" ? cur.tasks : cur.tasks.filter(t => t.cat === filter);
  const weekDone = cur.tasks.filter(t => checked[t.id]).length;
  const weekTotal = cur.tasks.length;
  const weekPct = Math.round((weekDone / weekTotal) * 100);
  const allTasks = WEEKS.flatMap(w => w.tasks);
  const totalDone = allTasks.filter(t => checked[t.id]).length;
  const totalAll = allTasks.length;
  const totalPct = Math.round((totalDone / totalAll) * 100);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Instrument Sans', 'DM Sans', sans-serif", paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: C.ink, padding: "26px 20px 22px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ background: C.teal, color: "#000", fontWeight: 800, fontSize: 13, letterSpacing: 3, padding: "3px 10px", borderRadius: 5 }}>XALT</span>
                <span style={{ color: "#666", fontSize: 12 }}>Pre-Launch Master Checklist</span>
              </div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: "#fff", lineHeight: 1.2 }}>
                Launch Day: <em style={{ color: C.teal }}>August, Week 2</em>
              </div>
              <div style={{ color: "#666", fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
                🎯 100K views/video &nbsp;·&nbsp; 5–10K followers/platform &nbsp;·&nbsp; 10K waitlist &nbsp;·&nbsp; 900 boxes sold
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.teal, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{totalPct}%</div>
              <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{totalDone} / {totalAll} tasks</div>
            </div>
          </div>
          <div style={{ marginTop: 14, background: "#2a2a2a", borderRadius: 4, height: 5 }}>
            <div style={{ width: `${totalPct}%`, height: "100%", background: `linear-gradient(90deg, ${C.teal}, #00c49a)`, borderRadius: 4, transition: "width .4s ease" }} />
          </div>
        </div>
      </div>

      {/* Week tabs */}
      <div style={{ background: C.paper, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        <div style={{ display: "flex", maxWidth: 700, margin: "0 auto", padding: "0 12px" }}>
          {WEEKS.map(w => {
            const d = w.tasks.filter(t => checked[t.id]).length;
            const isActive = w.id === activeWeek;
            const allDone = d === w.tasks.length;
            return (
              <button key={w.id} onClick={() => { setActiveWeek(w.id); setFilter("All"); }} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "12px 10px",
                borderBottom: `3px solid ${isActive ? w.color : "transparent"}`,
                marginBottom: -1, flexShrink: 0, minWidth: 64,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? w.color : "#bbb", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                  {allDone ? "✓ " : ""}{w.week}
                </div>
                <div style={{ fontSize: 10, color: "#ccc", marginTop: 1 }}>{d}/{w.tasks.length}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "18px 16px" }}>

        {/* Week card */}
        <div style={{
          background: C.paper, border: `1px solid ${C.border}`,
          borderLeft: `5px solid ${cur.color}`,
          borderRadius: 12, padding: "18px 20px", marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                <span style={{ color: cur.color, fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>{cur.week} — {cur.dates}</span>
                <span style={{ background: `${cur.color}18`, color: cur.color, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20 }}>{cur.title}</span>
              </div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 16, color: C.ink, fontStyle: "italic", lineHeight: 1.5 }}>
                {cur.milestone}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: cur.color }}>{weekPct}%</div>
              <div style={{ fontSize: 10, color: C.muted }}>{weekDone}/{weekTotal}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {cur.targets.map((t, i) => (
              <span key={i} style={{
                background: `${cur.color}12`, color: cur.color,
                border: `1px solid ${cur.color}28`,
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
              }}>🎯 {t}</span>
            ))}
          </div>

          <div style={{ marginTop: 14, background: C.faint, borderRadius: 4, height: 4 }}>
            <div style={{ width: `${weekPct}%`, height: "100%", background: cur.color, borderRadius: 4, transition: "width .3s ease" }} />
          </div>
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {cats.map(cat => {
            const s = CATEGORY_COLORS[cat] || { dot: C.ink, text: C.ink };
            const isActive = filter === cat;
            return (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                background: isActive ? s.dot : C.paper,
                color: isActive ? "#fff" : (s.text || C.muted),
                border: `1px solid ${isActive ? s.dot : C.border}`,
                borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 600,
                cursor: "pointer",
              }}>{cat === "All" ? "All" : cat}</button>
            );
          })}
        </div>

        {/* Task list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {visible.map(task => {
            const done = !!checked[task.id];
            const s = CATEGORY_COLORS[task.cat] || { bg: "#f5f5f5", text: "#555", dot: "#aaa" };
            return (
              <div key={task.id} onClick={() => toggle(task.id)} style={{
                background: done ? "#fafaf8" : C.paper,
                border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "12px 14px",
                display: "flex", alignItems: "flex-start", gap: 11,
                cursor: "pointer", opacity: done ? 0.58 : 1,
                transition: "opacity .2s",
              }}>
                <div style={{
                  width: 19, height: 19, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  background: done ? C.teal : "transparent",
                  border: `2px solid ${done ? C.teal : "#ccc"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s",
                }}>
                  {done && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                </div>
                <span style={{
                  fontSize: 13, color: done ? C.muted : C.ink,
                  textDecoration: done ? "line-through" : "none",
                  lineHeight: 1.55, flex: 1,
                }}>{task.text}</span>
                <span style={{
                  background: s.bg, color: s.text,
                  fontSize: 10, fontWeight: 700, padding: "2px 8px",
                  borderRadius: 20, flexShrink: 0, letterSpacing: 0.3,
                }}>{task.cat}</span>
              </div>
            );
          })}
        </div>

        {weekDone === weekTotal && (
          <div style={{
            marginTop: 18, background: C.tealLight,
            border: `1px solid ${C.teal}40`,
            borderRadius: 12, padding: "18px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🎉</div>
            <div style={{ color: C.teal, fontWeight: 700, fontSize: 14 }}>Week complete — move to the next one.</div>
          </div>
        )}
      </div>
    </div>
  );
}
