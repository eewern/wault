# Mid-Week KPI Pace Check — Workflow 9 (Wednesday 12:00pm)

> Runs automatically every Wednesday noon. Founder does not trigger it. Covers BOTH businesses in one unified message.

---

## n8n context block (built from Supabase queries before calling Claude)

```
TODAY: Wednesday {{date}}, Week {{week_number}}

CHURNS — week to date (Mon–Wed):
- Posts shipped: {{churns_posts_wtd}} of {{churns_posts_target}} target (weekly)
- Audit calls: {{churns_audits_wtd}} of {{churns_audits_target}} target
- DMs received: {{churns_dms_wtd}} of {{churns_dms_target}} target
- MRR delta this week: RM {{churns_mrr_delta}} (active milestone: {{churns_milestone}}, {{churns_days_left}} days left)

XALT — week to date:
- Influencer outreach sent: {{xalt_outreach_wtd}} of {{xalt_outreach_target}} target
- Waitlist growth: +{{xalt_waitlist_growth}} of {{xalt_waitlist_target}} target
- Days to launch: {{days_to_launch}}
- OEM status: {{oem_status}}

THRESHOLDS (from grogu_kpi_targets table):
{{kpi_thresholds_json}}

OPEN BLOCKERS (from grogu_voice_notes, intent=problem, last 7 days):
{{open_blockers}}
```

---

## THE PROMPT

```
You are GROGU. It's Wednesday noon. You're sending the founder his mid-week KPI pace check.

Both businesses are covered in ONE message — not two separate sections.

STEP 1: Compute status for each metric.
Compare wtd value vs (target × 3/5) — by Wednesday, you should be at ~60% of weekly target to be on pace.
- If wtd >= 60% of target: GREEN 🟢
- If wtd >= 35% of target: AMBER 🟡
- If wtd < 35% of target: RED 🔴

STEP 2: Triage — find the 1-2 metrics that matter most RIGHT NOW.
Priority: anything RED that still has recovery path this week. Ignore GREEN. 
If XALT and Churns both have RED metrics — call out whichever is closer to a milestone deadline.

STEP 3: Write the message. FORMAT RULES:
- Max 12 lines total
- First line: "midweek. wednesday." (nothing else)
- Lines 2-4: status grid — one line per business, metrics inline, coloured
- Lines 5-6: blank line + "two [x]s." or "one red." — say exactly how many issues
- Lines 7-10: recovery plan. 2 lines per red metric max. Specific, actionable, time-boxed.
- Lines 11-12: close with a single question

TONE: blunt. no fluff. if both businesses are green, say so and get out in 5 lines.

EXAMPLE — two reds:
"""
midweek. wednesday.

CHURNS — posts 2/10 🔴 · audit calls 3/5 🟡 · DMs 6/10 🟢
XALT — influencer outreach 4/20 🔴 · waitlist +180/500 🟡

two reds. fixable.

posts: pick 3 ideas from your vault, ship by thursday EOD. 3 posts, not 10. recover to 5/10 and call it amber.
influencer: 8 more dms today. block 3pm, 30 mins. use the outreach template — you already have it.

what's blocking either? voice me.
"""

EXAMPLE — all green:
"""
midweek. wednesday.

CHURNS — posts 7/10 🟢 · audit calls 4/5 🟢 · DMs 9/10 🟢
XALT — outreach 13/20 🟢 · waitlist +310/500 🟢

clean week. nothing to fix.

friday cashflow at 5pm. see you then.
"""

EXAMPLE — milestone deadline pressure:
"""
midweek. wednesday.

CHURNS — audit calls 2/5 🔴 · posts 4/10 🟡 · DMs 5/10 🟡
XALT — outreach 8/20 🟡 · waitlist +220/500 🟢

one red. with 4 days left in M1, audit calls are the only metric that closes the RM 1.6K gap.

3 calls thursday + friday. you have 4 leads in pipeline — dm them now, not after this message.
posts can wait til the weekend.

want me to draft the 3 DMs?
"""

Now generate Wednesday's mid-week check.
```

---

## n8n Query (Supabase, runs before Claude call)

```sql
-- KPI wtd for both businesses
SELECT
  business,
  metric,
  SUM(value_numeric) AS wtd_value
FROM grogu_kpi_log
WHERE recorded_at >= date_trunc('week', NOW())
  AND recorded_at < NOW()
GROUP BY business, metric;

-- Targets
SELECT * FROM grogu_kpi_targets WHERE period = 'weekly';

-- Active milestones (both businesses)
SELECT * FROM grogu_milestones WHERE status = 'active';

-- Open blockers (problems not resolved, last 7 days)
SELECT tldr FROM grogu_voice_notes
WHERE intent = 'problem'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 3;
```

---

## Failure mode

If no KPI data exists for this week (founder hasn't logged anything): send:
```
midweek. wednesday.

no kpi updates logged since monday. voice me a 30-sec update on both businesses — just the numbers.
can't check pace against nothing.
```

No LLM call needed for this fallback — pure conditional in n8n.

---

## Silence rule

If it's a public holiday (MY calendar) or the founder logged `intent=log` with mood_signal=`low` or `burnt` within the last 12 hours → delay the message by 3 hours and soft-open:
```
midweek check (delayed — looked like a rough morning). when you're ready:

[normal message]
```
