# GROGU — Monthly Maintenance

30-minute ritual, last Sunday of every month. Keeps GROGU sharp.

---

## Checklist

### 1. Tone audit (10 min)
- Open `07_OPERATIONS/tone_examples.md`
- Scroll back through last month's GROGU messages in WhatsApp
- Score 20 random messages: pass (in voice) / fail (drifted to chatbot)
- If <80% pass → update `01_SYSTEM_PROMPTS/grogu_master.md` with specific reinforcement
- Log version bump in Notion `01_Identity_Tone` changelog

### 2. Cost check (5 min)
- Anthropic console → usage this month
- OpenAI console → Whisper usage
- Hetzner → confirm €5 charge
- If over USD $80 this month: which workflow is bloating? Trim or downgrade Sonnet → Haiku.

### 3. Data hygiene (5 min)
- Supabase: query `SELECT intent, COUNT(*) FROM voice_notes WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY 1;`
- Healthy mix: ~30% idea, 20% kpi+milestone, 20% log, 15% problem, 10% todo, 5% decision
- If one category is 80%+ → you're using GROGU narrowly. Voice more variety. Or update the classifier examples.
- Notion: check Voice_Vault → confirm all entries from this month are tagged + linked

### 4. Sheet discipline (5 min)
- Open finance Sheet
- Last update date on Cash tab — should be today or yesterday
- Capex_XALT — does Spent column reflect actual bank transactions?
- Forecast_12wk — confirm next 4 weeks are accurate
- If sheet is >7 days stale: Friday cashflow reviews are running on lies. Fix.

### 5. Kill list pass (5 min)
- Open `07_OPERATIONS/kill_criteria.md`
- Run through per-workflow criteria
- Anything in amber/red zone? Decide: tune or kill.

---

## Quarterly (last Sunday of Mar / Jun / Sep / Dec): bigger pass

Add to monthly:

### A. Prompt versioning audit
- Diff every system prompt vs 3 months ago
- Drift is fine if intentional; document why
- Roll back any that drifted into chatbot-speak

### B. Workflow performance
- Which workflow do you act on most?
- Which gets ignored?
- Add/remove based on actual use, not what feels good

### C. KPI threshold tuning
- Churns Bible §11 thresholds may need updating as you grow
- E.g., "DMs/week green ≥10" was right at M1, may be wrong at M3
- Update both the bible AND the morning brief context block

### D. $100M ladder check
- Are you still on the ladder?
- If actual pace says different milestone progression: update Supabase `milestones` table
- GROGU is only as good as the ladder she tracks against

---

## Annually (December)

### Strategic reset
- Re-read both bibles cover to cover (it's the founder's job, not GROGU's)
- Update bibles in Notion + source files
- Decide: what does GROGU need to do next year that she doesn't do now?
- Plan the v2 — new workflows, new integrations, new memory shape

### Case study write-up
- Year-in-review: what voice note triggered the most valuable action? What did GROGU catch you'd have missed?
- 3,000-word LinkedIn long-form: "I ran my $X-revenue business with an AI Chief of Staff for 12 months. Here's everything I learned."
- This is Churns AI's most powerful content asset of the year.

---

## Maintenance log

| Month | Done by | Tone pass rate | Cost USD | Killed | Tuned |
|---|---|---|---|---|---|
| | | | | | |

(Fill monthly.)
