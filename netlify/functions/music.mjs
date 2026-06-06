import { getStore } from '@netlify/blobs';

/*
 * Global background-music on/off, stored in Netlify Blobs.
 *   GET   ->  { mode, v, ctx }     (v = version marker, ctx = is Blobs configured)
 *   POST  ->  set mode; requires header  x-admin-pass == DASHBOARD_PASSWORD
 *
 * Auto-configures via the static import (Netlify injects the context). If that isn't
 * available on the site, set env vars BLOBS_SITE_ID + BLOBS_TOKEN and it uses those.
 * Degrades gracefully (GET returns mode:null -> site uses data.json default).
 */

function json(status, obj) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

function configured() {
  return !!(process.env.NETLIFY_BLOBS_CONTEXT || (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN));
}

function store() {
  const opts = { name: 'site-config' };
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    opts.siteID = process.env.BLOBS_SITE_ID;
    opts.token = process.env.BLOBS_TOKEN;
  }
  return getStore(opts);
}

export const handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'GET') {
    const ctx = configured();
    try {
      const mode = await store().get('music_mode');
      return json(200, { mode: (mode === 'off' || mode === 'play') ? mode : null, v: 'mjs', ctx });
    } catch (e) {
      return json(200, { mode: null, v: 'mjs', ctx, err: String((e && e.message) || e).slice(0, 140) });
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
      await store().set('music_mode', mode);
      return json(200, { mode });
    } catch (e) {
      return json(500, { error: 'blobs', message: String((e && e.message) || e) });
    }
  }

  return json(405, { error: 'method' });
};
