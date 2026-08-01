// ─────────────────────────────────────────────────────────────────────────────
// STATUS WATCHER — runs every 15 minutes.
// Detects approval-status changes made DIRECTLY in the Excel sheets (outside
// the portal, e.g. someone typing "Approved" into the status column) and sends
// the notification email the portal would have sent. State is kept in the
// Supabase mirror: the watcher compares Excel's status to the mirrored status
// and, on a meaningful transition (pending -> approved/rejected), emails the
// submitter + PMC, then updates the mirror so it never emails twice.
// ─────────────────────────────────────────────────────────────────────────────
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SP_HOST    = 'floindexventures.sharepoint.com';
const SP_SITE    = 'OpsPortalData';
const SB_URL     = process.env.SUPABASE_URL || '';
const SB_KEY     = process.env.SUPABASE_SERVICE_KEY || '';
const TABLE      = 'form_rows';

const PMC_CC = ['manojf@aigengineering.in','basha@aigengineering.in','manjulab@floindex.com','anjali.d@aigengineering.in','ashwinig@floindexventures.com','vanditm@floindexventures.com','dhruv.h@floindexventures.com'];
const HR_CC  = ['ashwinig@floindexventures.com','sharanappa.a@aigengineering.in','vanditm@floindexventures.com'];

// `fields` are extra columns shown in the notification so the employee sees
// exactly what was decided, not just a bare status word.
const FORMS = [
  { id: 'procurement', file: '01_Procurement_Indent.xlsx', sheet: 'Procurement Indent', statCol: 26, emailCol: 3, nameCol: 2, label: 'Procurement Indent',
    cc: PMC_CC, fields: [['Project', 4], ['Department', 5]] },
  { id: 'payment',     file: '04_Payment_Request.xlsx',    sheet: 'Payment Request',    statCol: 23, emailCol: 3, nameCol: 2, label: 'Payment Request',
    cc: PMC_CC, fields: [['Project', 4], ['Payee', 7], ['Amount', 12]] },
  { id: 'hire',        file: '05_Hire_Indent.xlsx',        sheet: 'Hire Indent',        statCol: 20, emailCol: 3, nameCol: 2, label: 'Hire Indent',
    cc: PMC_CC, fields: [['Project', 4]] },
  // Leave: the register has a title row + blank row before the header, but the
  // loop keys off the reference cell so those rows are skipped harmlessly.
  { id: 'leave',       file: '07_Leave_Requests.xlsx',     sheet: 'Leave Requests',     statCol: 10, emailCol: 3, nameCol: 2, label: 'Leave Request',
    cc: HR_CC, fields: [['Leave type', 5], ['From', 6], ['To', 7], ['Days', 8], ['Reason', 9], ['Decided by', 11]] },
];

function classify(stat) {
  const s = String(stat || '').trim();
  if (!s || s === 'Pending') return 'pending';
  if (/^rejected/i.test(s)) return 'rejected';
  if (/^approved/i.test(s) || /stage 2|review/i.test(s)) return 'approved';
  return 'pending';
}

async function getAppToken() {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const r = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' })
  });
  if (!r.ok) throw new Error(`Token failed: ${await r.text()}`);
  return (await r.json()).access_token;
}
async function getDriveId(token) {
  const sr = await fetch(`${GRAPH_BASE}/sites/${SP_HOST}:/sites/${SP_SITE}`, { headers: { Authorization: `Bearer ${token}` } });
  const siteId = (await sr.json()).id;
  const dr = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive`, { headers: { Authorization: `Bearer ${token}` } });
  return (await dr.json()).id;
}
async function findFile(token, driveId, filename) {
  const r = await fetch(`${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name&$top=300`, { headers: { Authorization: `Bearer ${token}` } });
  const items = (await r.json()).value || [];
  const norm = s => s.toLowerCase().replace(/[\s\-_.]+/g, '').replace(/\.xlsx$/i, '');
  const match = items.find(f => norm(f.name || '') === norm(filename));
  return match ? match.id : null;
}
async function readSheet(token, driveId, fileId, sheet) {
  const r = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(sheet)}')/usedRange?$select=values`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return [];
  return ((await r.json()).values) || [];
}
async function sb(path, opts = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
}
async function mail(tok, to, subject, html, cc) {
  const from = process.env.REMINDER_FROM_EMAIL; if (!from || !to) return;
  if (!/\bPulse\b/i.test(subject)) subject = '[Pulse] ' + subject;
  const ccList = [...new Set(cc || [])].filter(e => e && e.toLowerCase() !== to.toLowerCase());
  const msg = { subject, body: { contentType: 'HTML', content: html },
    toRecipients: [{ emailAddress: { address: to } }], from: { emailAddress: { address: from } } };
  if (ccList.length) msg.ccRecipients = ccList.map(e => ({ emailAddress: { address: e } }));
  await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg })
  }).catch(e => console.error('[watcher mail]', e.message));
}

exports.handler = async () => {
  if (!SB_URL || !SB_KEY) return { statusCode: 200, body: 'no db configured' };
  try {
    const token = await getAppToken();
    const driveId = await getDriveId(token);
    let notified = 0;
    // Safety valves: a stale mirror must never trigger a burst of historical
    // notifications. Only recent rows qualify, and each run is capped.
    const MAX_PER_RUN = 25;
    const MAX_AGE_DAYS = 45;
    const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;

    for (const f of FORMS) {
      const fileId = await findFile(token, driveId, f.file);
      if (!fileId) continue;
      const values = await readSheet(token, driveId, fileId, f.sheet);
      if (values.length < 2) continue;

      // Mirror rows for this form: excel_row -> vals (status at statCol)
      const mr = await sb(`${TABLE}?form_id=eq.${f.id}&select=excel_row,vals&limit=5000`);
      if (!mr.ok) continue;
      const mirror = {};
      (await mr.json()).forEach(x => { mirror[x.excel_row] = x.vals || []; });

      // Group by ref; first row carries submitter + the transition
      const seenRef = {};
      for (let i = 1; i < values.length; i++) {
        const r = values[i] || [];
        const ref = String(r[0] || '').trim();
        // Only act on real references (skips title/blank/header rows in sheets
        // like the leave register that start below row 1).
        if (!ref || !/^[A-Z]{2,4}-\d{4}-/.test(ref) || seenRef[ref]) continue;
        seenRef[ref] = true;

        const excelState = classify(r[f.statCol]);
        const mirrored = mirror[i + 1]; // excel rows are 1-based incl header
        const mirrorState = mirrored ? classify(mirrored[f.statCol]) : null;

        // Only act when the mirror knew this row as pending and Excel now says decided
        if (mirrorState !== 'pending' || excelState === 'pending') continue;
        if (notified >= MAX_PER_RUN) { console.warn('[status-watcher] cap reached, deferring rest'); break; }
        // Skip anything old enough that a notification would be noise, not news
        const ts = Date.parse(String(r[1] || '')) || Date.parse(String(r[6] || ''));
        if (ts && ts < cutoff) continue;

        const submitter = String(r[f.emailCol] || '').trim();
        const name = String(r[f.nameCol] || '').trim();
        const statText = String(r[f.statCol] || '').trim();
        const good = excelState === 'approved';

        const detailRows = (f.fields || []).map(([lab, idx]) => {
          const v = r[idx];
          if (v === null || v === undefined || String(v).trim() === '') return '';
          return `<tr><td style="padding:6px 10px;color:#666;font-size:12px;border-bottom:1px solid #eee">${lab}</td>`
               + `<td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #eee">${String(v).trim()}</td></tr>`;
        }).join('');

        await mail(token, submitter,
          `${f.label} ${ref} — ${good ? 'Approved' : 'Rejected'}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px">
            <div style="background:${good ? '#0F6E56' : '#C62828'};padding:16px 22px;border-radius:10px 10px 0 0">
              <h3 style="color:#fff;margin:0;font-size:15px">${f.label} ${good ? 'Approved' : 'Rejected'}</h3>
              <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:12px">Ref: ${ref}${name ? ' | By: ' + name : ''}</p>
            </div>
            <div style="border:1px solid #eee;border-top:none;padding:16px 22px;border-radius:0 0 10px 10px">
              <p style="font-size:13px;color:#333;margin:0 0 12px">Your request was <b>${good ? 'approved' : 'rejected'}</b> \u2014 status: <b>${statText}</b></p>
              ${detailRows ? `<table style="width:100%;border-collapse:collapse;background:#F9FAFB;border:1px solid #E5E7EB">${detailRows}</table>` : ''}
              <p style="font-size:11px;color:#999;margin:12px 0 0">This decision was recorded directly in the register (outside the portal) and detected by AIG Engineering Pulse.</p>
            </div>
          </div>`, f.cc || PMC_CC);
        notified++;

        // Update the mirror so we never email twice for the same transition
        const vals = (mirrored || []).slice();
        while (vals.length <= f.statCol) vals.push('');
        vals[f.statCol] = statText;
        await sb(`${TABLE}?form_id=eq.${f.id}&excel_row=eq.${i + 1}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ vals })
        }).catch(() => {});
      }
    }
    return { statusCode: 200, body: `watcher done, notified ${notified}` };
  } catch (e) {
    console.error('[status-watcher]', e.message);
    return { statusCode: 200, body: 'error: ' + e.message };
  }
};
