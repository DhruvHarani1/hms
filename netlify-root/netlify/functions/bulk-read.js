// netlify/functions/bulk-read.js
// POST /api/bulk-read
// Body: { files: [{id, file, sheet}, ...] }
// Reads all requested Excel files IN PARALLEL inside one Lambda invocation.
// Lambda is co-located with SharePoint → each Graph hop ~30-80ms.
// Returns: { results: { [id]: [[row values], ...] }, ms: number }
//
// Auth: same as read-excel.js — app token (client credentials) + x-session-token check.

const GRAPH   = 'https://graph.microsoft.com/v1.0';
const SP_HOST = 'floindexventures.sharepoint.com';
const SP_SITE = 'OpsPortalData';
const ALLOWED_ORIGIN = 'https://pulse-aigengineering.netlify.app';
const MAX_FILES = 60; // safety limit

// ── Module-level cache (warm Lambda restarts) ─────────────────────────────────
const CACHE = {
  appToken:    null,
  tokenExpiry: 0,
  driveId:     null,
  fileIds:     {},     // filename → fileId
  fileNames:   null,   // root listing for fuzzy match
};

async function getAppToken() {
  const now = Date.now();
  if (CACHE.appToken && CACHE.tokenExpiry > now + 60_000) return CACHE.appToken;
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const r = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' }) }
  );
  if (!r.ok) throw new Error('App token failed: ' + r.status);
  const d = await r.json();
  CACHE.appToken    = d.access_token;
  CACHE.tokenExpiry = now + (d.expires_in || 3600) * 1000;
  return CACHE.appToken;
}

async function getDriveId(tok) {
  if (CACHE.driveId) return CACHE.driveId;
  const sr = await fetch(`${GRAPH}/sites/${SP_HOST}:/sites/${SP_SITE}`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!sr.ok) throw new Error('Site lookup: ' + sr.status);
  const siteId = (await sr.json()).id;
  const dr = await fetch(`${GRAPH}/sites/${siteId}/drive`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!dr.ok) throw new Error('Drive lookup: ' + dr.status);
  CACHE.driveId = (await dr.json()).id;
  return CACHE.driveId;
}

function norm(name) {
  return name.toLowerCase().replace(/[\s\-_.]+/g, '').replace(/\.xlsx$/i, '');
}

async function getFileId(tok, driveId, filename) {
  if (CACHE.fileIds[filename]) return CACHE.fileIds[filename];
  const exact = await fetch(
    `${GRAPH}/drives/${driveId}/root:/${encodeURIComponent(filename)}?$select=id,name`,
    { headers: { Authorization: `Bearer ${tok}` } }
  );
  if (exact.ok) {
    const id = (await exact.json()).id;
    CACHE.fileIds[filename] = id;
    return id;
  }
  // Fuzzy match via root listing (cached)
  if (!CACHE.fileNames) {
    const list = await fetch(
      `${GRAPH}/drives/${driveId}/root/children?$select=id,name&$top=300`,
      { headers: { Authorization: `Bearer ${tok}` } }
    );
    if (!list.ok) throw new Error('Cannot list drive: ' + list.status);
    CACHE.fileNames = (await list.json()).value || [];
  }
  const match = CACHE.fileNames.find(f => norm(f.name) === norm(filename));
  if (!match) throw new Error(`Not found: "${filename}"`);
  CACHE.fileIds[filename] = match.id;
  return match.id;
}

async function readOneFile(tok, driveId, { id, file, sheet }) {
  try {
    const fileId   = await getFileId(tok, driveId, file);
    const sheetEnc = encodeURIComponent(sheet || 'Sheet1');
    const url      = `${GRAPH}/drives/${driveId}/items/${fileId}/workbook/worksheets('${sheetEnc}')/usedRange?$select=values`;
    const r        = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, 'Cache-Control': 'no-cache' } });
    if (r.ok) return { id, values: (await r.json()).values || [] };

    // Sheet name mismatch — try first sheet
    const sheetsR = await fetch(
      `${GRAPH}/drives/${driveId}/items/${fileId}/workbook/worksheets?$select=name`,
      { headers: { Authorization: `Bearer ${tok}` } }
    );
    if (sheetsR.ok) {
      const first = ((await sheetsR.json()).value || [])[0]?.name;
      if (first) {
        const r2 = await fetch(
          `${GRAPH}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(first)}')/usedRange?$select=values`,
          { headers: { Authorization: `Bearer ${tok}`, 'Cache-Control': 'no-cache' } }
        );
        if (r2.ok) return { id, values: (await r2.json()).values || [] };
      }
    }
    console.warn('[bulk-read] Failed:', file, r.status);
    return { id, values: [], error: r.status };
  } catch (e) {
    console.warn('[bulk-read] Error:', file, e.message);
    return { id, values: [], error: e.message };
  }
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-session-token',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: cors, body: 'POST only' };

  const sessionToken = event.headers['x-session-token'] || event.headers['X-Session-Token'] || '';
  const isJWT = sessionToken && sessionToken.startsWith('ey') && sessionToken.split('.').length === 3;
  if (!isJWT) {
    console.warn('[bulk-read] 401 — token missing or not a JWT. Length:', sessionToken.length);
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Valid MSAL token required' }) };
  }

  let files;
  try { ({ files } = JSON.parse(event.body || '{}')); } catch(e) { files = []; }
  if (!Array.isArray(files) || !files.length)
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'files[] required' }) };
  if (files.length > MAX_FILES)
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'max 60 files per call' }) };

  const t0 = Date.now();
  try {
    const tok     = await getAppToken();
    const driveId = await getDriveId(tok);

    // Resolve ALL file IDs first (may need root listing — do it once)
    await Promise.all(files.map(f => getFileId(tok, driveId, f.file).catch(() => null)));

    // Read all files in parallel
    const outcomes = await Promise.all(files.map(f => readOneFile(tok, driveId, f)));

    const results = {};
    outcomes.forEach(o => { results[o.id] = o.values; });

    const ms = Date.now() - t0;
    console.log(`[bulk-read] ${files.length} files in ${ms}ms`);
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, ms, count: files.length }),
    };
  } catch (err) {
    console.error('[bulk-read]', err.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
