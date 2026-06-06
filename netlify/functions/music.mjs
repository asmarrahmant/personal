import { getStore } from '@netlify/blobs';

/*
 * Global background-music on/off, stored in Netlify Blobs.
 *
 *   GET   ->  { mode: "play" | "off" | null }     (public; null = not set -> use data.json default)
 *   POST  ->  set mode; requires header  x-admin-pass == DASHBOARD_PASSWORD
 *
 * Uses a STATIC import of @netlify/blobs so Netlify detects Blobs usage at build time and
 * auto-configures the store (siteID/token) — no extra env vars needed. Degrades gracefully:
 * if Blobs is unavailable, GET returns mode:null and the site falls back to data.json.
 */

function json(status, obj) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

export const handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'GET') {
    try {
      const store = getStore('site-config');
      const mode = await store.get('music_mode');
      return json(200, { mode: (mode === 'off' || mode === 'play') ? mode : null });
    } catch (e) {
      return json(200, { mode: null });   // graceful fallback to data.json default
    }
  }

  if (method === 'POST') {
    const given = (event.headers && (event.headers['x-admin-pass'] || event.headers['X-Admin-Pass'])) || '';
    if (!process.env.DASHBOARD_PASSWORD || given !== process.env.DASHBOARD_PASSWORD) {
      return json(401, { error: 'unauthorized' });
    }
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    const mode = (body.mode === 'off') ? 'off' : 'play';
    try {
      const store = getStore('site-config');
      await store.set('music_mode', mode);
      return json(200, { mode });
    } catch (e) {
      return json(500, { error: 'blobs', message: String((e && e.message) || e) });
    }
  }

  return json(405, { error: 'method' });
};
