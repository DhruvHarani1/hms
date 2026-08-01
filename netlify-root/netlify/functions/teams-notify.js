// netlify/functions/teams-notify.js
// POST proxy for Teams incoming webhook — called by both the portal (client-side)
// and other Netlify functions (server-side).
//
// Setup: In Teams, go to a channel > ... > Connectors > Incoming Webhook
// Copy the webhook URL and set it as TEAMS_WEBHOOK_URL in Netlify env vars.
//
// POST body: { title, facts: [[key,val],...], approveUrl?, returnUrl?, color?, tag? }

const BASE_URL = 'https://pulse-aigengineering.netlify.app';

function buildCard(title, facts, approveUrl, returnUrl, color, tag) {
  // Adaptive Card 1.4 — works in Teams desktop, mobile, and web
  const body = [];

  // Header row: tag pill + title
  if (tag) {
    body.push({
      type: 'ColumnSet',
      columns: [
        {
          type: 'Column', width: 'auto',
          items: [{
            type: 'TextBlock',
            text: tag,
            size: 'Small',
            weight: 'Bolder',
            color: color === 'good' ? 'Good' : color === 'warning' ? 'Warning' : color === 'attention' ? 'Attention' : 'Accent',
          }]
        },
        {
          type: 'Column', width: 'stretch',
          items: [{ type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true }]
        }
      ]
    });
  } else {
    body.push({ type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true });
  }

  // Facts table
  if (facts && facts.length) {
    body.push({ type: 'FactSet', facts: facts.map(([t, v]) => ({ title: String(t), value: String(v) })) });
  }

  // Actions
  const actions = [];
  if (approveUrl) {
    actions.push({ type: 'Action.OpenUrl', title: '✓  Approve', url: approveUrl, style: 'positive' });
    actions.push({ type: 'Action.OpenUrl', title: '↩  Return',  url: returnUrl,  style: 'destructive' });
  }
  actions.push({ type: 'Action.OpenUrl', title: 'Open in Pulse', url: BASE_URL });

  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body,
        actions
      }
    }]
  };
}

// Shared helper — also exported so other Netlify functions can import it
async function postToTeams(webhookUrl, title, facts, approveUrl, returnUrl, color, tag) {
  if (!webhookUrl) return { ok: false, reason: 'no webhook url' };
  try {
    const card = buildCard(title, facts, approveUrl, returnUrl, color, tag);
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });
    if (!r.ok) {
      const text = await r.text();
      console.warn('[teams-notify] Webhook error:', r.status, text.slice(0, 200));
      return { ok: false, status: r.status };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[teams-notify] Error:', e.message);
    return { ok: false, error: e.message };
  }
}

exports.postToTeams = postToTeams;

exports.handler = async (event) => {
  // Allow portal to post notifications via this proxy (avoids CORS + keeps webhook secret)
  const headers = {
    'Access-Control-Allow-Origin': 'https://pulse-aigengineering.netlify.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[teams-notify] TEAMS_WEBHOOK_URL not configured');
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  try {
    const { title, facts, approveUrl, returnUrl, color, tag } = JSON.parse(event.body || '{}');
    if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'title required' }) };
    const result = await postToTeams(webhookUrl, title, facts, approveUrl, returnUrl, color, tag);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: e.message }) };
  }
};
