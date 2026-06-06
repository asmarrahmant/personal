'use strict';

/*
 * Global background-music on/off, stored in Netlify Blobs (no extra setup — Blobs is
 * built into Netlify). This is what makes the admin toggle apply to EVERY visitor.
 *
 *   GET   ->  { mode: "play" | "off" | null }     (public read; null = not set, use data.json default)
 *   POST  ->  set mode; requires header  x-admin-pass == DASHBOARD_PASSWORD   (the same passphrase
 *             that guards the analytics panel)
 *
 * Degrades gracefully: if Blobs is ever unavailable, GET returns mode:null and the site
 * falls back to data.json's music.mode, so background music never breaks.
 */

function json(status, obj) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

async function configStore() {
  var mod = await import('@netlify/blobs');   // ESM package — dynamic import from CommonJS
  return mod.getStore('site-config');
}

exports.handler = async function (event) {
  var method = event.httpMethod;

  if (method === 'GET') {
    try {
      var store = await configStore();
      var mode = await store.get('music_mode');
      return json(200, { mode: (mode === 'off' || mode === 'play') ? mode : null });
    } catch (e) {
      return json(200, { mode: null });   // graceful: client uses data.json default
    }
  }

  if (method === 'POST') {
    var given = (event.headers && (event.headers['x-admin-pass'] || event.headers['X-Admin-Pass'])) || '';
    if (!process.env.DASHBOARD_PASSWORD || given !== process.env.DASHBOARD_PASSWORD) {
      return json(401, { error: 'unauthorized' });
    }
    var body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    var mode = (body.mode === 'off') ? 'off' : 'play';
    try {
      var store2 = await configStore();
      await store2.set('music_mode', mode);
      return json(200, { mode: mode });
    } catch (e) {
      return json(500, { error: 'blobs', message: String((e && e.message) || e) });
    }
  }

  return json(405, { error: 'method' });
};
