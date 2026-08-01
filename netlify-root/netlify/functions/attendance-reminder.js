// netlify/functions/attendance-reminder.js
// Scheduled function — runs at 10:30 AM and 7:30 PM IST daily
// IST = UTC+5:30, so:
//   10:30 AM IST = 05:00 UTC
//   07:30 PM IST = 14:00 UTC

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Reuse app token logic from graph.js
async function getAppToken() {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' }) }
  );
  if (!res.ok) throw new Error(`App token failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function getSiteId(token) {
  const res = await fetch(
    `${GRAPH_BASE}/sites/floindexventures.sharepoint.com:/sites/OpsPortalData`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Cannot get SharePoint site');
  return (await res.json()).id;
}

async function getDriveId(token, siteId) {
  const res = await fetch(
    `${GRAPH_BASE}/sites/${siteId}/drive`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Cannot get drive');
  return (await res.json()).id;
}

async function findFile(token, driveId, filename) {
  // List root, fuzzy match
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/root/children?$select=id,name&$top=200`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const items = (await res.json()).value || [];
  const norm = s => s.toLowerCase().replace(/[\s\-_]+/g, '');
  const target = norm(filename.replace(/\.xlsx$/i, ''));
  const match = items.find(f => norm((f.name || '').replace(/\.xlsx$/i, '')) === target);
  return match ? match.id : null;
}

async function readSheet(token, driveId, fileId, sheet) {
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(sheet)}')/usedRange`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.values || []).slice(1); // skip header row
}

async function sendReminderEmail(token, toEmail, subject, bodyHtml) {
  const from = process.env.REMINDER_FROM_EMAIL || 'no-reply@aigengineering.in';
  // Try sending via /users/{from}/sendMail first, fallback to target user
  for (const sender of [from, toEmail]) {
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
      if (res.ok || res.status === 202) return true;
    } catch(e) { continue; }
  }
  return false;
}

function todayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function currentHourIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours();
}

exports.handler = async (event) => {
  console.log('[reminder] Running attendance reminder check');

  try {
    const token    = await getAppToken();
    const siteId   = await getSiteId(token);
    const driveId  = await getDriveId(token, siteId);
    const fileId   = await findFile(token, driveId, 'ContractedEmp_Attendance.xlsx');

    if (!fileId) {
      console.warn('[reminder] ContractedEmp_Attendance.xlsx not found');
      return { statusCode: 200, body: 'File not found' };
    }

    const rows  = await readSheet(token, driveId, fileId, 'Contracted Employee Attendance');
    const today = todayIST();
    const hour  = currentHourIST(); // IST hour

    // Row columns:
    // 0=Ref, 1=Date, 2=Site, 3=Contractor, 4=EmpID, 5=Name, 6=Trade,
    // 7=MarkedBy, 8=MarkedByEmail,
    // 9=CheckinTime, 10=CheckinPhoto, 11=CheckinLat, 12=CheckinLng, 13=CheckinGPS,
    // 14=CheckoutTime, 15=CheckoutPhoto, ...
    // 20=Status

    const todayRows = rows.filter(r => {
      const d = (r[1] || '').toString();
      return d.startsWith(today);
    });

    // Group by MarkedByEmail
    const byEngineer = {};
    for (const r of todayRows) {
      const email     = (r[8] || '').toString().toLowerCase().trim();
      const name      = (r[5] || '').toString();
      const checkin   = (r[9] || '').toString().trim();
      const checkout  = (r[14] || '').toString().trim();
      const site      = (r[2] || '').toString();
      const contractor= (r[3] || '').toString();
      if (!email) continue;
      if (!byEngineer[email]) byEngineer[email] = { email, site, contractor, checkedIn: [], notCheckedOut: [] };
      if (checkin) byEngineer[email].checkedIn.push(name);
      if (checkin && !checkout) byEngineer[email].notCheckedOut.push(name);
    }

    // 10:30 AM IST (hour=10) — remind engineers who have NO check-ins yet
    // 7:30 PM IST (hour=19) — remind engineers who have workers not checked out
    const isMorning = hour === 10; // ~10:30 AM window
    const isEvening = hour === 14; // ~7:30 PM IST = 14:00 UTC

    console.log(`[reminder] IST hour: ${hour}, morning: ${isMorning}, evening: ${isEvening}`);
    console.log(`[reminder] Today: ${today}, rows: ${todayRows.length}, engineers: ${Object.keys(byEngineer).length}`);

    const results = [];

    if (isEvening) {
      // Evening: email engineers with workers still checked in
      for (const [email, data] of Object.entries(byEngineer)) {
        if (!data.notCheckedOut.length) continue;
        const subject = `[AIG Pulse] ⏰ Check-out reminder — ${data.site} — ${today}`;
        const body = `
<div style="font-family:Arial,sans-serif;max-width:560px">
  <div style="background:#BA7517;padding:14px 20px;border-radius:8px 8px 0 0">
    <h3 style="color:#fff;margin:0;font-size:14px">⏰ Check-out Reminder — 7:30 PM</h3>
    <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:11px">${today} · ${data.site} · ${data.contractor}</p>
  </div>
  <div style="background:#fff;border:1px solid #eee;border-top:none;padding:16px 20px;font-size:12px">
    <p style="color:#444;margin:0 0 12px">The following contracted employees are still <b>checked in</b> and have not been checked out today:</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#333">
      ${data.notCheckedOut.map(n => `<li style="padding:3px 0">${n}</li>`).join('')}
    </ul>
    <p style="color:#444;margin:0 0 8px">Please mark their check-out in <a href="https://pulse-aigengineering.netlify.app" style="color:#185FA5">AIG Pulse</a> → Contracted Employees → Attendance.</p>
    <p style="color:#888;font-size:11px;margin:12px 0 0">This is an automated reminder from AIG Engineering Pulse.</p>
  </div>
</div>`;
        const sent = await sendReminderEmail(token, email, subject, body);
        results.push({ email, type: 'evening', workers: data.notCheckedOut.length, sent });
        console.log(`[reminder] Evening email → ${email}: ${sent ? 'sent' : 'failed'}`);
      }
    }

    if (isMorning) {
      // Morning: check Register for expected engineers and see who hasn't started yet
      // Simple approach: read Register to get all unique MarkedBy emails,
      // then email those who have NO rows at all today
      const registerId = await findFile(token, driveId, 'ContractedEmp_Register.xlsx');
      if (registerId) {
        const regRows = await readSheet(token, driveId, registerId, 'Contracted Employee Register');
        // Get unique supervisor emails from register (col 8 = phone, no supervisor email)
        // Instead: email engineers in NOTIFY_EMAILS list who have no attendance today
        const NOTIFY = (process.env.NOTIFY_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
        for (const email of NOTIFY) {
          const hasAttendance = todayRows.some(r => (r[8] || '').toString().toLowerCase() === email.toLowerCase());
          if (!hasAttendance) {
            const subject = `[AIG Pulse] 📋 Check-in reminder — ${today}`;
            const body = `
<div style="font-family:Arial,sans-serif;max-width:560px">
  <div style="background:#185FA5;padding:14px 20px;border-radius:8px 8px 0 0">
    <h3 style="color:#fff;margin:0;font-size:14px">📋 Morning Check-in Reminder — 10:30 AM</h3>
    <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:11px">${today}</p>
  </div>
  <div style="background:#fff;border:1px solid #eee;border-top:none;padding:16px 20px;font-size:12px">
    <p style="color:#444;margin:0 0 12px">You haven't marked check-in yet for your off-role and blue-collared staff today.</p>
    <p style="color:#444;margin:0 0 8px">Please mark their check-in in <a href="https://pulse-aigengineering.netlify.app" style="color:#185FA5">AIG Pulse</a> → Contracted Employees → Attendance.</p>
    <p style="color:#888;font-size:11px;margin:12px 0 0">This is an automated reminder from AIG Engineering Pulse.</p>
  </div>
</div>`;
            const sent = await sendReminderEmail(token, email, subject, body);
            results.push({ email, type: 'morning', sent });
            console.log(`[reminder] Morning email → ${email}: ${sent ? 'sent' : 'failed'}`);
          }
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, date: today, hour, results })
    };

  } catch(err) {
    console.error('[reminder] Error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
