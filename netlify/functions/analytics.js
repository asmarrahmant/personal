'use strict';

/*
 * Secure GoatCounter analytics proxy for the portfolio admin panel.
 *
 * Secrets live ONLY here (server-side Netlify env vars) — never in the browser.
 * The browser sends the passphrase in the `x-admin-pass` header; we verify it here
 * and only then call GoatCounter with the secret API token.
 *
 * Required Netlify environment variables
 * (Site settings -> Environment variables -> Add a variable):
 *   GOATCOUNTER_CODE       your GoatCounter code, e.g. "asmar" (from asmar.goatcounter.com)
 *   GOATCOUNTER_API_TOKEN  a GoatCounter API token (GoatCounter -> top-right menu -> API),
 *                          with the "Read statistics" permission
 *   DASHBOARD_PASSWORD     the passphrase you type in the in-site Analytics panel
 *
 * After setting them, redeploy. See ANALYTICS-SETUP.md for the full walkthrough.
 */

var EVENT_LABELS = {
  'cv-download': 'CV downloaded',
  'cv-view': 'Résumé viewed in browser',
  'hire-open': 'Hire modal opened',
  'contact-submit': 'Contact form sent',
  'hire-submit': 'Hire form sent'
};

function json(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj)
  };
}

// length-independent constant-time-ish compare to avoid trivial timing leaks
function safeEqual(a, b) {
  a = String(a == null ? '' : a);
  b = String(b == null ? '' : b);
  if (a.length !== b.length) return false;
  var out = 0;
  for (var i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

exports.handler = async function (event) {
  var code = (process.env.GOATCOUNTER_CODE || '').trim();
  var token = (process.env.GOATCOUNTER_API_TOKEN || '').trim();
  var password = process.env.DASHBOARD_PASSWORD;

  if (!code || !token || !password) {
    return json(500, {
      error: 'not_configured',
      message: 'Server not configured. Set GOATCOUNTER_CODE, GOATCOUNTER_API_TOKEN and DASHBOARD_PASSWORD in your Netlify environment variables, then redeploy.'
    });
  }

  var headersIn = event.headers || {};
  var given = headersIn['x-admin-pass'] || headersIn['X-Admin-Pass'] || '';
  if (!safeEqual(given, password)) {
    return json(401, { error: 'unauthorized', message: 'Incorrect passphrase.' });
  }

  // date range (days back from today)
  var days = 30;
  var q = event.queryStringParameters || {};
  if (q.days) {
    var parsed = parseInt(q.days, 10);
    if (!isNaN(parsed)) days = Math.max(1, Math.min(366, parsed));
  }
  var end = new Date();
  var start = new Date(Date.now() - days * 24 * 3600 * 1000);
  // GoatCounter needs RFC3339 datetimes rounded to the hour; it 400s on date-only
  // and on a daily= param for /stats/total.
  var fmtDay = function (x) { return x.toISOString().slice(0, 10); };          // for display
  var fmtTs = function (x) { return x.toISOString().slice(0, 13) + ':00:00Z'; }; // for the API
  var qs = 'start=' + fmtTs(start) + '&end=' + fmtTs(end);

  var base = 'https://' + code + '.goatcounter.com/api/v0';
  var gcHeaders = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  var get = async function (path) {
    var r = await fetch(base + path, { headers: gcHeaders });
    if (!r.ok) {
      var detail = '';
      try { detail = (await r.text()).slice(0, 200); } catch (_) {}
      var hint = r.status === 401
        ? ' — GoatCounter rejected the API token. Verify GOATCOUNTER_API_TOKEN (no quotes/spaces) and that GOATCOUNTER_CODE is the exact site the token was created on.'
        : (r.status === 403 ? ' — the token lacks permission; recreate it in GoatCounter with "Read: Get statistics" enabled.' : '');
      throw new Error('GoatCounter ' + path.split('?')[0] + ' returned HTTP ' + r.status + (detail ? ' (' + detail + ')' : '') + hint);
    }
    return r.json();
  };

  try {
    var results = await Promise.all([
      get('/stats/total?' + qs),
      get('/stats/hits?' + qs + '&limit=200')
    ]);
    var total = results[0] || {};
    var hits = results[1] || {};

    var allHits = Array.isArray(hits.hits) ? hits.hits : [];
    var isEvent = function (h) { return h.event === true || h.event === 1; };

    var pages = allHits.filter(function (h) { return !isEvent(h); })
      .map(function (h) { return { path: h.path, title: h.title || h.path, count: h.count || 0 }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 12);

    var events = allHits.filter(isEvent)
      .map(function (h) { return { key: h.path, label: EVENT_LABELS[h.path] || h.title || h.path, count: h.count || 0 }; });

    // make sure the five known conversion events always show (at 0 if no clicks yet)
    Object.keys(EVENT_LABELS).forEach(function (k) {
      if (!events.some(function (e) { return e.key === k; })) {
        events.push({ key: k, label: EVENT_LABELS[k], count: 0 });
      }
    });
    events.sort(function (a, b) { return b.count - a.count; });

    var series = (Array.isArray(total.stats) ? total.stats : []).map(function (s) {
      var c = (typeof s.daily === 'number')
        ? s.daily
        : (Array.isArray(s.hourly) ? s.hourly.reduce(function (a, b) { return a + b; }, 0) : 0);
      return { day: s.day, count: c };
    });

    return json(200, {
      range: { start: fmtDay(start), end: fmtDay(end), days: days },
      totalPageviews: total.total || 0,
      totalEvents: (typeof total.total_events === 'number')
        ? total.total_events
        : events.reduce(function (a, e) { return a + e.count; }, 0),
      series: series,
      pages: pages,
      events: events,
      code: code
    });
  } catch (e) {
    return json(502, { error: 'upstream', message: String((e && e.message) || e) });
  }
};
