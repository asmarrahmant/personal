# "Ask my portfolio" AI chatbot — setup (3 minutes)

Your site has a floating **Ask my portfolio** chat (bottom-right). Visitors chat with an
OpenAI assistant that's **grounded on your real `data.json`** — it answers only from your
actual projects, experience, skills, certs and testimonials, and nudges hiring-intent
visitors to your contact form. It's a live demo of the exact AI/Odoo skill you sell.

**Why it's secure:** the OpenAI key lives only in Netlify's server-side environment. The
function [netlify/functions/chat.js](netlify/functions/chat.js) calls OpenAI; the browser
never sees the key.

---

## Step 1 — Get an OpenAI API key
1. Go to <https://platform.openai.com> → **API keys** → **Create new secret key**.
2. Copy it (starts with `sk-…`). Add a little billing credit if your account has none —
   the chat uses `gpt-4o-mini`, which is very cheap (fractions of a cent per message).

## Step 2 — Add it to Netlify
Netlify → your site → **Site configuration → Environment variables → Add a variable**:

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | your `sk-…` key |
| `OPENAI_MODEL` *(optional)* | defaults to `gpt-4o-mini`; set another model if you prefer |

## Step 3 — Redeploy
Push, or Netlify → Deploys → **Trigger deploy**. The function ships automatically.

## Step 4 — Try it
Open your live site, click **Ask my portfolio**, and ask things like *"What's his Odoo
experience?"* or *"Has he built OpenAI features?"*.

---

### Notes
- **Local preview:** the chat needs the Netlify function, so it only works on the deployed
  site (or `netlify dev`). Locally it shows a friendly "runs on the live site" message.
- **Grounding:** the function pulls your deployed `data.json` + `testimonials.json` at
  runtime (cached 10 min), so the bot stays in sync with your site automatically.
- **Cost control:** input is capped (last 8 messages, 800 chars each) and replies are
  capped at ~450 tokens. For heavy traffic, consider adding a rate-limit (e.g. Upstash) —
  the current caps keep per-message cost tiny but don't hard-limit volume.
- **Switching providers:** the function uses the OpenAI Chat Completions API; point it at
  any compatible endpoint by editing the `fetch` URL if you ever move providers.
