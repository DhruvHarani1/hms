// netlify/functions/read-excel.js
// Single-endpoint Excel reader — replaces the 5-hop client-side chain.
//
// GET /api/read-excel?file=01_Procurement_Indent.xlsx&sheet=Procurement+Indent
//
// The function caches site ID, drive ID, and file IDs in module-level variables.
// These survive warm Lambda restarts (Netlify reuses instances for ~15 minutes).
// A cold start still does the resolution, but warm calls skip it entirely.
//
// Security: requires x-session-token header (MSAL access token from the portal).
// We verify the token is present and well-formed (starts with "Bearer " or is a JWT).
// We don't re-verify it against Graph to avoid an extra hop — the data is internal
// and all authenticated portal users have access to all project data.

const GRAPH   = 'https://graph.microsoft.com/v1.0';
const SP_HOST = 'floindexventures.sharepoint.com';
const SP_SITE = 'OpsPortalData';
const ALLOWED_ORIGIN = 'https://pulse-aigengineering.netlify.app';

// ── Module-level cache (survives warm function restarts) ─────────────────────
const CACHE = {
  appToken:   null,
  tokenExpiry: 0,
  siteId:     null,
  driveId:    null,
  fileIds:    {},   // filename → fileId
  fileNames:  null, // all filenames in root (for fuzzy match)
};

// ── App token (client credentials) ───────────────────────────────────────────
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
  CACHE.appToken   = d.access_token;
  CACHE.tokenExpiry = now + (d.expires_in || 3600) * 1000;
  return CACHE.appToken;
}

// ── Site + drive ID (cached forever in this Lambda instance) ─────────────────
async function getDriveId(tok) {
  if (CACHE.driveId) return CACHE.driveId;
  const sr = await fetch(`${GRAPH}/sites/${SP_HOST}:/sites/${SP_SITE}`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!sr.ok) throw new Error('Site lookup failed: ' + sr.status);
  CACHE.siteId = (await sr.json()).id;
  const dr = await fetch(`${GRAPH}/sites/${CACHE.siteId}/drive`,
    { headers: { Authorization: `Bearer ${tok}` } });
  if (!dr.ok) throw new Error('Drive lookup failed: ' + dr.status);
  CACHE.driveId = (await dr.json()).id;
  return CACHE.driveId;
}

// ── File ID resolution with fuzzy match + caching ────────────────────────────
function normalise(name) {
  return name.toLowerCase().replace(/[\s\-_.]+/g, '').replace(/\.xlsx$/i, '');
}

async function getFileId(tok, driveId, filename) {
  if (CACHE.fileIds[filename]) return CACHE.fileIds[filename];

  // Try exact path first (fast)
  const exact = await fetch(
    `${GRAPH}/drives/${driveId}/root:/${encodeURIComponent(filename)}?$select=id,name`,
    { headers: { Authorization: `Bearer ${tok}` } }
  );
  if (exact.ok) {
    const d = await exact.json();
    CACHE.fileIds[filename] = d.id;
    return d.id;
  }

  // Fuzzy: list root once, cache the listing
  if (!CACHE.fileNames) {
    const list = await fetch(
      `${GRAPH}/drives/${driveId}/root/children?$select=id,name&$top=300`,
      { headers: { Authorization: `Bearer ${tok}` } }
    );
    if (!list.ok) throw new Error('Cannot list drive root: ' + list.status);
    CACHE.fileNames = (await list.json()).value || [];
  }
  const target = normalise(filename);
  const match  = CACHE.fileNames.find(f => normalise(f.name) === target);
  if (!match) throw new Error(`File not found: "${filename}"`);
  CACHE.fileIds[filename] = match.id;
  console.log(`[read-excel] Fuzzy matched "${filename}" → "${match.name}"`);
  return match.id;
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-session-token',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET')     return { statusCode: 405, headers: cors, body: 'GET only' };

  // Require MSAL JWT token (sent by portal after login)
  // JWT format: three base64 segments separated by dots, starts with eyJ
  const sessionToken = event.headers['x-session-token'] || event.headers['X-Session-Token'] || '';
  const isJWT = sessionToken && sessionToken.startsWith('ey') && sessionToken.split('.').length === 3;
  if (!isJWT) {
    console.warn('[read-excel] 401 — token missing or not a JWT. Received length:', sessionToken.length);
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Valid MSAL token required' }) };
  }

  const { file, sheet } = event.queryStringParameters || {};
  if (!file) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'file param required' }) };
  const sheetName = sheet || 'Sheet1';

  const t0 = Date.now();
  try {
    const tok     = await getAppToken();
    const driveId = await getDriveId(tok);
    const fileId  = await getFileId(tok, driveId, file);

    // Read usedRange — single Graph call, all columns + rows
    const url = `${GRAPH}/drives/${driveId}/items/${fileId}/workbook/worksheets`
              + `('${encodeURIComponent(sheetName)}')/usedRange?$select=values`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${tok}`, 'Cache-Control': 'no-cache' }
    });

    if (!r.ok) {
      // Sheet might be named differently — try first available sheet
      if (r.status === 404 || r.status === 400) {
        const sheetsR = await fetch(
          `${GRAPH}/drives/${driveId}/items/${fileId}/workbook/worksheets?$select=name`,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        if (sheetsR.ok) {
          const sheets = (await sheetsR.json()).value || [];
          const firstSheet = sheets[0]?.name;
          if (firstSheet && firstSheet !== sheetName) {
            const r2 = await fetch(
              `${GRAPH}/drives/${driveId}/items/${fileId}/workbook/worksheets`
              + `('${encodeURIComponent(firstSheet)}')/usedRange?$select=values`,
              { headers: { Authorization: `Bearer ${tok}`, 'Cache-Control': 'no-cache' } }
            );
            if (r2.ok) {
              const d2 = await r2.json();
              console.log(`[read-excel] ${file} sheet "${sheetName}" not found, used "${firstSheet}" (${Date.now()-t0}ms)`);
              return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: d2.values || [], file, sheet: firstSheet, ms: Date.now()-t0 }) };
            }
          }
        }
      }
      throw new Error(`usedRange failed: ${r.status} for sheet "${sheetName}"`);
    }

    const data = await r.json();
    const ms = Date.now() - t0;
    console.log(`[read-excel] ${file}/${sheetName}: ${(data.values||[]).length} rows in ${ms}ms`);
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: data.values || [], file, sheet: sheetName, ms })
    };
  } catch (err) {
    console.error('[read-excel]', err.message);
    return { statusCode: 500, headers: cors,
      body: JSON.stringify({ error: err.message, file, sheet: sheetName }) };
  }
};
