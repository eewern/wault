# n8n Environment Variables — Complete Setup

> Go to: n8n → Settings (bottom-left) → Variables → Add each one.
> Values marked ✅ are confirmed. Values marked ⬜ need you to fill in.

---

## WhatsApp

| Variable | Value | Status |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Get from Meta App Dashboard → WhatsApp → API Setup | ⬜ |
| `WHATSAPP_ACCESS_TOKEN` | Get from Meta App Dashboard → WhatsApp → API Setup | ⬜ |
| `FOUNDER_WHATSAPP_NUMBER` | Your personal number in international format e.g. `60123456789` | ⬜ |

**Where to find:** [developers.facebook.com](https://developers.facebook.com) → Your App → WhatsApp → API Setup → Phone Number ID + Temporary/Permanent token

---

## AI APIs

| Variable | Value | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | Get from [console.anthropic.com](https://console.anthropic.com) → API Keys | ⬜ |
| `OPENAI_API_KEY` | Get from [platform.openai.com](https://platform.openai.com) → API Keys | ⬜ |

---

## Supabase

| Variable | Value | Status |
|---|---|---|
| `SUPABASE_URL` | `https://fyyfsrriopewaiaeuxky.supabase.co` | ✅ |
| `SUPABASE_SERVICE_KEY` | Go to Supabase Dashboard → Project Settings → API → **service_role** key (NOT anon) | ⬜ |
| `GROGU_WORKSPACE_ID` | `ee7c3d34-02a5-4ff4-966d-d80f568455f0` | ✅ |

**Important:** Use the `service_role` key — NOT the anon key. The service role key lets n8n bypass Row Level Security to write data. It's only used server-side in n8n, never in a browser.

---

## notionwern API

| Variable | Value | Status |
|---|---|---|
| `NOTIONWERN_BASE_URL` | Production URL of your API server (e.g. `https://api.notionwern.com`). For local testing use `http://127.0.0.1:3334` | ⬜ |
| `NOTIONWERN_API_TOKEN` | The `WORKSPACE_API_TOKEN` you set when starting the server. Set one now if you haven't. | ⬜ |
| `NOTIONWERN_CHURNS_WS_ID` | `churns_ai_bible` | ✅ |
| `NOTIONWERN_XALT_WS_ID` | `xalt_strategy` | ✅ |
| `NOTIONWERN_GROGU_WS_ID` | `grogu_ops` | ✅ |
| `NOTIONWERN_GROGU_REVIEWS_PAGE_ID` | `p_mpjtzk6q_l2c867` | ✅ |
| `NOTIONWERN_GROGU_JOURNAL_PAGE_ID` | `p_mpjtzk85_0d6kuw` | ✅ |
| `NOTIONWERN_GROGU_DECISIONS_PAGE_ID` | `p_mpjtzk9c_gq275l` | ✅ |
| `NOTIONWERN_GROGU_KPI_PAGE_ID` | `p_mpjtzkau_nlsvd4` | ✅ |
| `NOTIONWERN_GROGU_IDEAS_PAGE_ID` | `p_mpjtzkc1_nylgpy` | ✅ |
| `NOTIONWERN_GROGU_TASK_BOARD_PAGE_ID` | `p_mpjtzkdf_ghekgr` | ✅ |

---

## Google Sheets

| Variable | Value | Status |
|---|---|---|
| `GSHEET_FINANCE_ID` | The ID from your Finance Google Sheet URL: `docs.google.com/spreadsheets/d/**[THIS PART]**/edit` | ⬜ |

**Also needed in n8n:** Create a Google OAuth2 credential (n8n → Credentials → Google Sheets OAuth2 API) and connect your Google account.

---

## General

| Variable | Value | Status |
|---|---|---|
| `GROGU_TIMEZONE` | `Asia/Kuala_Lumpur` | ✅ |
| `FOUNDER_NAME` | `Wern` | ✅ |

---

## Summary: what you need to gather

1. **WhatsApp credentials** — from Meta Developer App Dashboard
2. **Anthropic API key** — from console.anthropic.com
3. **OpenAI API key** — from platform.openai.com
4. **Supabase service_role key** — from Supabase Dashboard → Settings → API
5. **GROGU_WORKSPACE_ID** — run the SQL query after deploying schema
6. **notionwern production URL** — where your API server will be hosted (can use local for testing)
7. **Google Sheet ID** — from your Finance sheet URL

Once you have these 7 items, every n8n workflow can be wired up.

---

## After adding all variables: add the notionwern HTTP credential

In n8n → Credentials → New → HTTP Header Auth:
- **Name:** `notionwern-api`
- **Header Name:** `x-workspace-api-token`
- **Header Value:** (paste your `NOTIONWERN_API_TOKEN` value)

Builders reference this credential in every HTTP Request node that calls notionwern.
