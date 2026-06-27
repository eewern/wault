"""
AI Workforce Dashboard — Hardware Store order-fulfillment demo.

Six specialist "agents" collaborate to fulfil an order, streaming their
reasoning, hand-offs and chat to a live dashboard over Server-Sent Events.

This is a SIMULATION by default (no LLM, no cost, runs instantly). The only
place "intelligence" lives is agent_brain() in brain.py — swap that one
function for real Claude calls when you want a genuine AI workforce.

Run:
    pip install -r requirements.txt
    python app.py
    open http://localhost:5002
"""

import json
import queue
import random
import threading
import time
from datetime import datetime

from flask import Flask, Response, jsonify, render_template, request

from brain import agent_brain

app = Flask(__name__)

# ── Agent roster ─────────────────────────────────────────────────────────
AGENTS = [
    {"id": "manager",   "name": "Store Manager",     "icon": "👔"},
    {"id": "sales",     "name": "Sales Associate",   "icon": "🏪"},
    {"id": "warehouse", "name": "Warehouse Picker",  "icon": "📦"},
    {"id": "delivery",  "name": "Delivery Dispatch", "icon": "🚚"},
    {"id": "inventory", "name": "Inventory Control",  "icon": "📊"},
    {"id": "support",   "name": "Customer Support",  "icon": "💬"},
]

# ── Product catalogue ────────────────────────────────────────────────────
PRODUCTS = [
    {"sku": "DR-10MM",   "name": "Cordless Drill 12V",       "category": "Power Tools", "price": 189.0, "stock": 24,  "min_stock": 5,  "unit": "pcs"},
    {"sku": "DR-SET",    "name": "Drill Bit Set (10pcs)",    "category": "Power Tools", "price": 45.0,  "stock": 38,  "min_stock": 10, "unit": "set"},
    {"sku": "HM-16OZ",   "name": "Claw Hammer 16oz",         "category": "Hand Tools",  "price": 28.0,  "stock": 52,  "min_stock": 10, "unit": "pcs"},
    {"sku": "SC-SET",    "name": "Screwdriver Set (6pcs)",   "category": "Hand Tools",  "price": 35.0,  "stock": 41,  "min_stock": 10, "unit": "set"},
    {"sku": "PT-WHT5L",  "name": "Interior Paint White 5L",  "category": "Paint",       "price": 68.0,  "stock": 15,  "min_stock": 5,  "unit": "tin"},
    {"sku": "PT-BLU5L",  "name": "Interior Paint Blue 5L",   "category": "Paint",       "price": 68.0,  "stock": 8,   "min_stock": 5,  "unit": "tin"},
    {"sku": "CM-25KG",   "name": "Portland Cement 25kg",     "category": "Building",    "price": 22.0,  "stock": 120, "min_stock": 20, "unit": "bag"},
    {"sku": "WD-PLY",    "name": "Plywood Sheet 4x8ft",      "category": "Building",    "price": 55.0,  "stock": 30,  "min_stock": 8,  "unit": "sheet"},
    {"sku": "SP-WRNCH",  "name": "Spanner Set (8-22mm)",     "category": "Hand Tools",  "price": 78.0,  "stock": 19,  "min_stock": 5,  "unit": "set"},
    {"sku": "SD-EXT50M", "name": "Extension Cord 50m",       "category": "Electrical",  "price": 89.0,  "stock": 14,  "min_stock": 5,  "unit": "pcs"},
    {"sku": "LP-LED12W", "name": "LED Panel Light 12W",      "category": "Electrical",  "price": 32.0,  "stock": 65,  "min_stock": 15, "unit": "pcs"},
    {"sku": "WC-FLUSH",  "name": "Toilet Flush Valve",       "category": "Plumbing",    "price": 42.0,  "stock": 28,  "min_stock": 8,  "unit": "pcs"},
    {"sku": "PP-PVC25",  "name": "PVC Pipe 25mm (3m)",       "category": "Plumbing",    "price": 12.0,  "stock": 95,  "min_stock": 20, "unit": "length"},
    {"sku": "NS-NAIL50", "name": "Iron Nails 50mm (1kg)",    "category": "Fasteners",   "price": 8.0,   "stock": 88,  "min_stock": 20, "unit": "pack"},
    {"sku": "BT-SILIC",  "name": "Silicone Sealant (Clear)", "category": "Adhesives",   "price": 15.0,  "stock": 47,  "min_stock": 10, "unit": "tube"},
]
PRODUCT_BY_SKU = {p["sku"]: p for p in PRODUCTS}

SAMPLE_CUSTOMERS = ["Michelle Lim", "Ahmad Tan", "Priya Nair", "David Wong", "Siti Rahman"]
COURIERS = ["DHL eCommerce", "J&T Express", "Pos Laju", "Ninja Van"]

# ── Live state ───────────────────────────────────────────────────────────
def fresh_state():
    return {
        "agents": {a["id"]: {"status": "idle", "task": "", "reasoning": "", "task_count": 0}
                   for a in AGENTS},
        "inventory": {p["sku"]: p["stock"] for p in PRODUCTS},
        "orders": {},
        "activities": [],
        "messages": [],
    }

STATE = fresh_state()
STATE_LOCK = threading.Lock()
NEXT_ORDER_ID = [1001]

# ── Pub/Sub for SSE ──────────────────────────────────────────────────────
subscribers = []
subscribers_lock = threading.Lock()


def publish(event, data):
    payload = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    with subscribers_lock:
        for q in list(subscribers):
            q.put(payload)


def now():
    return datetime.now().strftime("%H:%M:%S")


# ── Emit helpers (update state + broadcast) ──────────────────────────────
def emit_message(source, text, agent_id=None, is_customer=False, is_alert=False):
    msg = {"id": _id(), "timestamp": now(), "source": source, "text": text,
           "agent_id": agent_id, "is_customer": is_customer, "is_alert": is_alert}
    with STATE_LOCK:
        STATE["messages"].append(msg)
    publish("message", msg)


def emit_activity(agent_id, phase, reasoning, output="", handoff_to=None):
    act = {"id": _id(), "agent_id": agent_id, "phase": phase, "reasoning": reasoning,
           "output": output, "handoff_to": handoff_to, "timestamp": now()}
    with STATE_LOCK:
        STATE["activities"].append(act)
    publish("activity", act)


def emit_agent(agent_id, status, task="", reasoning="", bump=False):
    with STATE_LOCK:
        ag = STATE["agents"][agent_id]
        ag["status"] = status
        ag["task"] = task
        ag["reasoning"] = reasoning
        if bump:
            ag["task_count"] += 1
        tc = ag["task_count"]
    publish("agent", {"id": agent_id, "status": status, "task": task,
                      "reasoning": reasoning, "task_count": tc})


def _id():
    return "%08x" % random.getrandbits(32)


# ── Order processing pipeline ────────────────────────────────────────────
job_queue = queue.Queue()


def make_sample_order():
    customer = random.choice(SAMPLE_CUSTOMERS)
    chosen = random.sample(PRODUCTS, k=random.randint(2, 3))
    items = [{"sku": p["sku"], "qty": random.randint(1, 3)} for p in chosen]
    return {"customer": customer, "items": items}


def price_order(items):
    detail, total = [], 0.0
    for it in items:
        p = PRODUCT_BY_SKU[it["sku"]]
        subtotal = p["price"] * it["qty"]
        total += subtotal
        detail.append({"sku": p["sku"], "name": p["name"], "qty": it["qty"],
                       "price": p["price"], "subtotal": subtotal})
    return detail, round(total, 2)


def order_summary_line(detail):
    return ", ".join(f"{d['qty']}x {d['name']}" for d in detail)


def process_order(order):
    """Run one order through the six-agent pipeline."""
    oid = NEXT_ORDER_ID[0]
    NEXT_ORDER_ID[0] += 1
    customer = order["customer"]
    items = order["items"]
    detail, total = price_order(items)
    summary = order_summary_line(detail)
    tracking = "MY" + "".join(random.choice("0123456789") for _ in range(9))
    courier = random.choice(COURIERS)

    with STATE_LOCK:
        STATE["orders"][str(oid)] = {
            "id": oid, "customer": customer, "items": items, "items_detail": detail,
            "total": total, "status": "processing", "created_at": now(),
            "courier": courier, "tracking": tracking, "completed_at": None,
        }

    # 1. Customer places the order
    emit_message(customer, f"Hi, I'd like to order: {summary}", is_customer=True)
    time.sleep(1.0)

    # 2. Sales — intake
    emit_agent("sales", "active", "Validating order", bump=True)
    emit_message("AI Sales Associate",
                 f"📋 New order from {customer}! Checking stock for {len(items)} items...",
                 agent_id="sales")
    emit_activity("sales", "📋 Order Intake",
                  agent_brain("sales", "intake", {"customer": customer, "detail": detail, "total": total}),
                  handoff_to="warehouse")
    time.sleep(1.4)

    # 3. Sales — confirm
    emit_activity("sales", "✅ Order Confirmed",
                  agent_brain("sales", "confirm", {"customer": customer, "detail": detail,
                                                   "total": total, "order_id": oid}),
                  handoff_to="warehouse")
    emit_message("AI Sales Associate",
                 f"✅ Order confirmed! Total: RM {total:.2f}. Sending to warehouse.",
                 agent_id="sales")
    emit_agent("sales", "idle")
    time.sleep(1.0)

    # 4. Warehouse — pick
    emit_agent("warehouse", "active", "Picking items", bump=True)
    emit_message("AI Warehouse Picker", f"📦 Picking order #{oid}: {summary}", agent_id="warehouse")
    emit_activity("warehouse", "📦 Warehouse Picking",
                  agent_brain("warehouse", "pick", {"detail": detail, "order_id": oid}),
                  handoff_to="inventory")
    time.sleep(1.4)

    # 5. Inventory — stock check + decrement
    emit_agent("inventory", "active", "Checking stock levels", bump=True)
    low = []
    with STATE_LOCK:
        for it in items:
            STATE["inventory"][it["sku"]] = max(0, STATE["inventory"][it["sku"]] - it["qty"])
            p = PRODUCT_BY_SKU[it["sku"]]
            if STATE["inventory"][it["sku"]] <= p["min_stock"]:
                low.append(p["name"])
    emit_activity("inventory", "📊 Stock Check",
                  agent_brain("inventory", "check", {"detail": detail, "low": low}))
    emit_agent("inventory", "idle")
    time.sleep(1.0)

    # 6. Warehouse — pack & QC
    emit_agent("warehouse", "active", "Packing & QC")
    emit_activity("warehouse", "📦 Packing & QC",
                  agent_brain("warehouse", "pack", {"order_id": oid}))
    emit_message("AI Warehouse Picker", "✅ All items picked. Packing and labeling...", agent_id="warehouse")
    emit_agent("warehouse", "idle")
    time.sleep(1.2)

    # 7. Delivery — dispatch
    emit_agent("delivery", "active", "Assigning courier", bump=True)
    emit_activity("delivery", "🚚 Dispatch Planning",
                  agent_brain("delivery", "dispatch", {"courier": courier, "tracking": tracking}),
                  handoff_to="customer")
    emit_message("AI Delivery Dispatcher",
                 f"🚚 Order assigned to {courier}. Tracking: {tracking}. ETA: Tomorrow.",
                 agent_id="delivery")
    emit_agent("delivery", "idle")
    time.sleep(1.0)

    # 8. Manager — close out
    with STATE_LOCK:
        STATE["orders"][str(oid)]["status"] = "delivered"
        STATE["orders"][str(oid)]["completed_at"] = now()
    emit_agent("manager", "active", "Closing order", bump=True)
    emit_message("AI Store Manager", f"🏁 Order #{oid} completed successfully.", agent_id="manager")
    emit_agent("manager", "idle")
    publish("order_complete", {"order_id": oid})


def process_inject(kind):
    """Inject an exception and watch Manager + Support resolve it."""
    customer = random.choice(SAMPLE_CUSTOMERS)

    if kind == "wrong_item":
        product = random.choice(PRODUCTS)
        emit_message("Customer",
                     f"🚨 I ordered a {product['name']} but received the wrong item!",
                     is_alert=True)
        time.sleep(1.0)
        emit_agent("manager", "active", "Triaging complaint", bump=True)
        emit_message("AI Store Manager",
                     "🔴 Complaint received! Initiating return & replacement protocol...",
                     agent_id="manager", is_alert=True)
        emit_activity("manager", "🔴 Complaint Triage",
                      agent_brain("manager", "complaint", {"customer": customer, "product": product["name"]}),
                      handoff_to="support")
        time.sleep(1.2)
        emit_agent("support", "active", "Arranging return", bump=True)
        emit_message("AI Customer Support",
                     "I'm sorry about that! Let me arrange a pickup and dispatch the correct item immediately.",
                     agent_id="support")
        new_tracking = "MY" + "".join(random.choice("0123456789") for _ in range(9))
        emit_activity("support", "🔧 Return & Replace",
                      agent_brain("support", "resolve", {"product": product["name"], "tracking": new_tracking}))
        time.sleep(1.2)
        emit_message("AI Customer Support",
                     f"✅ Return pickup scheduled. Correct item dispatched. New tracking: {new_tracking}.",
                     agent_id="support")
        emit_agent("support", "idle")
        time.sleep(0.8)
        emit_message("AI Store Manager",
                     "✅ Case resolved. Incident logged for quality review.", agent_id="manager")
        emit_agent("manager", "idle")

    elif kind == "stock_issue":
        product = min(PRODUCTS, key=lambda p: p["stock"])
        emit_message("Customer",
                     f"❓ Is the {product['name']} actually in stock? The site shows low availability.",
                     is_alert=True)
        time.sleep(1.0)
        emit_agent("inventory", "active", "Auditing stock", bump=True)
        emit_message("AI Inventory Control",
                     f"🔎 Investigating stock discrepancy for {product['name']}...",
                     agent_id="inventory", is_alert=True)
        emit_activity("inventory", "🔎 Stock Audit",
                      agent_brain("inventory", "audit", {"product": product["name"], "stock": product["stock"]}),
                      handoff_to="manager")
        time.sleep(1.2)
        emit_agent("manager", "active", "Approving reorder", bump=True)
        emit_activity("manager", "📝 Reorder Approval",
                      agent_brain("manager", "reorder", {"product": product["name"]}))
        emit_message("AI Store Manager",
                     f"✅ Reorder approved for {product['name']}. Supplier PO raised. Discrepancy resolved.",
                     agent_id="manager")
        emit_agent("manager", "idle")
        emit_agent("inventory", "idle")


def worker():
    while True:
        kind, payload = job_queue.get()
        try:
            if kind == "order":
                process_order(payload)
            elif kind == "inject":
                process_inject(payload)
        except Exception as exc:  # keep the worker alive on any error
            print("worker error:", exc)
        finally:
            job_queue.task_done()


threading.Thread(target=worker, daemon=True).start()


# ── Routes ───────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", agents=AGENTS)


@app.route("/api/products")
def api_products():
    return jsonify(PRODUCTS)


@app.route("/api/state")
def api_state():
    with STATE_LOCK:
        return jsonify({
            "agents": STATE["agents"],
            "agent_task_counts": {aid: STATE["agents"][aid]["task_count"] for aid in STATE["agents"]},
            "inventory": STATE["inventory"],
            "orders": STATE["orders"],
            "activities": STATE["activities"],
            "messages": STATE["messages"],
        })


@app.route("/stream")
def stream():
    def gen():
        q = queue.Queue()
        with subscribers_lock:
            subscribers.append(q)
        try:
            yield "event: ping\ndata: {}\n\n"
            while True:
                try:
                    yield q.get(timeout=20)
                except queue.Empty:
                    yield "event: ping\ndata: {}\n\n"
        finally:
            with subscribers_lock:
                if q in subscribers:
                    subscribers.remove(q)
    return Response(gen(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/api/order", methods=["POST"])
def api_order():
    body = request.get_json(silent=True) or {}
    if body.get("use_sample", True):
        order = make_sample_order()
    else:
        order = {"customer": body.get("customer", "Walk-in Customer"),
                 "items": body.get("items", [])}
    job_queue.put(("order", order))
    return jsonify({"queued": True})


@app.route("/api/inject", methods=["POST"])
def api_inject():
    body = request.get_json(silent=True) or {}
    job_queue.put(("inject", body.get("type", "wrong_item")))
    return jsonify({"queued": True})


@app.route("/api/reset", methods=["POST"])
def api_reset():
    global STATE
    with STATE_LOCK:
        STATE = fresh_state()
    NEXT_ORDER_ID[0] = 1001
    publish("agents_reset", {})
    return jsonify({"reset": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, threaded=True, debug=False)
