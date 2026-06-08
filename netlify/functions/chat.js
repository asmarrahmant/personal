'use strict';

/*
 * "Twyllo" — AI chatbot, serverless OpenAI proxy.
 *
 * The OpenAI key lives ONLY here (Netlify env var), never in the browser.
 * The bot is grounded on Asmar's real data (pulled from the deployed
 * data.json + testimonials.json) so it answers only from his actual work.
 *
 * Required Netlify environment variable:
 *   OPENAI_API_KEY   your OpenAI key (platform.openai.com -> API keys)
 * Optional:
 *   OPENAI_MODEL     defaults to "gpt-4o-mini"
 *
 * See CHATBOT-SETUP.md for the full walkthrough.
 */

var MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
var corpusCache = { text: '', at: 0 };

function json(status, obj) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

async function buildCorpus(host) {
  if (corpusCache.text && (Date.now() - corpusCache.at) < 600000) return corpusCache.text; // 10-min warm cache
  var base = 'https://' + host;
  var data = {}, tess = [];
  try { data = await (await fetch(base + '/data.json')).json(); } catch (e) {}
  try { tess = await (await fetch(base + '/testimonials.json')).json(); } catch (e) {}

  var L = [];
  L.push('Name: Asmar Rahman. Title: Odoo / ERP Developer & AI-Integration Specialist.');
  L.push('Based in Kerala, India and Dubai, UAE. Status: available for freelance and full-time work.');
  L.push('Contact: email asmarrahmant@gmail.com; WhatsApp +91 8138048803; GitHub github.com/asmarrahmant; LinkedIn linkedin.com/in/asmar-rahman-t; site azmarrahmant.netlify.app.');
  if (data.about && data.about.languages) L.push('Languages: ' + data.about.languages.join(', ') + '.');
  if (data.hero && data.hero.lead) L.push('Summary: ' + data.hero.lead);
  if (data.skills) L.push('Skills: ' + data.skills.join(', ') + '.');
  if (Array.isArray(data.experience)) {
    L.push('Experience:');
    data.experience.forEach(function (x) { L.push('- ' + x.role + ' at ' + x.company + ' (' + x.when + ', ' + x.type + ').'); });
  }
  if (Array.isArray(data.projects)) {
    L.push('Projects (' + data.projects.length + '):');
    data.projects.forEach(function (p) {
      L.push('- ' + p.title + ' [' + p.category + (p.versions ? ', ' + p.versions : '') + ']: ' + p.desc +
        ' Tech: ' + (p.builtWith || []).join(', ') + '. Role: ' + (p.roles || []).join(', ') + '.' +
        (p.metric ? ' Highlight: ' + p.metric + '.' : '') + (p.result ? ' Result: ' + p.result : ''));
    });
  }
  if (Array.isArray(data.certs)) L.push('Certifications include: ' + data.certs.slice(0, 18).map(function (c) { return c.title + ' (' + c.issuer + ')'; }).join('; ') + '.');
  if (Array.isArray(data.awards)) L.push('Awards: ' + data.awards.map(function (a) { return a.title + ' (' + a.year + ')'; }).join('; ') + '.');
  if (Array.isArray(tess) && tess.length) {
    L.push('Testimonials:');
    tess.forEach(function (t) { L.push('- "' + t.message + '" -- ' + t.name + ', ' + t.role); });
  }
  corpusCache = { text: L.join('\n'), at: Date.now() };
  return corpusCache.text;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  var key = process.env.OPENAI_API_KEY;
  if (!key) return json(500, { error: 'not_configured', message: 'The AI chat isn’t switched on yet — set OPENAI_API_KEY in Netlify. Meanwhile you can email asmarrahmant@gmail.com.' });

  var body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad_json' }); }
  var msgs = (Array.isArray(body.messages) ? body.messages : [])
    .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; })
    .slice(-8)
    .map(function (m) { return { role: m.role, content: m.content.slice(0, 800) }; });
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json(400, { error: 'no_message' });

  var host = (event.headers && (event.headers['x-forwarded-host'] || event.headers.host)) || 'azmarrahmant.netlify.app';
  var corpus = '';
  try { corpus = await buildCorpus(host); } catch (e) {}

  var system = 'You are "Twyllo", a concise, friendly AI assistant that answers questions about Asmar Rahman for recruiters and prospective clients. ' +
    'Answer ONLY using the PROFILE below. If a question is not covered by the PROFILE, say you can only answer questions about Asmar\'s work and point them to the "Hire me" form or asmarrahmant@gmail.com. ' +
    'Keep answers to 2-4 sentences. Refer to him as "Asmar" in the third person. Cite specific project names when relevant. ' +
    'Never invent facts, numbers, employers, or projects that are not in the PROFILE. ' +
    'When the user shows hiring intent, warmly suggest they reach out via the contact form or email.\n\nPROFILE:\n' + corpus;

  var payload = {
    model: MODEL,
    messages: [{ role: 'system', content: system }].concat(msgs),
    max_tokens: 450,
    temperature: 0.3
  };

  try {
    var r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      var detail = ''; try { detail = (await r.text()).slice(0, 200); } catch (e) {}
      return json(502, { error: 'upstream', message: 'The AI service returned an error (' + r.status + '). Please try again shortly.', detail: detail });
    }
    var out = await r.json();
    var reply = out && out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content;
    return json(200, { reply: (reply || 'Sorry, I couldn’t generate a reply just now.').trim() });
  } catch (e) {
    return json(502, { error: 'network', message: String((e && e.message) || e) });
  }
};
