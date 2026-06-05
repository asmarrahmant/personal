# In-portfolio Analytics — setup (5 minutes)

Your site has a hidden, passphrase-protected **Analytics** panel (the small "Admin" link in
the footer, or visit `your-site/#admin`). It shows pageviews, a daily chart, your top pages
and your conversion events (CV downloads, Hire-me opens, form submits) — all pulled securely
from GoatCounter.

**Why it's secure:** the GoatCounter API token and the passphrase live only in Netlify's
server-side environment variables. A Netlify Function ([netlify/functions/analytics.js](netlify/functions/analytics.js))
checks the passphrase and talks to GoatCounter; the browser never sees the token.

---

## Step 1 — Create a GoatCounter account (free)

1. Go to <https://www.goatcounter.com> → **Sign up**.
2. Pick a code, e.g. `asmar` → your site becomes `asmar.goatcounter.com`.
3. In [index.html](index.html), near the bottom, replace `YOURCODE` in the GoatCounter
   `<script>` with your code so pageviews + events start recording:
   ```html
   <script data-goatcounter="https://asmar.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
   ```

## Step 2 — Create a GoatCounter API token

1. In GoatCounter, click your **code/username** (top-right) → **API**.
2. **Create token** → tick **“Read statistics”** → save.
3. Copy the token string (you'll paste it into Netlify next).

## Step 3 — Add three environment variables in Netlify

Netlify → your site → **Site configuration → Environment variables → Add a variable**:

| Key | Value |
|-----|-------|
| `GOATCOUNTER_CODE` | your code, e.g. `asmar` |
| `GOATCOUNTER_API_TOKEN` | the token from Step 2 |
| `DASHBOARD_PASSWORD` | any passphrase you'll type to open the panel |

## Step 4 — Redeploy

Trigger a deploy (push to git, or Netlify → Deploys → **Trigger deploy**). The function
ships automatically because of [netlify.toml](netlify.toml).

## Step 5 — Open it

Visit your live site, click **Admin** in the footer (or add `#admin` to the URL), type your
`DASHBOARD_PASSWORD`, and you're in.

---

### Notes
- **Local preview:** the panel needs the Netlify Function, which only runs on the deployed
  site (or via `netlify dev`). Opening `index.html` from disk will show a "works on the
  deployed site" message — that's expected.
- **Change the passphrase:** just edit `DASHBOARD_PASSWORD` in Netlify and redeploy.
- **Cloudflare** stays as-is for pageviews + Core Web Vitals; this panel adds the GoatCounter
  data (especially the click events Cloudflare's free tier can't show).
- The passphrase is verified server-side, so it's real protection for the data — but treat it
  like any shared secret (don't reuse an important password).
