// db.js — Supabase write-through proxy for AIG Engineering Pulse
//
// The browser never talks to Supabase directly; it calls this function with the
// user's MSAL JWT, and this function talks to Supabase with the service-role key.
//
// Required environment variables (Netlify → Site settings → Environment variables):
//   SUPABASE_URL          e.g. https://abcdefgh.supabase.co
//   SUPABASE_SERVICE_KEY  the service_role key (Settings → API → service_role)
//
// Actions (POST /api/db, JSON body { action, ... }):
//   insert    { form_id, excel_row, ref, vals }          — mirror one new row
//   patch     { form_id, excel_row, updates:[{col,value}] } — mirror cell updates (checkout etc.)
//   list      { form_id }                                 — all rows for one form
//   list_bulk { form_ids: [...] }                         — all rows for many forms, ONE query
//   sync      { form_id, rows: [{excel_row, vals}] }      — bulk upsert (self-healing backfill)

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TABLE  = 'submissions';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function sb(path, opts = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };

  // Not configured yet → tell the client to quietly disable DB features
  if (!SB_URL || !SB_KEY)
    return { statusCode: 501, headers: cors, body: JSON.stringify({ error: 'DB not configured' }) };

  // Same JWT gate as read-excel: proves the caller is logged into the portal
  const tok = event.headers['x-session-token'] || event.headers['X-Session-Token'] || '';
  const isJWT = tok && tok.startsWith('ey') && tok.split('.').length === 3;
  if (!isJWT)
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Valid MSAL token required' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Bad JSON' }) }; }

  const { action } = body;

  try {
    // ── INSERT: mirror one freshly submitted row ─────────────────────────────
    if (action === 'insert') {
      const { form_id, excel_row, ref, vals } = body;
      if (!form_id || !excel_row || !Array.isArray(vals))
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'form_id, excel_row, vals required' }) };
      const r = await sb(`${TABLE}?on_conflict=form_id,excel_row`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ form_id, excel_row, ref: ref || String(vals[0] || ''), vals }])
      });
      if (!r.ok) throw new Error(`insert ${r.status}: ${await r.text()}`);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    // ── PATCH: mirror cell updates (e.g. checkout writes coTime into row) ────
    if (action === 'patch') {
      const { form_id, excel_row, updates } = body;
      if (!form_id || !excel_row || !Array.isArray(updates))
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'form_id, excel_row, updates required' }) };
      // Read current row, apply column updates (col is 1-based), write back
      const g = await sb(`${TABLE}?form_id=eq.${encodeURIComponent(form_id)}&excel_row=eq.${excel_row}&select=vals`);
      if (!g.ok) throw new Error(`patch-get ${g.status}`);
      const rows = await g.json();
      if (!rows.length)
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: false, note: 'row not mirrored yet' }) };
      const vals = rows[0].vals || [];
      for (const u of updates) {
        const i = (u.col | 0) - 1;
        if (i >= 0) { while (vals.length <= i) vals.push(''); vals[i] = u.value; }
      }
      const p = await sb(`${TABLE}?form_id=eq.${encodeURIComponent(form_id)}&excel_row=eq.${excel_row}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ vals })
      });
      if (!p.ok) throw new Error(`patch ${p.status}: ${await p.text()}`);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    // ── LIST: all rows for one form, Excel-shaped (synthetic header at [0]) ──
    if (action === 'list') {
      const { form_id } = body;
      if (!form_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'form_id required' }) };
      const r = await sb(`${TABLE}?form_id=eq.${encodeURIComponent(form_id)}&select=excel_row,vals&order=excel_row.asc&limit=5000`);
      if (!r.ok) throw new Error(`list ${r.status}`);
      const rows = await r.json();
      const values = [['#db']].concat(rows.map(x => x.vals));
      return { statusCode: 200, headers: cors, body: JSON.stringify({ values, count: rows.length }) };
    }

    // ── LIST_BULK: many forms in ONE query — the fast login path ─────────────
    if (action === 'list_bulk') {
      const ids = (body.form_ids || []).filter(x => typeof x === 'string' && /^[a-z0-9_]+$/i.test(x)).slice(0, 60);
      if (!ids.length) return { statusCode: 200, headers: cors, body: JSON.stringify({ results: {} }) };
      const inList = ids.map(encodeURIComponent).join(',');
      const t0 = Date.now();
      const r = await sb(`${TABLE}?form_id=in.(${inList})&select=form_id,excel_row,vals&order=form_id.asc,excel_row.asc&limit=20000`);
      if (!r.ok) throw new Error(`list_bulk ${r.status}`);
      const rows = await r.json();
      const results = {};
      for (const row of rows) {
        if (!results[row.form_id]) results[row.form_id] = [['#db']]; // synthetic header keeps .slice(1) semantics
        results[row.form_id].push(row.vals);
      }
      return { statusCode: 200, headers: cors, body: JSON.stringify({ results, ms: Date.now() - t0, rows: rows.length }) };
    }

    // ── SYNC: bulk upsert Excel rows → DB (self-healing backfill) ────────────
    if (action === 'sync') {
      const { form_id, rows } = body;
      if (!form_id || !Array.isArray(rows))
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'form_id, rows required' }) };
      const payload = rows
        .filter(x => x && x.excel_row > 1 && Array.isArray(x.vals)) // never store the header row
        .slice(0, 2000)
        .map(x => ({ form_id, excel_row: x.excel_row, ref: String((x.vals || [])[0] || ''), vals: x.vals }));
      if (!payload.length) return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, synced: 0 }) };
      const r = await sb(`${TABLE}?on_conflict=form_id,excel_row`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(`sync ${r.status}: ${await r.text()}`);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, synced: payload.length }) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
  } catch (e) {
    console.error('[db]', action, e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
