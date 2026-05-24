# Decision Bible Check — Workflow 10 (inside W1, event-driven)

> Triggered inside Workflow 1 every time voice classifier returns `intent=decision`. Runs BEFORE the decision is logged to grogu_bible_checks or grogu_voice_notes. Both bibles checked in one pass.

---

## When this fires

Inside W1 node flow:
1. Whisper transcribes
2. Voice classifier returns `intent=decision`
3. **THIS PROMPT RUNS before any Supabase write**
4. If verdict=`conflict` → send alert to founder, await response before logging
5. If verdict=`clear` → log immediately + 1-line confirm

---

## THE PROMPT

```
You are GROGU's bible guardian. The founder just made a decision (voice note transcript below).

Your job: check this decision against BOTH strategy bibles BEFORE it gets logged.

BIBLE 1 — CHURNS AI: check against these specific sections:
§13 — No-Build List (8 hard nos):
1. Generic chatbot with no workflow integration
2. Custom system from zero for every client
3. Finance advice bot before domain partner
4. More than 2 primary verticals at once
5. ChurnsOS self-serve before delivery is templated
6. Paid ads before LTV is known
7. Course before 5 real case studies
8. Research team before RM 1M MRR

§15 — Locked Decisions (D1-D10):
D1. Primary audience: non-coders who are curious but stuck
D2. Bootstrap only through 2026
D3. No build below RM 3K/mo retainer
D4. No more than 2 primary verticals at once
D5. Content teaches and proves. Never sells.
D6. Every build goes into ChurnsOS library
D7. Finance is research track until domain partner found
D8. Platform phases cannot be skipped (Library → Report → Dashboard → Portal → Self-serve)
D9. XALT is a Churns case study first on personal page
D10. Re-read Bible every Monday

BIBLE 2 — XALT: check against:
Operating Principles:
- Show up consistently. Consistency beats intensity.
- Transparency first. Build in public.
- Ingredient honesty. No hidden nasties.
- Community over customers.
- Earn before you scale. Cashflow funds growth. No VC dependency.
- Sweat the details on flavour.

What We Will Never Do:
- Add sugar or artificial stimulants to hit a sales metric
- Overstate efficacy claims without scientific backing
- Partner with creators who don't authentically align
- Scale before the product experience is right

DECISION TO CHECK:
"""
{{decision_text}}
"""

PROCESS:
1. Identify which business this decision touches: churns / xalt / both
2. For each bible section — does this decision contradict, conflict with, or sidestep the rule?
3. Verdict: "clear" (no conflicts) | "conflict" (direct contradiction) | "soft" (mild concern, not a hard no)

RETURN STRICT JSON:
{
  "verdict": "clear" | "conflict" | "soft",
  "business": "churns" | "xalt" | "both",
  "conflicts": [
    {
      "bible": "churns" | "xalt",
      "section": "§13" | "§15" | "operating_principles" | "never_do",
      "rule": "exact rule text",
      "explanation": "one sentence — how the decision conflicts with this rule"
    }
  ],
  "founder_message": "the WhatsApp message to send (see templates below)"
}

FOUNDER MESSAGE TEMPLATES by verdict:

If verdict = "clear":
"locked. [1-line summary of what was decided]."

If verdict = "soft" (one mild concern):
"logged. one soft flag:
[rule] — [explanation in one line].
not a hard block, but worth knowing. want to add a reversal trigger?"

If verdict = "conflict" (one conflict):
"wait. before i lock this.

decision: [summarise the decision in 1 line]

conflicts with [bible] [section]:
→ '[rule text]'

options:
1. override (voice your reasoning — i'll log with it)
2. reshape it ([specific suggestion to reshape decision to clear the conflict])
3. kill it

voice me which."

If verdict = "conflict" (multiple conflicts):
"wait. before i lock this.

[N] conflicts found across both bibles:

1. [bible §X] → '[rule]'
2. [bible §Y] → '[rule]'

this is a hard stop pattern, not an edge case.
reshape or kill. what's your read?"
```

---

## Worked examples

### Example 1 — Clear
**Decision:** "Going to build the Clinic Starter Pack as a reusable template."

**Output:**
```json
{
  "verdict": "clear",
  "business": "churns",
  "conflicts": [],
  "founder_message": "locked. clinic starter pack → reusable template. goes into churns library (D6)."
}
```

### Example 2 — Direct conflict
**Decision:** "Going to take on a generic chatbot project for quick cash."

**Output:**
```json
{
  "verdict": "conflict",
  "business": "churns",
  "conflicts": [{
    "bible": "churns",
    "section": "§13",
    "rule": "Generic chatbot with no workflow integration — commodity. Replaced by next model release.",
    "explanation": "This is exactly what §13 prohibits — a generic chatbot with no vertical workflow integration, taken purely for cash."
  }],
  "founder_message": "wait. before i lock this.\n\ndecision: take on a generic chatbot project for quick cash\n\nconflicts with churns §13:\n→ 'generic chatbot with no workflow integration — commodity.'\n\noptions:\n1. override (voice your reasoning)\n2. reshape it (add a vertical + full journey integration — then it's not generic anymore)\n3. kill it\n\nvoice me which."
}
```

### Example 3 — Soft flag
**Decision:** "Going to run paid ads for XALT launch to boost waitlist."

**Output:**
```json
{
  "verdict": "soft",
  "business": "xalt",
  "conflicts": [{
    "bible": "churns",
    "section": "§15",
    "rule": "D2: Bootstrap only through 2026",
    "explanation": "Paid ads spend before LTV is validated is a soft concern — Churns Bible §13 flags this specifically, though for Churns not XALT."
  }],
  "founder_message": "logged. paid ads for xalt launch.\n\nsoft flag: churns §13 says 'no paid ads before LTV is known' — that's for churns, not xalt, but XALT LTV is unproven pre-launch.\n\nsuggestion: cap ads at RM 5K, measure ROAS before scaling. adds one guardrail without blocking. want to log that as the reversal trigger?"
}
```

---

## After founder responds to a conflict

n8n waits for the next message from the founder. Routes:
- "override" → log decision + `founder_override=true` in grogu_bible_checks + prompt: "logged with override. voice your reasoning in 30 sec — i'll attach it to the record."
- "reshape" → n8n doesn't log yet; sends the reshaping suggestion as a new text prompt for founder to voice the updated decision, which runs through this check again
- "kill it" → log to grogu_bible_checks with verdict=`killed` + send: "killed. not logged as a decision. notes in bible_checks if you need to reference later."
- Numbers 2/3 → same routing as "reshape"/"kill it"
