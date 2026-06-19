import { getStore } from '@netlify/blobs';

/*
 * Global site config, stored in Netlify Blobs (every visitor sees the same value).
 *   GET   ->  { music, theme, sound, v, ctx }
 *               music: "play"|"off"|null   theme/sound: "on"|"off"|null   (null = unset -> client default)
 *   POST  ->  set one key; requires header  x-admin-pass == DASHBOARD_PASSWORD
 *               body { mode }                 -> music   (back-compat)
 *               body { set:"music", value }   -> music ("play"/"off")
 *               body { set:"theme", value }   -> theme button visibility ("on"/"off")
 *               body { set:"sound", value }   -> sound button visibility ("on"/"off")
 *
 * Auto-configures via the static import; if that isn't available on the site, set env vars
 * BLOBS_SITE_ID + BLOBS_TOKEN and it uses those. Degrades gracefully (client falls back to defaults).
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
    const out = { music: null, theme: null, sound: null, v: 'mjs', ctx };
    try {
      const s = store();
      const r = await Promise.all([s.get('music_mode'), s.get('theme_ui'), s.get('sound_ui')]);
      if (r[0] === 'off' || r[0] === 'play') out.music = r[0];
      if (r[1] === 'off' || r[1] === 'on') out.theme = r[1];
      if (r[2] === 'off' || r[2] === 'on') out.sound = r[2];
    } catch (e) {
      out.err = String((e && e.message) || e).slice(0, 140);
    }
    return json(200, out);
  }

  if (method === 'POST') {
    const given = (event.headers && (event.headers['x-admin-pass'] || event.headers['X-Admin-Pass'])) || '';
    if (!process.env.DASHBOARD_PASSWORD || given !== process.env.DASHBOARD_PASSWORD) {
      return json(401, { error: 'unauthorized' });
    }
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) {}

    let key, value, resp;
    if (body.mode !== undefined) {                                  // back-compat: music
      key = 'music_mode'; value = (body.mode === 'off') ? 'off' : 'play'; resp = { mode: value };
    } else if (body.set === 'music') {
      key = 'music_mode'; value = (body.value === 'off') ? 'off' : 'play'; resp = { mode: value };
    } else if (body.set === 'theme') {
      key = 'theme_ui'; value = (body.value === 'off') ? 'off' : 'on'; resp = { theme: value };
    } else if (body.set === 'sound') {
      key = 'sound_ui'; value = (body.value === 'off') ? 'off' : 'on'; resp = { sound: value };
    } else {
      return json(400, { error: 'bad_key' });
    }

    try {
      await store().set(key, value);
      return json(200, resp);
    } catch (e) {
      return json(500, { error: 'blobs', message: String((e && e.message) || e) });
    }
  }

  return json(405, { error: 'method' });
};
