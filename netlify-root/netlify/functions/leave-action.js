// netlify/functions/leave-action.js
// Handles approve/reject clicks from leave request emails.
// GET /api/leave-action?ref=LR-xxx&action=approve|reject&token=HMAC&remarks=...

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SP_HOST    = 'floindexventures.sharepoint.com';
const SP_SITE    = 'OpsPortalData';
const LEAVE_FILE = '07_Leave_Requests.xlsx';
const LEAVE_SHEET= 'Leave Requests';

// ── App token ─────────────────────────────────────────────────────────────────
async function getAppToken() {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' }) }
  );
  if (!res.ok) throw new Error(`Token failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

// ── HMAC token: ref|action signed with client secret ─────────────────────────
async function postTeams(title, facts, color, tag) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) return;
  const body = [];
  const label = (tag ? tag + ' — ' : '') + title;
  body.push({ type:'TextBlock', text:label, weight:'Bolder', size:'Medium', wrap:true,
    color: color==='good'?'Good':color==='attention'?'Attention':'Default' });
  if (facts&&facts.length) body.push({ type:'FactSet', facts:facts.map(([t,v])=>({title:t,value:String(v)})) });
  const actions = [{ type:'Action.OpenUrl', title:'Open Pulse', url:'https://pulse-aigengineering.netlify.app' }];
  await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ type:'message', attachments:[{ contentType:'application/vnd.microsoft.card.adaptive',
      content:{ '$schema':'http://adaptivecards.io/schemas/adaptive-card.json', type:'AdaptiveCard', version:'1.4', body, actions }
    }]})
  }).catch(e=>console.warn('[Teams leave]',e.message));
}

function makeToken(ref, action) {
  // Must match portal's makeLeaveToken: btoa(TENANT_ID + ref + '|' + action).slice(0,20)
  const secret = process.env.MS_TENANT_ID || 'x';
  const payload = `${ref}|${action}`;
  return Buffer.from(secret + payload).toString('base64').slice(0, 20);
}
function verifyToken(ref, action, token) {
  return makeToken(ref, action) === token;
}

// ── SharePoint helpers ────────────────────────────────────────────────────────
async function getSiteAndDriveId(token) {
  const s = await fetch(`${GRAPH_BASE}/sites/${SP_HOST}:/sites/${SP_SITE}`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  if (!s.ok) throw new Error('Cannot get site');
  const siteId = (await s.json()).id;
  const d = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  if (!d.ok) throw new Error('Cannot get drive');
  return { siteId, driveId: (await d.json()).id };
}

async function getFileId(token, driveId) {
  const res = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/root:/${encodeURIComponent(LEAVE_FILE)}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`File not found: ${LEAVE_FILE}`);
  return (await res.json()).id;
}

async function findAndUpdateLeaveRow(token, driveId, fileId, ref, status, approverName, remarks, empHint) {
  // Read used range to find the row
  const wsUrl = `${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(LEAVE_SHEET)}')`;
  const rangeRes = await fetch(`${wsUrl}/usedRange?$select=values`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!rangeRes.ok) throw new Error('Cannot read leave sheet');
  const values = (await rangeRes.json()).values || [];

  // Col indices: 0=Ref, 3=Employee email, 10=Status, 11=Approved By, 12=Remarks
  // Legacy refs came from a 900-value random pool and could collide, so matching
  // on the reference alone could update a different employee's row (and email
  // that employee's details to the wrong person). Disambiguate by the employee
  // hint when present, then prefer the row still awaiting a decision.
  const hits = [];
  for (let i = 1; i < values.length; i++) {
    if (((values[i] || [])[0] || '').toString().trim() === ref) hits.push(i);
  }
  if (!hits.length) throw new Error(`Leave ref ${ref} not found`);
  let rowIdx;
  if (hits.length === 1) rowIdx = hits[0];
  else {
    const em = (empHint || '').toString().trim().toLowerCase();
    const byEmail = hits.filter(i => ((values[i] || [])[3] || '').toString().trim().toLowerCase() === em);
    const pool = byEmail.length ? byEmail : hits;
    const pending = pool.filter(i => (((values[i] || [])[10] || 'Pending').toString().trim()) === 'Pending');
    rowIdx = pending.length ? pending[0] : pool[0];
    console.warn(`[leave-action] duplicate ref ${ref}: ${hits.length} rows, using excel row ${rowIdx + 1}`);
  }

  const excelRow = rowIdx + 1; // 1-indexed

  // Patch Status (col K=11), Approved By (col L=12), Remarks (col M=13)
  const patchRes = await fetch(`${wsUrl}/range(address='K${excelRow}:M${excelRow}')`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[status, approverName, remarks]] })
  });
  if (!patchRes.ok) {
    const err = await patchRes.json().catch(() => ({}));
    throw new Error(`Update failed: ${err?.error?.message || patchRes.status}`);
  }

  // Return the leave row data for the notification email
  return values[rowIdx];
}

async function sendMail(token, from, to, subject, bodyHtml) {
  const sender = process.env.REMINDER_FROM_EMAIL;
  if (!sender) { console.warn('[sendMail] REMINDER_FROM_EMAIL not set'); return; }
  if(!/\bPulse\b/i.test(subject)) subject = '[Pulse] ' + subject;
  const ccList = ['ashwinig@floindexventures.com','sharanappa.a@aigengineering.in','vanditm@floindexventures.com','dhruv.h@floindexventures.com'].filter(e => e.toLowerCase() !== (to||'').toLowerCase());
  const msg = {
    subject, body: { contentType: 'HTML', content: bodyHtml },
    toRecipients: [{ emailAddress: { address: to } }],
    from: { emailAddress: { address: sender } }
  };
  if (ccList.length) msg.ccRecipients = ccList.map(e => ({ emailAddress: { address: e } }));
  const res = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg })
  });
  if (!res.ok && res.status !== 202) {
    const err = await res.text().catch(() => res.status);
    console.error(`[sendMail] Failed to ${to}: ${res.status} — ${err}`);
  }
}

// ── HTML response pages ───────────────────────────────────────────────────────
function page(icon, title, subtitle, color) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#F0F2F5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;padding:40px 36px;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.icon{font-size:52px;margin-bottom:16px}.title{font-size:22px;font-weight:600;color:#0C1A2E;margin-bottom:8px}
.sub{font-size:14px;color:#888;line-height:1.6;margin-bottom:24px}
.btn{display:inline-block;padding:10px 24px;background:#185FA5;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500}</style></head>
<body><div class="card"><div class="icon">${icon}</div><div class="title" style="color:${color}">${title}</div>
<div class="sub">${subtitle}</div>
<a class="btn" href="https://pulse-aigengineering.netlify.app">Back to Portal</a></div></body></html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const { ref, action, token, approver_name, approver_email, remarks: queryRemarks, emp } = event.queryStringParameters || {};

  if (!ref || !action || !token) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' },
      body: page('⚠️', 'Invalid Link', 'This approval link is missing required parameters.', '#E65100') };
  }

  if (!['approve', 'reject'].includes(action)) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' },
      body: page('⚠️', 'Invalid Action', 'Action must be approve or reject.', '#E65100') };
  }

  if (!verifyToken(ref, action, token)) {
    return { statusCode: 403, headers: { 'Content-Type': 'text/html' },
      body: page('🔒', 'Link Expired or Invalid', 'This approval link is not valid. Please contact HR if you need to take action on this leave request.', '#C62828') };
  }

  try {
    const appToken = await getAppToken();
    const { driveId } = await getSiteAndDriveId(appToken);
    const fileId = await getFileId(appToken, driveId);

    const status = action === 'approve' ? 'Approved' : 'Rejected';
    const approverDisplay = approver_name ? decodeURIComponent(approver_name) : 'Manager';
    const remarks = queryRemarks ? decodeURIComponent(queryRemarks) : '';

    const leaveRow = await findAndUpdateLeaveRow(
      appToken, driveId, fileId, ref, status, approverDisplay, remarks, emp
    );

    // leaveRow cols: Ref, Timestamp, Employee Name, Email, Dept, LeaveType, From, To, Days, Reason, Status, ApprovedBy, Remarks
    const empName  = leaveRow[2] || '';
    const empEmail = leaveRow[3] || '';
    const leaveType= leaveRow[5] || '';
    const fromDate = leaveRow[6] || '';
    const toDate   = leaveRow[7] || '';
    const days     = leaveRow[8] || '';

    const isApproved = action === 'approve';
    const statusColor = isApproved ? '#0F6E56' : '#C62828';
    const statusBg    = isApproved ? '#E1F5EE'  : '#FFEBEE';

    // Notify employee
    if (empEmail) {
      await sendMail(appToken, approver_email ? decodeURIComponent(approver_email) : null, empEmail,
        `Leave Request ${status} — ${ref}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px">
          <div style="background:${statusColor};padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0;font-size:16px">Leave Request ${status}</h2>
            <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px">Ref: ${ref}</p>
          </div>
          <div style="background:#fff;padding:20px 24px;border:1px solid #eee;border-top:none">
            <p style="font-size:14px;color:#333;margin:0 0 16px">Dear ${empName},</p>
            <p style="font-size:14px;color:#333;margin:0 0 20px">
              Your leave request has been <strong style="color:${statusColor}">${status.toLowerCase()}</strong> by ${approverDisplay}.
            </p>
            <table style="width:100%;border-collapse:collapse;background:${statusBg};border-radius:8px;padding:16px">
              <tr><td style="padding:6px 12px;color:#555;font-size:13px;width:120px">Leave type</td><td style="padding:6px 12px;font-size:13px;font-weight:500">${leaveType}</td></tr>
              <tr><td style="padding:6px 12px;color:#555;font-size:13px">From</td><td style="padding:6px 12px;font-size:13px">${fromDate}</td></tr>
              <tr><td style="padding:6px 12px;color:#555;font-size:13px">To</td><td style="padding:6px 12px;font-size:13px">${toDate}</td></tr>
              <tr><td style="padding:6px 12px;color:#555;font-size:13px">Days</td><td style="padding:6px 12px;font-size:13px;font-weight:500">${days}</td></tr>
              ${remarks ? `<tr><td style="padding:6px 12px;color:#555;font-size:13px">Remarks</td><td style="padding:6px 12px;font-size:13px">${remarks}</td></tr>` : ''}
            </table>
            <p style="margin:20px 0 0;font-size:11px;color:#aaa">AIG Engineering Pulse · Automated notification</p>
          </div>
        </div>`
      );
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: page(
        isApproved ? '✅' : '❌',
        `Leave ${status}`,
        `You have <strong>${status.toLowerCase()}</strong> the leave request <strong>${ref}</strong> for <strong>${empName}</strong> (${leaveType}, ${days} day(s) from ${fromDate} to ${toDate}).<br><br>The employee has been notified by email.`,
        statusColor
      )
    };

  } catch (err) {
    console.error('[leave-action]', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: page('⚠️', 'Something went wrong', `Could not process this request: ${err.message}. Please update the leave status directly in SharePoint.`, '#C62828')
    };
  }
};
