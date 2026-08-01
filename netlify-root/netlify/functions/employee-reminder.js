// netlify/functions/employee-reminder.js
// Scheduled:
//   7:00 AM IST = 01:30 UTC → remind employees who haven't checked in
//   7:30 PM IST = 14:00 UTC → remind employees who haven't checked out

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const APP_TOKEN_CACHE = { token: null, expiry: 0 };

async function getAppToken() {
  const now = Date.now();
  if (APP_TOKEN_CACHE.token && APP_TOKEN_CACHE.expiry > now + 60000) return APP_TOKEN_CACHE.token;
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' }) }
  );
  if (!res.ok) throw new Error(`App token failed: ${await res.text()}`);
  const d = await res.json();
  APP_TOKEN_CACHE.token = d.access_token;
  APP_TOKEN_CACHE.expiry = now + (d.expires_in || 3600) * 1000;
  return APP_TOKEN_CACHE.token;
}

async function getSPDriveId(token) {
  const site = await fetch(
    `${GRAPH_BASE}/sites/floindexventures.sharepoint.com:/sites/OpsPortalData`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!site.ok) throw new Error('Cannot get site');
  const siteId = (await site.json()).id;
  const drive = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  if (!drive.ok) throw new Error('Cannot get drive');
  return (await drive.json()).id;
}

async function findFile(token, driveId, filename) {
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name&$top=200`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const items = (await res.json()).value || [];
  const norm = s => s.toLowerCase().replace(/[\s\-_]+/g, '');
  const target = norm(filename.replace(/\.xlsx$/i, ''));
  const match = items.find(f => norm((f.name||'').replace(/\.xlsx$/i,'')) === target);
  return match ? match.id : null;
}

async function readSheet(token, driveId, fileId, sheet) {
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(sheet)}')/usedRange`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  return ((await res.json()).values || []).slice(1);
}

async function sendEmail(token, toEmail, subject, bodyHtml) {
  const NOTIFY_FROM = (process.env.NOTIFY_EMAILS || '').split(',')[0].trim()
    || 'vanditm@floindexventures.com';
  for (const sender of [NOTIFY_FROM, toEmail]) {
    try {
      const res = await fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(sender)}/sendMail`,
        { method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              subject,
              body: { contentType: 'HTML', content: bodyHtml },
              toRecipients: [{ emailAddress: { address: toEmail } }],
              ccRecipients: [{ emailAddress: { address: 'vanditm@floindexventures.com' } },
              { emailAddress: { address: 'dhruv.h@floindexventures.com' } }]
            }
          })
        }
      );
      if (res.ok || res.status === 202) { console.log(`[emp-reminder] Sent to ${toEmail}`); return true; }
    } catch(e) { continue; }
  }
  console.warn(`[emp-reminder] Failed to send to ${toEmail}`);
  return false;
}

function todayIST() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function istHourMinute() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return { hour: ist.getUTCHours(), minute: ist.getUTCMinutes() };
}

exports.handler = async () => {
  const { hour } = istHourMinute();
  const today = todayIST();

  // 01:30 UTC = 7:00 AM IST (check-in reminder)
  // 14:00 UTC = 7:30 PM IST (check-out reminder)
  const isMorning = hour === 1;
  const isEvening = hour === 14;

  console.log(`[emp-reminder] IST hour: ${hour + 5}.5, morning=${isMorning}, evening=${isEvening}, date=${today}`);

  try {
    const token   = await getAppToken();
    const driveId = await getSPDriveId(token);
    const fileId  = await findFile(token, driveId, '08_Attendance.xlsx');

    if (!fileId) { console.warn('[emp-reminder] 08_Attendance.xlsx not found'); return { statusCode: 200, body: 'File not found' }; }

    // Read today's attendance rows
    // Columns: 0=date, 1=name, 2=email, 3=dept, 4=checkin_time,
    //          5=lat, 6=lng, 7=address, 8-12=checkout fields, 13=site, 14=photo
    const rows = await readSheet(token, driveId, fileId, 'Attendance');
    const todayRows = rows.filter(r => (r[0]||'').toString().startsWith(today));

    // Build map: email → { name, checkin, checkout }
    const byEmail = {};
    for (const r of todayRows) {
      const email   = (r[2]||'').toString().toLowerCase().trim();
      const name    = (r[1]||'').toString();
      const checkin = (r[4]||'').toString().trim();
      // checkout is patched into col 8 (Check-out Time)
      const checkout = (r[8]||'').toString().trim();
      if (!email) continue;
      if (!byEmail[email]) byEmail[email] = { name, checkin:'', checkout:'' };
      if (checkin)  byEmail[email].checkin  = checkin;
      if (checkout) byEmail[email].checkout = checkout;
    }

    // Get the full expected employee list from NOTIFY_EMAILS
    const allEmails = (process.env.NOTIFY_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const results = [];

    if (isMorning) {
      // 7:00 AM — email employees who haven't checked in yet
      for (const email of allEmails) {
        const record = byEmail[email.toLowerCase()];
        if (record && record.checkin) continue; // already checked in
        const name = record?.name || email.split('@')[0];
        const subject = `[AIG Pulse] ⏰ Reminder: Please mark your check-in`;
        const body = `
<div style="font-family:Arial,sans-serif;max-width:520px">
  <div style="background:#185FA5;padding:14px 20px;border-radius:8px 8px 0 0">
    <h3 style="color:#fff;margin:0;font-size:14px">Good morning — Check-in reminder</h3>
    <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:11px">${today} · 7:00 AM</p>
  </div>
  <div style="background:#fff;border:1px solid #eee;border-top:none;padding:18px 20px;font-size:13px;color:#333">
    <p style="margin:0 0 14px">Hi${name ? ' ' + name.split(' ')[0] : ''},</p>
    <p style="margin:0 0 14px">You haven't marked your check-in for today yet. Please do so now:</p>
    <a href="https://pulse-aigengineering.netlify.app" 
       style="display:inline-block;background:#185FA5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">
      Mark Check-in →
    </a>
    <p style="margin:16px 0 0;font-size:11px;color:#888">AIG Engineering Pulse · Automated reminder</p>
  </div>
</div>`;
        const sent = await sendEmail(token, email, subject, body);
        results.push({ email, type: 'morning_checkin', sent });
      }
    }

    if (isEvening) {
      // 7:30 PM — email employees who checked in but haven't checked out
      for (const email of allEmails) {
        const record = byEmail[email.toLowerCase()];
        if (!record || !record.checkin) continue;  // didn't check in at all
        if (record.checkout) continue;              // already checked out
        const name = record.name || email.split('@')[0];
        const subject = `[AIG Pulse] ⏰ Reminder: Please mark your check-out`;
        const body = `
<div style="font-family:Arial,sans-serif;max-width:520px">
  <div style="background:#BA7517;padding:14px 20px;border-radius:8px 8px 0 0">
    <h3 style="color:#fff;margin:0;font-size:14px">End of day — Check-out reminder</h3>
    <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:11px">${today} · 7:30 PM</p>
  </div>
  <div style="background:#fff;border:1px solid #eee;border-top:none;padding:18px 20px;font-size:13px;color:#333">
    <p style="margin:0 0 14px">Hi${name ? ' ' + name.split(' ')[0] : ''},</p>
    <p style="margin:0 0 14px">You checked in today at <b>${record.checkin.slice(11,16)||'—'}</b> but haven't marked your check-out yet. Please mark it before you leave:</p>
    <a href="https://pulse-aigengineering.netlify.app" 
       style="display:inline-block;background:#BA7517;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">
      Mark Check-out →
    </a>
    <p style="margin:16px 0 0;font-size:11px;color:#888">AIG Engineering Pulse · Automated reminder</p>
  </div>
</div>`;
        const sent = await sendEmail(token, email, subject, body);
        results.push({ email, type: 'evening_checkout', sent });
      }
    }

    console.log(`[emp-reminder] Done. Results: ${JSON.stringify(results)}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, date: today, hour, results }) };

  } catch(err) {
    console.error('[emp-reminder]', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
