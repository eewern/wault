# Milestone Tracker — Notification Templates

> Workflow 8 is event-driven (Supabase trigger on `kpi_log` inserts). When a KPI value crosses a milestone target, it pings the founder. These are not LLM-generated — they're hard templates filled by the workflow. Faster, cheaper, predictable.

---

## Template 1 — Milestone HIT

Trigger: kpi_log value ≥ milestone target_value, before deadline.

```
M{n} closed. {milestone_title} hit {days_diff} days {early|on time|late}.

current: {current_value}
target: {target_value}
delta: +{delta} ({pct}%)

next: M{n+1} — {next_title}, {next_days_remaining} days, RM {next_gap} to add.
{action_recommendation_one_liner}

monday review will walk the path. nice work.
```

**Example:**
```
M1 closed. RM 10K MRR hit 5 days early.

current: RM 11,000
target: RM 10,000
delta: +RM 1,000 (10%)

next: M2 — RM 25K MRR, 31 days, RM 14K to add.
that's 4-5 retainer closes at RM 3K+ each. doable if audit-calls/wk hit 5+.

monday review will walk the path. nice work.
```

---

## Template 2 — Milestone WARNING (deadline approaching, behind pace)

Trigger: deadline in <7 days AND current_value < (target * (days_passed / total_days) * 0.9)

```
M{n} deadline in {days_left} days. behind pace.

current: {current_value}
target: {target_value}
gap: {gap}
needed rate: {gap_per_remaining_day} {metric_unit}/day

{specific_lever_from_bible}

push or pivot? voice me.
```

**Example:**
```
M1 deadline in 5 days. behind pace.

current: RM 8,400 MRR
target: RM 10,000 MRR
gap: RM 1,600
needed rate: RM 320 MRR/day for 5 days

= 1 retainer @ RM 1,600+ OR 2 retainers @ RM 800+
churns bible §10: kill criterion = "0 paying clients by end of June → stop content, 10 more calls"
you're not at 0, but the audit calls metric is the actual lever — you ran 3 last wk, target 5+.

push or pivot? voice me.
```

---

## Template 3 — Milestone MISSED

Trigger: deadline passed AND current_value < target_value.

```
M{n} deadline missed.

{current_value} of {target_value} ({pct}%)
gap: {gap}
days over: {days_over}

bible kill criterion (§{section}): "{kill_criterion_quote}"

three paths:
1. extend M{n} by 30 days, double down on the lever that was working
2. accept the rung and jump to M{n+1} target path
3. trigger the bible's pivot path

voice me which.
```

**Example:**
```
M1 deadline missed.

RM 8,400 of RM 10,000 (84%)
gap: RM 1,600
days over: 6

bible kill criterion (§10): "0 paying clients by end of June → stop all content. run 10 more calls first."
you have 4 clients (not 0). past deadline but inside the kill zone, not past it.

three paths:
1. extend M1 by 14 days — content engine is working, 2 deals in pipe
2. accept current RM 8.4K, jump to M2 RM 25K target (45 days)
3. pause new outbound, audit which content topics drove DMs, restart with sharper hook

voice me which.
```

---

## Template 4 — XALT critical-path milestone slipping

Trigger: any of the 10 launch_tracker milestones moves status amber/red within 30 days of launch date.

```
xalt launch tracker — {milestone_name} {status_change_to_color}.

target: {target_date}
status: {new_status}
days to launch: {days_to_launch}

knock-on:
{knock_on_1}
{knock_on_2}

three options:
1. {option_1}
2. {option_2}
3. {option_3}

deciding by {deadline_for_decision} keeps launch intact. voice me.
```

**Example:**
```
xalt launch tracker — OEM packaging slipped to amber.

target: 2026-06-30
status: amber (3rd delay logged)
days to launch: 56

knock-on:
- influencer drop window narrows 5 days
- hero review videos pushed from jul 25 → jul 30 — still doable but no buffer

three options:
1. hold aug 16, accept tighter influencer window — 80% likely on time
2. shift launch to aug 30 — restores buffer, costs 14 days of content burn
3. split batch — daily SKU only aug 16, focus 2 wks later

deciding by jul 1 keeps launch intact. voice me.
```

---

## Template 5 — Recurring problem flagged

Trigger: same topic logged in problems_log ≥3 times in 14 days.

```
pattern detected: "{topic_keyword}" — {count} times in {days} days.

not noise anymore.

context from your voice notes:
1. {voice_note_1_tldr} ({date_1})
2. {voice_note_2_tldr} ({date_2})
3. {voice_note_3_tldr} ({date_3})

decision needed:
- root cause clearer than before? what's the actual blocker?
- contingency: do you have a backup path if this doesn't unblock?
- escalate: anyone external (advisor, partner) you should pull in?

voice me 60 sec of your read on this.
```

---

## Template 6 — Cash threshold breach

Trigger: total cash position < (4 * 4-week avg burn).

```
🚨 runway under 4 weeks.

cash: RM {cash}
burn 4wk avg: RM {burn}/wk
runway: {runway} weeks

next 4 wks confirmed in: RM {confirmed_in}
next 4 wks committed out: RM {committed_out}
net: {net} ({status_color})

options:
1. accelerate churns: chase {list_of_late_invoices}, total RM {chase_total}
2. delay xalt capex: {largest_pending_capex} can push {weeks_pushable} wks?
3. cash injection: founder loan / line of credit / advance from {potential_client}

friday cashflow review will walk this in detail. but heads up now.
```

---

## Quiet hours

Templates 1-5 are routine: send during 09:00-21:00 only. Queue overnight.
Template 6 (🚨 cash) is urgent: send immediately, any hour.

---

## Output to founder

WhatsApp text only. Plain. No emoji except 🚨 (template 6).
Save the alert to Supabase `conversation_history` with `workflow_name = "milestone_tracker"`.
Append to Notion → relevant Weekly_review_log entry (so it shows up in Monday review context).
