# GROGU — Kill Criteria

Modeled on Churns Bible's milestone kill criteria. The principle: if GROGU isn't generating value, kill the workflow or kill the whole system. Don't sunk-cost.

---

## Per-workflow kill criteria

| Workflow | If after… | …this is true | Action |
|---|---|---|---|
| Voice ingestion | 2 weeks | Reply takes >15 sec OR classification accuracy <70% | Switch Whisper to Groq + simplify classifier to 4 intents (idea/kpi/todo/log) |
| Text chat | 2 weeks | You stop using it (asking questions directly) | Workflow is fine; you're not using the channel. Keep running, no change. |
| Morning brief | 4 weeks | You're ignoring or muting it | Tone is wrong. Rewrite master prompt. If still ignored at week 6: kill the workflow. The day starts how you want it to start. |
| EOD check-in | 3 weeks | You skip 70%+ days | Either time wrong (move to 21:30?) or format wrong (move from message to voice-prompt only). If skipped at week 5: kill. |
| Friday cashflow | 6 weeks | Numbers are consistently wrong | Sheet maintenance is broken — not GROGU's fault. Fix the sheet discipline. |
| Monday Bible review | 8 weeks | You never act on it | Workflow is too long / too theoretical. Compress to 8-line max. |
| Content generator | 4 weeks | <2 drafts shipped to live posts | Drafts aren't matching your voice. Add 5 more voice samples to the reference. |
| Milestone tracker | runs auto | Triggers on every minor delta and is noisy | Raise threshold — only alert at 80%/100% of target, not every increment. |

---

## Full-system kill criteria

| Week | If… | Then |
|---|---|---|
| 2 | Round-trip doesn't work | Get builder fixed or refund and rebuild with Make.com |
| 4 | You haven't sent 10+ voice notes total | You're not using it. Either start using it for real OR shut it down. |
| 6 | Cost > USD $100/mo | Audit Claude usage. Probably Sonnet calls too aggressive. Drop Monday review or Friday review to Haiku. |
| 8 | You can't recall the last useful thing GROGU surfaced | Tone or value isn't landing. Pause. Do a 1-hour reflection on what to keep. |
| 12 | Less than 3 actual decisions changed because of GROGU | Kill it. Save the prompts as IP for ChurnsOS library. Move on. |

---

## The honesty rule

The single most important kill criterion: **am I lying to myself about whether GROGU is helping?**

You'll know. GROGU either:
- Catches things you'd have missed (voice notes turned into posts that ship; cashflow alerts that saved an overdraft; recurring problem flagged before it derailed launch)
- OR it's a slightly annoying smarter Siri

If it's the second one at week 12, shut it down. Don't keep paying RM 200/mo to feel productive.

---

## What "kill" actually looks like

Killing a workflow ≠ deleting it. Means:
1. Deactivate in n8n (don't delete)
2. Export the JSON to `04_N8N_WORKFLOWS/archive/`
3. Log the kill date + reason in this file (below)
4. Update master cost expectation downward

You can resurrect any workflow later from the archive.

Killing the whole system means:
1. Deactivate all workflows
2. Cancel Hetzner subscription
3. Keep Supabase + Notion (free tiers — data is yours forever)
4. Export the prompts + schemas → put into ChurnsOS Phase 0 library (per Churns Bible D6 — every build becomes IP)
5. Post the case study: "I built my own AI Chief of Staff. Here's what worked, what didn't, and why I shut it down." → that post alone is high-value Churns content.

Even a failed GROGU is a working Churns deliverable.

---

## Kill log

| Date | What killed | Reason | Replacement (if any) |
|---|---|---|---|
| — | — | — | — |

(Append as needed. Don't delete entries — the history is the lesson.)

---

## Anti-kill bias check

Before killing anything, ask:
1. Did I actually use it correctly for the full window?
2. Is the issue tone, format, or value?
3. If I lost it tomorrow, would I rebuild it next month?

If answer to #3 is yes → don't kill. Tune.
If answer to #3 is no → kill clean. No guilt.

---

> "Strategy without repetition is wishful thinking." — Churns Bible Locked Decision D10  
> Same applies to tools. If GROGU isn't earning its keep, it's a distraction from $100M.
