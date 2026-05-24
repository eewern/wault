# Week 1 — Setup Checklist (Click-by-Click)

Goal by end of Week 1: every account exists, every key is in hand, n8n is running, WhatsApp number is approved by Meta, and a test message round-trips through Claude.

**Total time: ~6 hours spread across 7 days. The longest single waits are Meta API approval (2–5 days, async) and Hetzner provisioning (2 minutes).**

---

## Day 1 (Mon) — WhatsApp + Meta Business (~45 min, then waiting)

### 1.1 Buy a dedicated SIM
- Go to Hotlink, Yes, or Maxis. Get a prepaid number you'll dedicate to WIN AI.
- Reload RM 30. This is WIN AI's "phone number."
- **Save this number somewhere. You'll never use it personally.**

### 1.2 Create a Meta Business account
- Go to https://business.facebook.com → Create Account
- Use your founder email (the one tied to Churns/XALT, not personal)
- Business name: `WIN AI Operations` (it doesn't matter publicly)
- Country: Malaysia. Phone: your personal number (NOT the WIN AI SIM).

### 1.3 Add a WhatsApp Business app
- In Meta Business → App Dashboard → Create App → "Other" → "Business"
- Add product: **WhatsApp** (Business Platform — Cloud API, free tier)
- Add the WIN AI SIM number as a phone number
- Verify via SMS code (sent to that SIM — keep it powered on)
- **Save these 3 values:**
  - `WHATSAPP_PHONE_NUMBER_ID` (numeric, from app dashboard)
  - `WHATSAPP_BUSINESS_ACCOUNT_ID` (numeric)
  - `WHATSAPP_ACCESS_TOKEN` (long string — generate "permanent" token via System Users; the temp 24hr one will break things)

> Approval for sending messages can take 0–5 days. You can receive freely during this wait.

---

## Day 2 (Tue) — Hetzner + n8n (~90 min)

### 2.1 Create Hetzner Cloud account
- https://hetzner.com/cloud → Sign up
- Add payment card. **Tier: CX22 in Falkenstein (DEU) — €4.90/mo (~RM 25).**
- Project name: `win-ai`

### 2.2 Spin up the server
- New Server → Location: Falkenstein → Image: **Ubuntu 24.04**
- Type: CX22 (2 vCPU, 4 GB RAM, 40 GB SSD)
- SSH key: add one if you have it. If not, use password (Hetzner emails it).
- **Name it `win-ai-prod`. Save the IP address.**

### 2.3 Install Docker + n8n
SSH in (Mac Terminal: `ssh root@<your_ip>`). Run these one by one:

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose
mkdir -p /opt/n8n && cd /opt/n8n
```

Create `docker-compose.yml`:
```bash
nano docker-compose.yml
```
Paste:
```yaml
version: "3.8"
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=yourname
      - N8N_BASIC_AUTH_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
      - N8N_HOST=<your_ip>
      - N8N_PORT=5678
      - WEBHOOK_URL=http://<your_ip>:5678/
      - GENERIC_TIMEZONE=Asia/Kuala_Lumpur
    volumes:
      - n8n_data:/home/node/.n8n
volumes:
  n8n_data:
```
Save (Ctrl+O, Enter, Ctrl+X). Start it:
```bash
docker-compose up -d
```

Open browser: `http://<your_ip>:5678` → log in with the basic auth creds → create your n8n owner account.

> Later (Week 8): set up Caddy + a domain for HTTPS. For now HTTP is fine for solo use.

---

## Day 3 (Wed) — Supabase + Claude + Whisper (~45 min)

### 3.1 Supabase
- https://supabase.com → Sign up with GitHub or email
- New project: `win-ai`
- Region: `Singapore (Southeast Asia)`
- Password: **save it**. This is your database root password.
- After ~2 min provisioning: go to **SQL Editor**
- Open `03_DATABASE/supabase_schema.sql` from this folder → copy-paste → Run
- Go to **Settings → API**. Save:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

### 3.2 Claude API
- https://console.anthropic.com → Sign up / log in
- Settings → Billing → add card → top up USD $20 to start
- API Keys → Create Key → name it `win-ai-prod`
- Save `ANTHROPIC_API_KEY`

### 3.3 OpenAI Whisper
- https://platform.openai.com → Sign up / log in
- Billing → add card → top up USD $10
- API Keys → Create new secret key → name `win-ai-whisper`
- Save `OPENAI_API_KEY`

> If you want cheaper Whisper later, switch to Groq's whisper-large-v3 endpoint — roughly 1/3 the cost, same quality. Skip for now.

---

## Day 4 (Thu) — Notion workspace (~60 min)

- Open Notion → create new workspace **WIN AI Brain** (or use a section of your existing workspace)
- Open `02_NOTION_TEMPLATES/00_workspace_structure.md` from this folder
- Build the page tree exactly as shown (top-level pages → sub-pages)
- Paste each page's starter content from `02_NOTION_TEMPLATES/page_templates.md`
- **Link the two bibles**:
  - Inside `03_Churns_AI` → upload `01_ChurnsAI_Bible_v6.md` as a Notion page
  - Inside `04_XALT` → upload `XALT_Bible_2026_Updated.docx` (Notion will convert)
- Create a Notion integration:
  - Settings → Connections → Develop or manage integrations → New
  - Name: `WIN AI` → Capabilities: Read, Update, Insert
  - Save the `NOTION_INTEGRATION_TOKEN`
- Share the `WIN AI Brain` workspace with the integration (top-right "..." → Add Connections → WIN AI)

---

## Day 5 (Fri) — Google Sheet finance template (~45 min)

- New Google Sheet: **WIN AI Finance**
- Follow `05_GOOGLE_SHEET/finance_template.md` exactly — build the 6 tabs
- Share the sheet with a service account email (created later in n8n's Google Sheets node setup, Day 6)
- For now: just build the structure. WIN AI will start writing to it Week 3.

---

## Day 6 (Sat) — n8n credentials + Hello World (~60 min)

In n8n web UI (`http://<your_ip>:5678`):

### 6.1 Add credentials (Settings → Credentials)
- **WhatsApp Cloud API**: paste `WHATSAPP_ACCESS_TOKEN` + `PHONE_NUMBER_ID`
- **Anthropic**: paste `ANTHROPIC_API_KEY`
- **OpenAI**: paste `OPENAI_API_KEY`
- **Supabase**: paste `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- **Notion**: paste `NOTION_INTEGRATION_TOKEN`
- **Google Sheets**: OAuth flow → log into your Google account

### 6.2 First workflow — "Hello WIN"
- New workflow → name `00_hello_world`
- Add node: **WhatsApp Trigger** (webhook)
- Copy the webhook URL → go back to Meta App Dashboard → WhatsApp → Configuration → set this as the **Callback URL** → verify
- Add node: **Anthropic** → model `claude-haiku-4-5` → system: `You are WIN AI. Reply in one short sentence.` → user: `{{ $json.message.text.body }}`
- Add node: **WhatsApp** → Send message → to: `{{ $json.message.from }}` → body: `{{ $json.content[0].text }}`
- **Activate**.

### 6.3 Test
- WhatsApp the WIN AI number from your personal phone: "test"
- Should reply within ~3 seconds. If not → check execution log in n8n.

✅ End of Week 1: round-trip works. Knowledge base structure exists. Database is live.

---

## Week 2 preview

- Hand `06_BUILDER_SPEC/fiverr_brief.md` to a Fiverr/Upwork n8n builder (or DIY)
- They build Workflows 1–8 per `04_N8N_WORKFLOWS/build_guide.md`
- You answer their questions in WhatsApp like a normal client

---

## Common gotchas

| Problem | Fix |
|---|---|
| Meta API "phone number not verified" | Wait. Or re-send SMS code. Sometimes takes 10 min. |
| n8n won't load on browser | Check Hetzner firewall — open port 5678. `ufw allow 5678` |
| WhatsApp messages send fine but you can't receive | Webhook URL not registered in Meta dashboard. Re-add it. |
| Claude API "401" | API key has a space/newline at end. Re-paste. |
| Supabase SQL errors | You skipped a CREATE EXTENSION line. Re-run from top. |

If anything blocks for more than 30 min → screenshot, send to WIN AI build chat (or Claude here).
