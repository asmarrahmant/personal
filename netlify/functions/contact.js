'use strict';

/*
 * Contact form proxy — forwards the submission to Formspree (notifies Asmar) and
 * sends the sender a confirmation ("auto-reply") email via Gmail SMTP.
 *
 * Why proxy: the browser posts to the SAME origin (/.netlify/functions/contact)
 * instead of cross-origin to formspree.io, so ad/privacy blockers can't swallow
 * the response and the on-page confirmation (plane + toast) reliably fires.
 *
 * Auto-reply setup (optional — the form still works without it):
 *   1. Turn on 2-Step Verification for your Google account.
 *   2. Create an App Password:  Google Account → Security → App passwords.
 *   3. Add these Netlify environment variables (Site settings → Environment):
 *        GMAIL_USER           your Gmail address (e.g. asmarrahmant@gmail.com)
 *        GMAIL_APP_PASSWORD   the 16-character app password (spaces optional)
 *   If GMAIL_* aren't set, the confirmation email is simply skipped.
 *
 * Optional:
 *   CONTACT_FORM_ENDPOINT   Formspree endpoint (defaults to the form below)
 */

var ENDPOINT = process.env.CONTACT_FORM_ENDPOINT || 'https://formspree.io/f/xykayany';

function json(status, obj) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* Confirmation email back to the sender ("I’ve got your message"). Best-effort.
   Wording adapts to the source (the Hire-me form sends source "Hiring Manager"). */
async function sendAutoReply(to, name, message, source) {
  var user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return;                                  // not configured -> skip
  var nodemailer = require('nodemailer');
  var transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: user, pass: pass } });

  var hiring = /hir/i.test(source || '');                      // Hire-me form
  var first = esc((name || '').trim().split(/\s+/)[0] || 'there');
  var subject = hiring ? 'Thanks for your interest — I’ve got your message' : 'Thanks for reaching out — I’ve got your message';
  var emoji = hiring ? '🙌' : '👋';
  var intro = hiring
    ? 'Thanks for considering me — I’ve received your details and I’ll get back to you as soon as I can, usually within a day or two.'
    : 'I’ve received your message and I’ll get back to you as soon as I can — usually within a day or two.';

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6">' +
      '<h2 style="margin:0 0 8px;color:#0b0b0e">Thanks, ' + first + '! ' + emoji + '</h2>' +
      '<p style="margin:0 0 16px">' + intro + '</p>' +
      '<p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.06em">Your message</p>' +
      '<blockquote style="margin:0 0 22px;padding:12px 16px;background:#f4f7ec;border-left:3px solid #a6e000;color:#444;white-space:pre-wrap">' + esc(message) + '</blockquote>' +
      '<p style="margin:0">Talk soon,<br><strong>Asmar Rahman</strong><br><span style="color:#888">Odoo Developer</span></p>' +
    '</div>';
  var text = 'Thanks, ' + (name || 'there') + '!\n\n' + intro + '\n\nYour message:\n' + (message || '') + '\n\n— Asmar Rahman, Odoo Developer';

  await transporter.sendMail({
    from: 'Asmar Rahman <' + user + '>',
    to: to,
    replyTo: user,
    subject: subject,
    text: text,
    html: html
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  var d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'Bad request' }); }

  var name = String(d.name || '').trim();
  var email = String(d.email || '').trim();
  var message = String(d.message || '').trim();
  var subject = String(d.subject || '').trim();
  var source = String(d.source || 'Contact Form').trim() || 'Contact Form';
  if (!name || !email || !message) return json(422, { ok: false, error: 'Please fill in your name, email and message.' });

  try {
    var r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        subject: subject,
        message: message,
        'Enquiry Type': source,
        _subject: '[' + source + '] ' + (subject || ('New message from ' + name))
      })
    });

    if (r.ok) {
      try { await sendAutoReply(email, name, message, source); } catch (e) { /* best-effort: never fail the submit on this */ }
      return json(200, { ok: true });
    }

    if (r.status === 429) return json(429, { ok: false, error: 'Too many messages right now — please try again in a minute.' });

    var j = {};
    try { j = await r.json(); } catch (e) {}
    var msg = (j && j.errors && j.errors[0] && j.errors[0].message) || (j && j.error) || 'Couldn’t send. Please email me directly.';
    return json(502, { ok: false, error: msg });
  } catch (err) {
    return json(502, { ok: false, error: 'Upstream error. Please email me directly.' });
  }
};
