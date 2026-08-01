// netlify/functions/bill-reminder.js
// Scheduled at 5:30 PM IST (12:00 UTC) on working days
// Checks which sites have submitted bills today vs which had activity (DPR/attendance)
// Sends a Teams reminder to site managers who haven't uploaded any bills for the day

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SP_HOST    = 'floindexventures.sharepoint.com';
const SP_SITE    = 'OpsPortalData';
const BASE_URL   = 'https://pulse-aigengineering.netlify.app';

// Site → manager(s) who should be reminded
const SITE_MANAGERS = {
  'KG':  [{ name: 'Pradeep', email: 'pradeepk@floindexventures.com' }],
  'KNP': [{ name: 'Amit',    email: 'amit@aigengineering.in' },
          { name: 'Manoj F', email: 'manojf@aigengineering.in' }],
  'CHP': [{ name: 'Amit',    email: 'amit@aigengineering.in' },
          { name: 'Manoj F', email: 'manojf@aigengineering.in' }],
  'MGI': [{ name: 'Amit',    email: 'amit@aigengineering.in' },
          { name: 'Manoj F', email: 'manojf@aigengineering.in' }],
  'HRH': [{ name: 'Amit',    email: 'amit@aigengineering.in' },
          { name: 'Manoj F', email: 'manojf@aigengineering.in' }],
  'UND': [{ name: 'Basha',   email: 'basha@aigengineering.in' },
          { name: 'Razak',   email: 'abdul.razak@aigengineering.in' }],
  'HNL': [{ name: 'Basha',   email: 'basha@aigengineering.in' },
          { name: 'Razak',   email: 'abdul.razak@aigengineering.in' }],
  'Ballari':      [{ name: 'Manjunath K',  email: 'manjunathak@aigengineering.in' }],
  'KMERC':        [{ name: 'Nitin Lobo',   email: 'nithin.lobo@aigengineering.in' }],
  'Chamrajnagar': [{ name: 'Basha',        email: 'basha@aigengineering.in' }],
  'Regional Office': [{ name: 'Kaushik Shetty', email: 'kaushik@aigengineering.in' }],
};

// Also CC Manoj and Ashwini on the reminder

async function getAppToken() {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const r = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' }) }
  );
  if (!r.ok) throw new Error(`Token failed: ${await r.text()}`);
  return (await r.json()).access_token;
}

async function getDriveId(token) {
  const sr = await fetch(`${GRAPH_BASE}/sites/${SP_HOST}:/sites/${SP_SITE}`,
    { headers: { Authorization: `Bearer ${token}` } });
  const siteId = (await sr.json()).id;
  const dr = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive`,
    { headers: { Authorization: `Bearer ${token}` } });
  return (await dr.json()).id;
}

async function findFile(token, driveId, filename) {
  const r = await fetch(`${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name&$top=300`,
    { headers: { Authorization: `Bearer ${token}` } });
  const items = (await r.json()).value || [];
  const norm = s => s.toLowerCase().replace(/[\s\-_.]+/g, '').replace(/\.xlsx$/i, '');
  const target = norm(filename);
  const match = items.find(f => norm(f.name || '') === target);
  return match ? match.id : null;
}

async function readSheet(token, driveId, fileId, sheet) {
  const r = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(sheet)}')/usedRange?$select=values`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return [];
  return ((await r.json()).values) || [];
}

async function postTeamsReminder(webhookUrl, site, managers, todayBillCount, todayStr) {
  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard', version: '1.4',
        body: [
          {
            type: 'ColumnSet',
            columns: [
              { type: 'Column', width: 'auto', items: [{
                  type: 'TextBlock', text: '📄 Bill Reminder', size: 'Small',
                  weight: 'Bolder', color: 'Warning'
              }]},
              { type: 'Column', width: 'stretch', items: [{
                  type: 'TextBlock',
                  text: `${site} — bills / receipts for ${todayStr}`,
                  weight: 'Bolder', size: 'Medium', wrap: true
              }]}
            ]
          },
          {
            type: 'TextBlock',
            text: `Hi ${managers.map(m => m.name).join(' & ')} — ` + (todayBillCount === 0
              ? `no bills or receipts have been uploaded for ${site} today. Please upload all vendor bills, material receipts and delivery challans before EOD.`
              : `only ${todayBillCount} bill${todayBillCount > 1 ? 's' : ''} uploaded so far for ${site}. If there are additional receipts, please upload them before end of day.`),
            wrap: true, color: todayBillCount === 0 ? 'Attention' : 'Warning'
          },
          {
            type: 'FactSet',
            facts: [
              { title: 'Site',      value: site },
              { title: 'Date',      value: todayStr },
              { title: 'Uploaded',  value: `${todayBillCount} bill${todayBillCount > 1 ? 's' : ''}` },
              { title: 'Action',    value: 'Upload via Pulse portal → Bill / Receipt' }
            ]
          }
        ],
        actions: [
          { type: 'Action.OpenUrl', title: '📎  Upload bill in Pulse', url: `${BASE_URL}` }
        ]
      }
    }]
  };

  const r = await fetch(webhookUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card)
  });
  return r.ok;
}

function normDate(v) {
  if (!v) return '';
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().split('T')[0];
  return String(v).split('T')[0].trim();
}

exports.handler = async () => {
  const now = new Date();
  // Skip weekends
  if (now.getUTCDay() === 0 || now.getUTCDay() === 6) {
    console.log('[bill-reminder] Weekend — skipping');
    return { statusCode: 200, body: 'weekend' };
  }

  const todayStr = now.toISOString().split('T')[0];
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

  console.log(`[bill-reminder] Running for ${todayStr}`);

  try {
    const token   = await getAppToken();
    const driveId = await getDriveId(token);

    // ── 1. Read today's bills ─────────────────────────────────────────────────
    const billFileId = await findFile(token, driveId, '13_Bill_Receipts.xlsx');
    const billRows   = billFileId ? await readSheet(token, driveId, billFileId, 'Bills') : [];

    // Count bills per site today
    const billsBySite = {};
    billRows.slice(1).forEach(r => {
      const d    = normDate(r[5] || r[1]);  // col 5 = date entered, col 1 = timestamp
      const site = String(r[4] || '').trim().toUpperCase().split(' ')[0];
      if (d !== todayStr || !site) return;
      billsBySite[site] = (billsBySite[site] || 0) + 1;
    });

    // ── 2. Read today's DPR — sites that had work today ───────────────────────
    // Only remind sites that actually had DPR activity (confirms site was active)
    const DPR_FILES = [
      { file: 'dpr_KG_civil.xlsx',          sheet: 'KG', site: 'KG' },
      { file: 'dpr_Kankapura_civil.xlsx',    sheet: 'Kankapura', site: 'KNP' },
      { file: 'dpr_Undwadi_civil.xlsx',      sheet: 'Undwadi', site: 'UND' },
      { file: 'dpr_Channapatna_civil.xlsx',  sheet: 'Channapatna', site: 'HNL' },
    ];

    const activeSites = new Set();
    await Promise.allSettled(DPR_FILES.map(async ({ file, sheet, site }) => {
      try {
        const fid = await findFile(token, driveId, file);
        if (!fid) return;
        const rows = await readSheet(token, driveId, fid, sheet);
        const hasToday = rows.slice(1).some(r => normDate(r[5]) === todayStr || normDate(r[1]) === todayStr);
        if (hasToday) activeSites.add(site);
      } catch (e) { console.warn('[bill-reminder] DPR check failed:', file, e.message); }
    }));

    // Also check attendance for all 7 sites
    const attFileId = await findFile(token, driveId, '08_Attendance.xlsx');
    if (attFileId) {
      const attRows = await readSheet(token, driveId, attFileId, 'Attendance');
      attRows.slice(1).forEach(r => {
        const o = /^AT-/.test(String(r[0] || '')) ? 1 : 0;
        const d = normDate(r[o]);
        if (d !== todayStr) return;
        const site = String(r[o + 13] || '').trim().toUpperCase();
        if (site) activeSites.add(site);
      });
    }

    console.log(`[bill-reminder] Active sites today: ${[...activeSites].join(', ')}`);
    console.log(`[bill-reminder] Bills by site:`, billsBySite);

    if (!activeSites.size) {
      console.log('[bill-reminder] No active sites found — skipping reminders');
      return { statusCode: 200, body: 'no active sites' };
    }

    // ── 3. Send reminders for active sites with missing/low bill count ────────
    const remindSites = [...activeSites].filter(site => {
      const count = billsBySite[site] || 0;
      return count === 0; // Only remind if NO bills uploaded today
    });

    console.log(`[bill-reminder] Sites needing reminder: ${remindSites.join(', ')}`);

    const results = [];
    for (const site of remindSites) {
      const managers = SITE_MANAGERS[site] || [];
      if (!managers.length) continue;

      const billCount = billsBySite[site] || 0;
      const toEmails = managers.map(m => m.email);

      // Teams notification (single channel)
      if (webhookUrl) {
        await postTeamsReminder(webhookUrl, site, managers, billCount, todayStr);
      }

      results.push({ site, sent: true, to: toEmails });
    }

    const summary = `Reminded ${remindSites.length} site(s): ${remindSites.join(', ')}. Active: ${[...activeSites].join(', ')}`;
    console.log('[bill-reminder]', summary);
    return { statusCode: 200, body: JSON.stringify({ summary, results }) };

  } catch (e) {
    console.error('[bill-reminder] Fatal:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
