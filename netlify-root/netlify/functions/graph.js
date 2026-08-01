// netlify/functions/graph.js
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const APP_TOKEN_CACHE = { token: null, expiry: 0 };
const USER_SESSIONS = {};

// ── App token (client credentials) ───────────────────────────────────────────
async function getAppToken() {
  const now = Date.now();
  if (APP_TOKEN_CACHE.token && APP_TOKEN_CACHE.expiry > now + 60000) return APP_TOKEN_CACHE.token;
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET)
    throw new Error('Missing env vars');
  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' }) }
  );
  if (!res.ok) { const e = await res.text(); throw new Error(`App token failed: ${e}`); }
  const data = await res.json();
  APP_TOKEN_CACHE.token = data.access_token;
  APP_TOKEN_CACHE.expiry = now + (data.expires_in || 3600) * 1000;
  return APP_TOKEN_CACHE.token;
}

// ── Validate MSAL token by calling /me ───────────────────────────────────────
async function validateMSALToken(accessToken) {
  const res = await fetch(`${GRAPH_BASE}/me?$select=displayName,id,mail,userPrincipalName`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('MSAL token invalid or expired');
  return await res.json();
}

// ── Session tokens (username encoded, stateless across cold starts) ───────────
function createSession(username, displayName, userId, accessToken) {
  const secret = process.env.MS_CLIENT_SECRET || 'x';
  const ts = Math.floor(Date.now() / 1800000);
  const payload = Buffer.from(username + '|' + ts).toString('base64url');
  const sig = Buffer.from(secret + payload).toString('base64').slice(0, 12);
  const token = payload + '.' + sig;
  USER_SESSIONS[token] = { username, displayName, userId, accessToken,
    expiry: Date.now() + 8 * 60 * 60 * 1000 };
  return token;
}

function getSession(token) {
  if (!token) return null;
  if (USER_SESSIONS[token] && USER_SESSIONS[token].expiry > Date.now())
    return USER_SESSIONS[token];
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const decoded = Buffer.from(payload, 'base64url').toString();
    const [username, tsStr] = decoded.split('|');
    if (!username || !tsStr) return null;
    const ts = parseInt(tsStr, 10);
    const now = Math.floor(Date.now() / 1800000);
    if (Math.abs(now - ts) > 16) return null;
    const secret = process.env.MS_CLIENT_SECRET || 'x';
    const expected = Buffer.from(secret + payload).toString('base64').slice(0, 12);
    if (sig !== expected) return null;
    return { username, displayName: '', userId: '', accessToken: null };
  } catch(e) { return null; }
}

// ── CORS ──────────────────────────────────────────────────────────────────────
function corsHeaders(event) {
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://pulse-aigengineering.netlify.app')
    .split(',').map(s => s.trim());
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allow  = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
    'Access-Control-Max-Age': '86400',
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const cors = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: { ...cors, 'Content-Type': 'application/json' },
             body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: { ...cors, 'Content-Type': 'application/json' },
                   body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }

  const { path, method = 'GET', data, headers: extraHeaders = {},
          isUpload, username, msalToken } = body;

  // ── Login: validate MSAL token → create server session ───────────────────
  if (path === '/_auth/login') {
    try {
      if (!msalToken) throw new Error('MSAL token required');
      const me = await validateMSALToken(msalToken);
      const email = me.userPrincipalName || me.mail || username || '';
      const domain = email.split('@')[1] || '';
      const ALLOWED = ['aigengineering.in', 'floindexventures.com', 'floindex.com'];
      if (domain && !ALLOWED.includes(domain))
        throw new Error('Access restricted to company accounts only');
      const displayName = me.displayName || email.split('@')[0];
      const sessionToken = createSession(email, displayName, me.id, msalToken);
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' },
               body: JSON.stringify({ ok: true, token: sessionToken, displayName, userId: me.id }) };
    } catch(e) {
      return { statusCode: 401, headers: { ...cors, 'Content-Type': 'application/json' },
               body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  // ── Session token refresh ─────────────────────────────────────────────────
  if (path === '/_auth/token') {
    const tok = (event.headers && event.headers['x-session-token']) || body.sessionToken;
    const s = getSession(tok);
    if (!s) return { statusCode: 401, headers: { ...cors, 'Content-Type': 'application/json' },
                     body: JSON.stringify({ ok: false }) };
    return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' },
             body: JSON.stringify({ ok: true, token: tok }) };
  }

  // ── All other routes: require session ────────────────────────────────────
  const sessionToken = (event.headers && event.headers['x-session-token']) || body.sessionToken;
  const session = getSession(sessionToken);
  if (!session) {
    return { statusCode: 401, headers: { ...cors, 'Content-Type': 'application/json' },
             body: JSON.stringify({ ok: false, error: 'Session expired. Please sign in again.' }) };
  }

  if (!path) return { statusCode: 400, headers: { ...cors, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ok: false, error: 'Missing path' }) };

  try {
    let resolvedPath = path;
    let tokenToUse;

    if (path.includes('/sendMail')) {
      // Mail sending: prefer the user's own MSAL token (delegated Mail.Send scope).
      // App token requires Application Mail.Send permission which may not be configured.
      if (session.accessToken) {
        tokenToUse = session.accessToken;
        // /me/sendMail works with delegated token — sends from the logged-in user's mailbox
        resolvedPath = '/me/sendMail';
      } else {
        // Fallback: app token — requires Application Mail.Send in Azure AD
        tokenToUse = await getAppToken();
        resolvedPath = `/users/${encodeURIComponent(session.username)}/sendMail`;
      }
    } else {
      tokenToUse = await getAppToken();
    }

    const url = resolvedPath.startsWith('https://') ? resolvedPath : `${GRAPH_BASE}${resolvedPath}`;
    const reqHeaders = { 'Authorization': `Bearer ${tokenToUse}`, ...extraHeaders };

    let reqBody;
    if (isUpload && data) {
      reqBody = Buffer.from(data, 'base64');
    } else if (data && method !== 'GET') {
      reqBody = typeof data === 'string' ? data : JSON.stringify(data);
      if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json';
    }

    const graphRes = await fetch(url, { method, headers: reqHeaders, body: reqBody });

    let responseData = null;
    if (graphRes.status !== 204 && graphRes.status !== 202) {
      const text = await graphRes.text().catch(() => '');
      if (text) {
        const ct = graphRes.headers.get('content-type') || '';
        try { responseData = ct.includes('application/json') ? JSON.parse(text) : text; }
        catch { responseData = text; }
      }
    }

    const graphError = !graphRes.ok
      ? (responseData?.error ? `${responseData.error.code}: ${responseData.error.message}` : `HTTP ${graphRes.status}`)
      : undefined;

    return {
      statusCode: graphRes.ok ? 200 : graphRes.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: graphRes.ok, status: graphRes.status,
                             data: responseData, error: graphError }),
    };
  } catch(err) {
    console.error('[graph proxy]', err.message);
    return { statusCode: 500, headers: { ...cors, 'Content-Type': 'application/json' },
             body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
