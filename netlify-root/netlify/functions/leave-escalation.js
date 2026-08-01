// netlify/functions/leave-escalation.js
// Scheduled every 6 hours. Finds leave requests pending > 48h and escalates
// to the manager's manager, then marks them so they aren't re-escalated.

const GRAPH_BASE  = 'https://graph.microsoft.com/v1.0';
const SP_HOST     = 'floindexventures.sharepoint.com';
const SP_SITE     = 'OpsPortalData';
const LEAVE_FILE  = '07_Leave_Requests.xlsx';
const LEAVE_SHEET = 'Leave Requests';
const PORTAL_URL  = 'https://pulse-aigengineering.netlify.app/api';
const ESCALATION_HOURS = 48;

// ── Manager hierarchy — mirrors MANAGER_HIERARCHY in the portal ───────────────
const MANAGER_HIERARCHY = {
  'basha@aigengineering.in':          'vanditm@floindexventures.com',
  'amit@aigengineering.in':           'vanditm@floindexventures.com',
  'abdul.razak@aigengineering.in':    'vanditm@floindexventures.com',
  'pradeepk@floindexventures.com':    'vanditm@floindexventures.com',
  'hemanthbp@aigengineering.in':      'vanditm@floindexventures.com',
  'manojf@aigengineering.in':         'vanditm@floindexventures.com',
  'Manjunathak@aigengineering.in':    'vanditm@floindexventures.com',
  'vanditm@floindexventures.com':     null,
  'ashwinig@floindexventures.com':    'vanditm@floindexventures.com',
};

const MANAGER_NAMES = {
  'vanditm@floindexventures.com':     'Vandit M',
  'ashwinig@floindexventures.com':    'Ashwini G',
  'Manjunathak@aigengineering.in':    'Manju',
  'basha@aigengineering.in':          'Basha',
  'amit@aigengineering.in':           'Amit',
  'abdul.razak@aigengineering.in':    'Razak',
  'pradeepk@floindexventures.com':    'Pradeep',
  'hemanthbp@aigengineering.in':      'Hemanth',
  'manojf@aigengineering.in':         'Manoj F',
};

// ── Token signing (must match leave-action.js and portal makeLeaveToken) ─────
function makeToken(ref, action) {
  const secret = process.env.MS_TENANT_ID || 'x';
  return Buffer.from(secret + `${ref}|${action}`).toString('base64').slice(0, 20);
}

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

async function getSheetValues(token) {
  const site = await fetch(`${GRAPH_BASE}/sites/${SP_HOST}:/sites/${SP_SITE}`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  const siteId = (await site.json()).id;
  const drive = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  const driveId = (await drive.json()).id;
  const file = await fetch(`${GRAPH_BASE}/drives/${driveId}/root:/${encodeURIComponent(LEAVE_FILE)}`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  const fileId = (await file.json()).id;

  const wsUrl = `${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(LEAVE_SHEET)}')`;
  const rangeRes = await fetch(`${wsUrl}/usedRange?$select=values`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  const values = (await rangeRes.json()).values || [];
  return { driveId, fileId, wsUrl, values };
}

async function patchRow(token, wsUrl, excelRowNum, status, approvedBy, remarks) {
  // Patch cols K(11)=Status, L(12)=ApprovedBy, M(13)=Remarks  (1-indexed cols)
  await fetch(`${wsUrl}/range(address='K${excelRowNum}:M${excelRowNum}')`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[status, approvedBy, remarks]] })
  });
}

async function sendMail(token, toEmail, subject, bodyHtml) {
  const sender = process.env.REMINDER_FROM_EMAIL;
  if (!sender) {
    console.warn('[sendMail] REMINDER_FROM_EMAIL env var not set — cannot send mail');
    return false;
  }
  if(!/\bPulse\b/i.test(subject)) subject = '[Pulse] ' + subject;
  // All HR-related notifications (leave escalations included) CC these
  const HR_NOTIFY_CC = ['ashwinig@floindexventures.com','sharanappa.a@aigengineering.in','vanditm@floindexventures.com']
    .filter(e => e.toLowerCase() !== (toEmail||'').toLowerCase());
  try {
    const msg = {
      subject, body: { contentType: 'HTML', content: bodyHtml },
      toRecipients: [{ emailAddress: { address: toEmail } }],
      from: { emailAddress: { address: sender } }
    };
    if (HR_NOTIFY_CC.length) msg.ccRecipients = HR_NOTIFY_CC.map(e => ({ emailAddress: { address: e } }));
    const res = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(sender)}/sendMail`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    if (res.ok || res.status === 202) return true;
    const err = await res.text().catch(() => res.status);
    console.error(`[sendMail] Failed to ${toEmail}: ${res.status} — ${err}`);
    return false;
  } catch(e) {
    console.error('[sendMail] Exception:', e.message);
    return false;
  }
  return false;
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async () => {
  console.log('[leave-escalation] Running...');
  try {
    const token = await getAppToken();
    const { wsUrl, values } = await getSheetValues(token);

    const now = Date.now();
    const CUTOFF_MS = ESCALATION_HOURS * 60 * 60 * 1000;
    let escalated = 0, skipped = 0;

    // Schema: Ref(0), Timestamp(1), EmpName(2), EmpEmail(3), Dept(4), LeaveType(5),
    //         From(6), To(7), Days(8), Reason(9), Status(10), ApprovedBy(11), Remarks(12)
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row || !row[0]) continue;

      const ref        = (row[0] || '').toString().trim();
      const timestamp  = (row[1] || '').toString().trim();
      const empName    = (row[2] || '').toString().trim();
      const empEmail   = (row[3] || '').toString().trim();
      const dept       = (row[4] || '').toString().trim();
      const leaveType  = (row[5] || '').toString().trim();
      const fromDate   = (row[6] || '').toString().trim();
      const toDate     = (row[7] || '').toString().trim();
      const days       = (row[8] || '').toString().trim();
      const reason     = (row[9] || '').toString().trim();
      const status     = (row[10] || '').toString().trim();
      const remarks    = (row[12] || '').toString().trim();

      // Only act on Pending rows not already escalated
      if (status !== 'Pending') { skipped++; continue; }
      if (remarks.startsWith('escalated:')) { skipped++; continue; }

      // Parse submission time
      const submittedAt = new Date(timestamp).getTime();
      if (isNaN(submittedAt)) { skipped++; continue; }
      const ageMs = now - submittedAt;
      if (ageMs < CUTOFF_MS) { skipped++; continue; }

      // Extract manager email from remarks field: "mgr:email@company.com"
      const mgrMatch = remarks.match(/^mgr:(.+)$/);
      const mgrEmail = mgrMatch ? mgrMatch[1].trim().toLowerCase() : null;
      if (!mgrEmail) { skipped++; continue; }

      // Find escalation target
      const escalateTo = MANAGER_HIERARCHY[mgrEmail];
      if (!escalateTo) {
        console.log(`[escalation] ${ref}: ${mgrEmail} is top-level, no further escalation`);
        skipped++; continue;
      }

      const escalateToName = MANAGER_NAMES[escalateTo] || escalateTo;
      const mgrName = MANAGER_NAMES[mgrEmail] || mgrEmail;
      const hoursOverdue = Math.round(ageMs / 3600000);

      // Build approve/reject links for the escalation target
      const enc = encodeURIComponent;
      const approveUrl = `${PORTAL_URL}/leave-action?ref=${enc(ref)}&action=approve&token=${enc(makeToken(ref,'approve'))}&approver_name=${enc(escalateToName)}&approver_email=${enc(escalateTo)}`;
      const rejectUrl  = `${PORTAL_URL}/leave-action?ref=${enc(ref)}&action=reject&token=${enc(makeToken(ref,'reject'))}&approver_name=${enc(escalateToName)}&approver_email=${enc(escalateTo)}`;

      const emailBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#C45911;padding:22px 28px;border-radius:10px 10px 0 0">
    <h2 style="color:#fff;margin:0;font-size:17px">⏰ Leave Approval Escalation</h2>
    <p style="color:rgba(255,255,255,0.75);margin:5px 0 0;font-size:12px">Pending for ${hoursOverdue} hours · Ref: ${ref}</p>
  </div>
  <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
    <p style="font-size:14px;color:#374151;margin:0 0 16px">Dear ${escalateToName},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px">
      A leave request from <strong>${empName}</strong> has been pending with <strong>${mgrName}</strong> for <strong>${hoursOverdue} hours</strong> without action. It has been escalated to you.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#FFF7ED;border-radius:8px;border:1px solid #FED7AA;margin-bottom:28px">
      <tr><td style="padding:9px 16px;color:#92400E;font-size:13px;width:130px;border-bottom:1px solid #FED7AA">Employee</td><td style="padding:9px 16px;font-size:13px;font-weight:600;border-bottom:1px solid #FED7AA">${empName}<br><span style="font-weight:400;color:#6B7280;font-size:12px">${empEmail}</span></td></tr>
      <tr><td style="padding:9px 16px;color:#92400E;font-size:13px;border-bottom:1px solid #FED7AA">Department</td><td style="padding:9px 16px;font-size:13px;border-bottom:1px solid #FED7AA">${dept}</td></tr>
      <tr><td style="padding:9px 16px;color:#92400E;font-size:13px;border-bottom:1px solid #FED7AA">Leave type</td><td style="padding:9px 16px;font-size:13px;border-bottom:1px solid #FED7AA">${leaveType}</td></tr>
      <tr><td style="padding:9px 16px;color:#92400E;font-size:13px;border-bottom:1px solid #FED7AA">Dates</td><td style="padding:9px 16px;font-size:13px;font-weight:600;border-bottom:1px solid #FED7AA">${fromDate} → ${toDate} <span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:10px;font-size:11px">${days} day(s)</span></td></tr>
      <tr><td style="padding:9px 16px;color:#92400E;font-size:13px;border-bottom:1px solid #FED7AA">Pending with</td><td style="padding:9px 16px;font-size:13px;border-bottom:1px solid #FED7AA">${mgrName} (no response in ${hoursOverdue}h)</td></tr>
      <tr><td style="padding:9px 16px;color:#92400E;font-size:13px;vertical-align:top">Reason</td><td style="padding:9px 16px;font-size:13px;line-height:1.6">${reason}</td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px">
      <p style="font-size:13px;color:#374151;margin:0 0 16px;font-weight:500">Please take action:</p>
      <table style="margin:0 auto;border-collapse:collapse">
        <tr>
          <td style="padding:0 8px"><a href="${approveUrl}" style="display:inline-block;padding:14px 36px;background:#0F6E56;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">✓ Approve</a></td>
          <td style="padding:0 8px"><a href="${rejectUrl}" style="display:inline-block;padding:14px 36px;background:#C62828;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">✕ Reject</a></td>
        </tr>
      </table>
      <p style="font-size:11px;color:#9CA3AF;margin:16px 0 0">Employee will be notified automatically of your decision.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 16px">
    <p style="margin:0;font-size:11px;color:#9CA3AF">AIG Engineering Pulse · Automated escalation after ${ESCALATION_HOURS}h inactivity</p>
  </div>
</div>`;

      await sendMail(token, escalateTo,
        `[Escalated] Leave Approval Required — ${empName} (${leaveType}, ${days} day(s)) — ${hoursOverdue}h pending`,
        emailBody
      );

      // Mark row as escalated so it doesn't fire again
      const excelRow = i + 1;
      await patchRow(token, wsUrl, excelRow, 'Pending', `Escalated to ${escalateToName}`,
        `escalated:${escalateTo}|original_mgr:${mgrEmail}|at:${new Date().toISOString()}`);

      console.log(`[escalation] ${ref} escalated from ${mgrEmail} → ${escalateTo}`);
      escalated++;
    }

    console.log(`[leave-escalation] Done. Escalated: ${escalated}, Skipped: ${skipped}`);
    return { statusCode: 200, body: JSON.stringify({ escalated, skipped }) };

  } catch(err) {
    console.error('[leave-escalation]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
