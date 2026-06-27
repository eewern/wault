# AI Workforce Dashboard

A live dashboard showing six specialist "agents" collaborating to fulfil
hardware-store orders — order intake, picking, stock check, packing,
dispatch, and exception handling (returns / stock discrepancies).

This is a recreation of a demo concept, built so you can run and extend it
yourself. By default it is a **simulation** (no LLM, no API key, no cost) so
it runs instantly. The "thinking" lives in one swappable function.

## Run

```bash
cd ai-workforce-demo
pip install -r requirements.txt
python app.py
```

Open http://localhost:5002

- **New Order** — runs a random order through all six agents.
- **Wrong Item** — injects a complaint; Manager + Support resolve it.
- **Stock Discrepancy** — injects a stock audit; Inventory + Manager resolve it.
- **Reset** — clears all state.

## How it works

```
Browser ──fetch──▶ /api/products, /api/state      (catalogue + snapshot)
Browser ──SSE────▶ /stream                         (live message/activity/agent events)
Browser ──POST───▶ /api/order, /api/inject, /api/reset
```

- `app.py` — Flask backend: agent roster, product catalogue, the order
  pipeline, the SSE pub/sub, and all routes. A background worker thread runs
  one order/exception at a time so the agents don't overlap.
- `brain.py` — `agent_brain(agent_id, step, ctx)` is the ONLY place
  intelligence lives. It returns the reasoning HTML each agent shows.
- `templates/index.html` — the dashboard UI (agent status bar, reasoning
  timeline, live chat feed).

## Make it a real AI workforce

Everything except `agent_brain()` stays the same. To use real Claude agents:

```bash
pip install anthropic
export ANTHROPIC_API_KEY=...
```

Then replace the body of `agent_brain()` in `brain.py` with a Claude call
(`claude-sonnet-4-6`), one system prompt per role. A worked sketch is in the
comments at the bottom of `brain.py`. For genuine autonomy, give each role
real tools via MCP (inventory, OMS, payment, courier) instead of the
simulated GET/POST lines.

## Notes

- Single-process in-memory state — fine for a demo / single viewer. For
  multi-user, move state to Redis and run behind a proper WSGI server
  (gunicorn/uvicorn) rather than Flask's dev server.
