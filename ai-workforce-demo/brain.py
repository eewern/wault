"""
agent_brain() — the ONLY place "intelligence" lives.

By default it returns rich, styled reasoning HTML built from the order facts
(a faithful simulation, like the original demo — instant, free, no API key).

To make this a REAL AI workforce, replace the body of agent_brain() with a
Claude call. A sketch is at the bottom of this file. Everything else in the
app (UI, streaming, pipeline, hand-offs) stays exactly the same.
"""


def _sys(method, system, desc):
    cls = {"GET": "sys-get", "POST": "sys-post", "CREATE": "sys-create"}.get(method, "sys-get")
    return (f'<span class="system-row"><span class="sys-badge {cls}">'
            f'<span class="sys-dot"></span>{method} <span class="sys-name">{system}</span></span> '
            f'<span class="sys-arrow">&rarr;</span> {desc}</span>')


def _label(text):
    return f'<span class="section-label">{text}</span>'


def _check(done, text):
    mark = "&#9989;" if done else "&#9203;"
    cls = "check-done" if done else "check-pending"
    return f'<span class="checklist-item"><span class="{cls}">{mark}</span> {text}</span>'


def _bullet(text):
    return f'<span class="bullet-point">&bull; {text}</span>'


def _hi(text):
    return f'<span class="highlight">{text}</span>'


def _dim(text):
    return f'<span class="dim">{text}</span>'


def agent_brain(agent_id, step, ctx):
    """Return reasoning HTML for one agent action.

    agent_id : sales | warehouse | inventory | delivery | support | manager
    step     : which action in the pipeline
    ctx      : facts available to the agent (customer, items, totals, etc.)
    """
    nl = "\n"

    if agent_id == "sales" and step == "intake":
        return nl.join([
            _label("Order Validation"),
            _sys("GET", "CRM", f"Retrieving customer history: {_hi(ctx['customer'])}"),
            _sys("GET", "OMS", f"Order items: {_hi(str(len(ctx['detail'])) + ' SKUs')}"),
            _sys("GET", "Inventory API", "Checking stock availability..."),
            _sys("GET", "Price Catalog", "Validating pricing..."),
            "",
            _check(True, "Customer verified — active account"),
            _check(False, "Cross-referencing inventory levels..."),
            "",
            _dim("Next: confirm or escalate"),
        ])

    if agent_id == "sales" and step == "confirm":
        rows = [_bullet(f"Customer: {_hi(ctx['customer'])}"),
                _bullet(f"Items: {len(ctx['detail'])} line items"),
                _bullet(f"Total: {_hi('RM %.2f' % ctx['total'])}")]
        return nl.join([
            _label("Order Summary"), *rows, "",
            _label("System Actions"),
            _sys("POST", "OMS", f"Order created #{ctx['order_id']}"),
            _sys("POST", "Payment Gateway", "Payment confirmed"),
            _sys("CREATE", "Queue Service", "Picking job enqueued"),
            "",
            _check(True, "All SKUs verified in stock"),
            _check(True, "Pricing matches catalog"),
            "",
            _dim("&rarr; Handing off to Warehouse"),
        ])

    if agent_id == "warehouse" and step == "pick":
        rows = [_bullet(f"{d['qty']}x {_hi(d['name'])} ({d['sku']})") for d in ctx["detail"]]
        return nl.join([
            _label(f"Pick List — Order #{ctx['order_id']}"), *rows, "",
            _sys("GET", "WMS", "Resolving bin locations..."),
            _check(True, "Route optimized across aisles"),
            _check(False, "Picking in progress..."),
            "",
            _dim("&rarr; Verifying with Inventory Control"),
        ])

    if agent_id == "inventory" and step == "check":
        rows = [_check(True, f"{d['name']}: stock OK") for d in ctx["detail"]]
        low = ctx.get("low") or []
        warn = [_check(False, f"Low-stock flag: {_hi(name)} — reorder soon") for name in low]
        return nl.join([
            _label("Stock Verification"), *rows, *warn, "",
            _sys("POST", "Inventory API", "Decrementing on-hand counts"),
            _dim("Levels updated — picking cleared"),
        ])

    if agent_id == "warehouse" and step == "pack":
        return nl.join([
            _label("Packing & QC"),
            _check(True, "Item count matches pick list"),
            _check(True, "No visible damage — QC pass"),
            _check(True, "Label printed & affixed"),
            "",
            _sys("POST", "OMS", f"Order #{ctx['order_id']} marked packed"),
            _dim("&rarr; Ready for dispatch"),
        ])

    if agent_id == "delivery" and step == "dispatch":
        return nl.join([
            _label("Dispatch Planning"),
            _sys("GET", "Courier API", "Comparing rates & ETAs..."),
            _sys("POST", "Courier API", f"Booked: {_hi(ctx['courier'])}"),
            _sys("CREATE", "Tracking", f"Tracking no. {_hi(ctx['tracking'])}"),
            "",
            _check(True, "Pickup window confirmed"),
            _check(True, "Customer notified"),
            "",
            _dim("ETA: Tomorrow"),
        ])

    if agent_id == "manager" and step == "complaint":
        return nl.join([
            _label("Complaint Triage"),
            _bullet(f"Customer: {_hi(ctx['customer'])}"),
            _bullet(f"Issue: wrong item — {_hi(ctx['product'])}"),
            "",
            _sys("POST", "Ticketing", "Priority case opened (P1)"),
            _check(True, "Return & replacement protocol initiated"),
            _dim("&rarr; Handing off to Customer Support"),
        ])

    if agent_id == "support" and step == "resolve":
        return nl.join([
            _label("Return & Replace"),
            _sys("CREATE", "Courier API", "Return pickup scheduled"),
            _sys("POST", "OMS", f"Replacement dispatched — {_hi(ctx['product'])}"),
            _sys("CREATE", "Tracking", f"New tracking {_hi(ctx['tracking'])}"),
            "",
            _check(True, "Goodwill credit applied"),
            _dim("Customer updated"),
        ])

    if agent_id == "inventory" and step == "audit":
        return nl.join([
            _label("Stock Audit"),
            _bullet(f"SKU: {_hi(ctx['product'])}"),
            _bullet(f"System on-hand: {_hi(str(ctx['stock']))}"),
            "",
            _sys("GET", "WMS", "Physical count reconciliation..."),
            _check(True, "Discrepancy confirmed — below reorder point"),
            _dim("&rarr; Escalating reorder to Manager"),
        ])

    if agent_id == "manager" and step == "reorder":
        return nl.join([
            _label("Reorder Approval"),
            _sys("POST", "Procurement", f"PO raised — {_hi(ctx['product'])}"),
            _check(True, "Supplier lead time within SLA"),
            _check(True, "Budget approved"),
            _dim("Discrepancy resolved"),
        ])

    # Fallback
    return _dim(f"{agent_id} processing {step}...")


# ──────────────────────────────────────────────────────────────────────────
# UPGRADE PATH — make it a real AI workforce.
#
# 1) pip install anthropic
# 2) export ANTHROPIC_API_KEY=...
# 3) Replace the body of agent_brain() above with something like:
#
# from anthropic import Anthropic
# _client = Anthropic()
# ROLE_PROMPTS = {
#     "sales":     "You are a hardware-store sales associate. Validate the order...",
#     "warehouse": "You are a warehouse picker. Plan the pick and packing...",
#     "inventory": "You are inventory control. Verify stock and flag reorders...",
#     "delivery":  "You are delivery dispatch. Choose a courier and ETA...",
#     "support":   "You are customer support. Resolve the complaint...",
#     "manager":   "You are the store manager. Triage and approve...",
# }
#
# def agent_brain(agent_id, step, ctx):
#     resp = _client.messages.create(
#         model="claude-sonnet-4-6",
#         max_tokens=400,
#         system=ROLE_PROMPTS[agent_id],
#         messages=[{"role": "user",
#                    "content": f"Step: {step}\nFacts: {ctx}\n"
#                               "Return your reasoning as the HTML span format used by this UI."}],
#     )
#     return resp.content[0].text
#
# For genuine autonomy, give each role real tools via MCP (inventory, OMS,
# payment, courier) instead of the simulated GET/POST lines.
