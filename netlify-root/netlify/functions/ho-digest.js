// netlify/functions/ho-digest.js
// Runs daily at 7:00 AM IST (01:30 UTC)
// Sends PERSONALIZED actionable digests — each recipient sees only their items,
// with inline Approve / Return buttons they can click without opening the portal.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SP_HOST    = 'floindexventures.sharepoint.com';
const SP_SITE    = 'OpsPortalData';
const BASE_URL   = 'https://pulse-aigengineering.netlify.app';

// Who gets what
const PERSONAS = {
  // Top-level directors — see ALL pending approvals
  'vanditm@floindexventures.com':  { name: 'Vandit',    role: 'director',  seeAll: true  },
  'ashwinig@floindexventures.com': { name: 'Ashwini',   role: 'director',  seeAll: true  },
  'sharanappa.a@aigengineering.in':{ name: 'Sharanappa',role: 'director',  seeAll: true  },
  // PMC managers — see stage-1 approvals (procurement <25k, payment, hire, leave)
  'manojf@aigengineering.in':      { name: 'Manoj F', role: 'manager',   seeAll: false },
  'basha@aigengineering.in':       { name: 'Basha',   role: 'manager',   seeAll: false },
  // Accounts — see WFR stages, bill receipts, fully-approved payments
  'banking@floindex.com':          { name: 'Accounts', role: 'accounts', seeAll: false },
  'hemanthbp@aigengineering.in':   { name: 'Hemanth', role: 'accounts',  seeAll: false },
};

// Forms with multi-stage approval (procurement/payment/hire)
const APPROVAL_FORMS = [
  { key: 'procurement_low',  file: '01_Procurement_Indent.xlsx',  label: 'Procurement (<25k)',  refCol: 0, nameCol: 2, emailCol: 3, projCol: 4, amtCol: 14, statusCol: 25,
    stage1: ['manojf@aigengineering.in','basha@aigengineering.in'],
    stage2: ['vanditm@floindexventures.com','dhruv.h@floindexventures.com'] },
  { key: 'procurement_high', file: '01_Procurement_Indent.xlsx',  label: 'Procurement (>25k)',  refCol: 0, nameCol: 2, emailCol: 3, projCol: 4, amtCol: 14, statusCol: 25,
    stage1: ['manojf@aigengineering.in','basha@aigengineering.in'],
    stage2: ['vanditm@floindexventures.com','dhruv.h@floindexventures.com'] },
  { key: 'payment',          file: '04_Payment_Request.xlsx',     label: 'Payment Request',     refCol: 0, nameCol: 2, emailCol: 3, projCol: 4, amtCol: 12, statusCol: 15,
    stage1: ['basha@aigengineering.in','manojf@aigengineering.in'],
    stage2: ['vanditm@floindexventures.com','dhruv.h@floindexventures.com'] },
  { key: 'hire',             file: '05_Hire_Indent.xlsx',         label: 'Hire Indent',         refCol: 0, nameCol: 2, emailCol: 3, projCol: 4, amtCol: 19, statusCol: 20,
    stage1: ['basha@aigengineering.in','manojf@aigengineering.in'],
    stage2: ['vanditm@floindexventures.com','dhruv.h@floindexventures.com'] },
];

const LEAVE_FILE  = '07_Leave_Requests.xlsx';
const LEAVE_SHEET = 'Leave Requests';

// ── Teams channel helper ──────────────────────────────────────────────────────
async function postToTeamsChannel(title, facts, color, tag) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) return;
  const body = [];
  body.push({ type:'TextBlock', text:(tag?tag+' — ':'')+title, weight:'Bolder', size:'Medium', wrap:true,
    color: color==='good'?'Good':color==='warning'?'Warning':color==='attention'?'Attention':'Accent' });
  if (facts&&facts.length) body.push({ type:'FactSet', facts:facts.map(([t,v])=>({title:t,value:String(v)})) });
  const actions = [{ type:'Action.OpenUrl', title:'Open AIG Pulse', url:'https://pulse-aigengineering.netlify.app' }];
  await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ type:'message', attachments:[{ contentType:'application/vnd.microsoft.card.adaptive',
      content:{ '$schema':'http://adaptivecards.io/schemas/adaptive-card.json', type:'AdaptiveCard', version:'1.4', body, actions }
    }]})
  }).catch(e=>console.warn('[ho-digest Teams]',e.message));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAppToken() {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  const r = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' })
  });
  if (!r.ok) throw new Error('Token failed');
  return (await r.json()).access_token;
}

async function getSPIds(token) {
  const site  = await fetch(`${GRAPH_BASE}/sites/${SP_HOST}:/sites/${SP_SITE}`, { headers: { 'Authorization': `Bearer ${token}` } });
  const siteId = (await site.json()).id;
  const drive  = await fetch(`${GRAPH_BASE}/sites/${siteId}/drive`, { headers: { 'Authorization': `Bearer ${token}` } });
  return { driveId: (await drive.json()).id };
}

async function getFileRows(token, driveId, filename) {
  try {
    const f = await fetch(`${GRAPH_BASE}/drives/${driveId}/root:/${encodeURIComponent(filename)}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!f.ok) return [];
    const fileId = (await f.json()).id;
    const sheets = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets?$select=name`, { headers: { 'Authorization': `Bearer ${token}` } });
    const ws = ((await sheets.json()).value || [])[0]?.name;
    if (!ws) return [];
    const range = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(ws)}')/usedRange?$select=values`, { headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' } });
    return (await range.json()).values || [];
  } catch(e) { console.warn(filename, e.message); return []; }
}

async function getLeaveRows(token, driveId) {
  try {
    const f = await fetch(`${GRAPH_BASE}/drives/${driveId}/root:/${encodeURIComponent(LEAVE_FILE)}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!f.ok) return [];
    const fileId = (await f.json()).id;
    const range  = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets('${encodeURIComponent(LEAVE_SHEET)}')/usedRange?$select=values`, { headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' } });
    return (await range.json()).values || [];
  } catch(e) { console.warn('Leave:', e.message); return []; }
}

async function sendMail(token, to, subject, html, cc) {
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!from) return;
  if(!/\bPulse\b/i.test(subject)) subject = '[Pulse] ' + subject;
  const ccList = [...new Set([...(cc||[]),'ashwinig@floindexventures.com','vanditm@floindexventures.com'])].filter(e=>e.toLowerCase()!==to.toLowerCase());
  const msg = { subject, body: { contentType: 'HTML', content: html },
    toRecipients: [{ emailAddress: { address: to } }],
    from: { emailAddress: { address: from } } };
  if(ccList.length) msg.ccRecipients = ccList.map(e=>({ emailAddress: { address: e } }));
  await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg })
  }).catch(e => console.warn('sendMail', to, e.message));
}

// Token generators — must match portal + action handler logic
function makeApprovalToken(ref, form, action, stage) {
  const secret = process.env.MS_TENANT_ID || 'x';
  return Buffer.from(secret + `${ref}|${form}|${action}|${stage}`).toString('base64').slice(0, 24);
}
function makeLeaveToken(ref, action) {
  const secret = process.env.MS_TENANT_ID || 'x';
  try { return Buffer.from(secret + `${ref}|${action}`).toString('base64').slice(0, 20); }
  catch(e) { return Buffer.from(encodeURIComponent(secret + `${ref}|${action}`)).toString('base64').slice(0, 20); }
}

// ── Email building blocks ──────────────────────────────────────────────────────

function actionBtns(approveUrl, returnUrl, approveLabel='Approve', returnLabel='Return') {
  return `<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
    <a href="${approveUrl}" style="display:inline-block;padding:10px 24px;background:#0F6E56;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">${approveLabel}</a>
    <a href="${returnUrl}"  style="display:inline-block;padding:10px 24px;background:#C62828;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">${returnLabel}</a>
  </div>`;
}

function pendingCard(title, meta, amount, submittedBy, submittedDate, approveUrl, returnUrl, urgentDays) {
  const isOld = urgentDays >= 2;
  return `<div style="border:.5px solid ${isOld?'#E65100':'#E5E7EB'};border-radius:10px;padding:14px 16px;margin-bottom:12px;background:${isOld?'#FFF3E0':'#fff'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:600;color:#0C1A2E">${title}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px">${meta}</div>
      </div>
      ${amount?`<div style="font-size:15px;font-weight:700;color:#0C1A2E;text-align:right">&#8377;${Number(amount).toLocaleString('en-IN')}</div>`:''}
    </div>
    <div style="font-size:12px;color:#374151">By: <strong>${submittedBy}</strong> &nbsp;&middot;&nbsp; ${submittedDate}${isOld?` &nbsp;<span style="color:#E65100;font-weight:600">&#9888; ${urgentDays} days pending</span>`:''}
    </div>
    ${actionBtns(approveUrl, returnUrl)}
  </div>`;
}

function sectionHeader(title, count, color) {
  return `<div style="display:flex;align-items:center;gap:8px;margin:20px 0 12px">
    <span style="font-size:14px;font-weight:600;color:#0C1A2E">${title}</span>
    ${count>0?`<span style="background:${color};color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px">${count}</span>`:''}
  </div>`;
}

function wrapEmail(recipientName, dateLabel, body, totalActions) {
  const urgency = totalActions > 0
    ? `<div style="background:#FFF3E0;border-left:4px solid #E65100;padding:12px 16px;margin-bottom:20px;border-radius:0 8px 8px 0;font-size:13px;color:#E65100;font-weight:500">&#9888; ${totalActions} item${totalActions!==1?'s':''} need${totalActions===1?'s':''} your action today</div>`
    : `<div style="background:#E8F5E9;border-left:4px solid #0F6E56;padding:12px 16px;margin-bottom:20px;border-radius:0 8px 8px 0;font-size:13px;color:#0F6E56">&#10003; All clear &mdash; nothing pending for you today</div>`;
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto">
    <div style="background:#0C1A2E;padding:18px 24px;border-radius:10px 10px 0 0">
      <h2 style="color:#fff;margin:0;font-size:16px">&#127758; AIG Pulse &mdash; Morning Digest</h2>
      <p style="color:rgba(255,255,255,.55);margin:4px 0 0;font-size:12px">${dateLabel} &nbsp;&middot;&nbsp; For ${recipientName}</p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:20px 24px;border-radius:0 0 10px 10px">
      ${urgency}
      ${body}
      <div style="border-top:.5px solid #E5E7EB;padding-top:14px;margin-top:4px;text-align:center">
        <a href="${BASE_URL}" style="display:inline-block;padding:10px 28px;background:#0C1A2E;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">Open AIG Pulse Portal</a>
      </div>
      <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:12px 0 0">AIG Engineering Pulse &mdash; 7:00 AM IST digest &mdash; Reply not monitored</p>
    </div>
  </div>`;
}

// ── Main handler ───────────────────────────────────────────────────────────────


// Build contracted staff attendance section for digest emails
function buildContrSection(workers, dateLabel) {
  if (!workers.length) return '';
  // Group by site
  const bySite = {};
  workers.forEach(w => {
    if (!bySite[w.site]) bySite[w.site] = [];
    bySite[w.site].push(w);
  });
  const missingCheckout = workers.filter(w => w.checkin && !w.checkout).length;
  let html = `
    <div style="background:#F0FDF4;border-left:4px solid #059669;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:#065F46;margin-bottom:4px">
        &#128101; Contracted Staff — ${dateLabel}
      </div>
      <div style="font-size:12px;color:#166534">${workers.length} worker${workers.length!==1?'s':''} checked in`;
  if (missingCheckout > 0) {
    html += ` &bull; <span style="color:#D97706;font-weight:500">${missingCheckout} no checkout recorded</span>`;
  }
  html += '</div></div>';

  // Site breakdown table
  html += '<table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:16px">';
  html += '<thead><tr style="background:#F9FAFB"><th style="padding:8px 12px;font-size:11px;font-weight:500;color:#6B7280;text-align:left">Site</th><th style="padding:8px 12px;font-size:11px;font-weight:500;color:#6B7280;text-align:left">Contractor</th><th style="padding:8px 12px;font-size:11px;font-weight:500;color:#6B7280;text-align:right">Workers</th><th style="padding:8px 12px;font-size:11px;font-weight:500;color:#6B7280;text-align:right">Checked out</th></tr></thead>';
  html += '<tbody>';

  Object.entries(bySite).sort((a,b) => b[1].length - a[1].length).forEach(([site, ws], si) => {
    // Group by contractor within site
    const byContr = {};
    ws.forEach(w => {
      const c = w.contractor || 'Unknown';
      if (!byContr[c]) byContr[c] = [];
      byContr[c].push(w);
    });
    Object.entries(byContr).forEach(([contr, cws], ci) => {
      const checkedOut = cws.filter(w => w.checkout).length;
      html += `<tr style="background:${(si+ci)%2?'#FAFAFA':'#fff'};border-top:0.5px solid #E5E7EB">
        <td style="padding:8px 12px;font-size:12px;font-weight:500;color:#111827">${ci===0?site:''}</td>
        <td style="padding:8px 12px;font-size:12px;color:#374151">${contr}</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#059669;text-align:right">${cws.length}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;color:${checkedOut===cws.length?'#059669':'#D97706'}">${checkedOut}/${cws.length}</td>
      </tr>`;
    });
  });

  html += '</tbody></table>';
  return html;
}

exports.handler = async () => {
  try {
    const token = await getAppToken();
    const { driveId } = await getSPIds(token);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const dayLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const enc = encodeURIComponent;

    // ── Load all data in parallel ──────────────────────────────────────────────
    const [leaveRows, ...formRowsArr] = await Promise.all([
      getLeaveRows(token, driveId),
      ...APPROVAL_FORMS.map(f => getFileRows(token, driveId, f.file)),
    ]);
    const formData = {};
    APPROVAL_FORMS.forEach((f, i) => { formData[f.key] = formRowsArr[i]; });

    // Attendance yesterday (for digest context)
    const attRows = await getFileRows(token, driveId, '08_Attendance.xlsx');
    const yAtt = attRows.slice(1).filter(r => {
      const o = typeof r[0]==='string' && /^AT-/.test(r[0]) ? 1 : 0;
      return (r[o]||'').toString().startsWith(yStr);
    });

    // Contracted staff attendance — populated by MS Forms response synced to SharePoint
    // MS Form should collect: Date, Site, Worker Name, Worker ID, Contractor, Check-in Time, Check-out Time
    // Columns in ContractedEmp_Attendance.xlsx:
    //   0=ref/timestamp, 1=date, 2=site, 3=contractor, 4=workerId, 5=workerName, 6=trade, 7=by, 8=byEmail
    //   9=checkinTime, 10=checkinPhoto, ... checkoutTime at col 13
    // MS Forms response columns may differ — we detect by checking if col 0 looks like a ref or timestamp
    const contrRows = await getFileRows(token, driveId, 'ContractedEmp_Attendance.xlsx').catch(() => []);
    // Build today and yesterday summaries
    function parseContrRows(rows, dateStr) {
      const seen = {}; // workerId+site → latest entry
      rows.slice(1).forEach(r => {
        const raw = (r[1]||r[0]||'').toString().trim();
        const rowDate = raw.split('T')[0].replace(/\//g, '-');
        if (!rowDate.startsWith(dateStr)) return;
        const site       = (r[2]||'').toString().trim();
        const contractor = (r[3]||'').toString().trim();
        const workerId   = (r[4]||r[5]||'').toString().trim();
        const workerName = (r[5]||'').toString().trim();
        const checkin    = (r[9]||'').toString().trim();
        const checkout   = (r[13]||r[12]||'').toString().trim();
        const key = site + '|' + (workerId || workerName);
        if (!seen[key]) seen[key] = { site, contractor, workerId, workerName, checkin, checkout };
        else { // merge — later entry may have checkout
          if (checkout) seen[key].checkout = checkout;
        }
      });
      return Object.values(seen);
    }
    const contrToday = parseContrRows(contrRows, todayStr);
    const contrYest  = parseContrRows(contrRows, yStr);

    // ── Parse pending items ────────────────────────────────────────────────────
    function daysPending(row, dateColIdx) {
      const d = (row[dateColIdx]||'').toString().split('T')[0];
      if (!d) return 0;
      return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    }

    // Leave requests pending approval
    const pendingLeaves = leaveRows.slice(1).filter(r => (r[10]||'') === 'Pending').map(r => ({
      ref: r[0]||'', name: r[2]||'', email: r[3]||'', dept: r[4]||'',
      type: r[5]||'', from: r[6]||'', to: r[7]||'', days: r[8]||'',
      reason: (r[9]||'').toString().slice(0, 80), submitted: (r[1]||'').toString().split('T')[0],
      mgrRef: r[12]||'', daysPending: daysPending(r, 1),
    }));

    // Approval forms pending by stage
    const pendingForms = {};
    for (const f of APPROVAL_FORMS) {
      const rows = formData[f.key] || [];
      // De-duplicate by ref (multiple rows per indent)
      const byRef = {};
      rows.slice(1).forEach(r => {
        const ref = (r[f.refCol]||'').toString().trim();
        if (!ref) return;
        const status = (r[f.statusCol]||'').toString();
        if (status !== 'Pending' && !status.startsWith('Approved Stage')) return;
        if (!byRef[ref]) byRef[ref] = { ref, name: r[f.nameCol]||'', proj: r[f.projCol]||'', amt: 0, status, submitted: (r[1]||'').toString().split('T')[0], days: daysPending(r, 1) };
        byRef[ref].amt += parseFloat(r[f.amtCol]) || 0;
      });
      pendingForms[f.key] = Object.values(byRef);
    }

    // ── Build digest per persona ───────────────────────────────────────────────
    let totalSent = 0;

    for (const [email, persona] of Object.entries(PERSONAS)) {
      let body = '';
      let totalActions = 0;

      if (persona.role === 'director' || persona.role === 'manager') {
        // LEAVE section
        const myLeaves = pendingLeaves.filter(l => {
          if (persona.seeAll) return true;
          // Managers see leaves where they are named in mgrRef
          return l.mgrRef.toLowerCase().includes(email.toLowerCase());
        });

        if (myLeaves.length > 0) {
          body += sectionHeader('Leave requests', myLeaves.length, '#185FA5');
          for (const l of myLeaves) {
            const at = makeLeaveToken(l.ref, 'approve');
            const rt = makeLeaveToken(l.ref, 'reject');
            const aUrl = `${BASE_URL}/api/leave-action?ref=${enc(l.ref)}&action=approve&token=${enc(at)}&approver_name=${enc(persona.name)}&approver_email=${enc(email)}`;
            const rUrl = `${BASE_URL}/api/leave-action?ref=${enc(l.ref)}&action=reject&token=${enc(rt)}&approver_name=${enc(persona.name)}&approver_email=${enc(email)}`;
            body += pendingCard(
              `${l.name} &mdash; ${l.type}`,
              `${l.dept} &nbsp;&middot;&nbsp; ${l.from} to ${l.to} (${l.days} days)${l.reason?' &nbsp;&middot;&nbsp; '+l.reason:''}`,
              null, l.name, l.submitted, aUrl, rUrl, l.daysPending
            );
            totalActions++;
          }
        }

        // APPROVAL FORMS section
        let formBody = '';
        let formCount = 0;
        for (const f of APPROVAL_FORMS) {
          const items = pendingForms[f.key] || [];
          const myItems = items.filter(item => {
            if (persona.seeAll) return item.status === 'Approved Stage 1 - Pending Stage 2' || item.status === 'Pending';
            // Managers see stage-1 pending items
            return item.status === 'Pending' && f.stage1.includes(email);
          });
          for (const item of myItems) {
            const stage = persona.seeAll ? 2 : 1;
            const at = makeApprovalToken(item.ref, f.key, 'approve', stage);
            const rt = makeApprovalToken(item.ref, f.key, 'return',  stage);
            const aUrl = `${BASE_URL}/api/approval-action?ref=${enc(item.ref)}&form=${enc(f.key)}&action=approve&stage=${stage}&token=${enc(at)}&approver_name=${enc(persona.name)}&approver_email=${enc(email)}`;
            const rUrl = `${BASE_URL}/api/approval-action?ref=${enc(item.ref)}&form=${enc(f.key)}&action=return&stage=${stage}&token=${enc(rt)}&approver_name=${enc(persona.name)}&approver_email=${enc(email)}`;
            formBody += pendingCard(
              `${f.label} &mdash; ${item.ref}`,
              `Project: ${item.proj}`,
              item.amt, item.name, item.submitted, aUrl, rUrl, item.days
            );
            formCount++; totalActions++;
          }
        }
        if (formCount > 0) {
          body += sectionHeader('Forms awaiting approval', formCount, '#E65100');
          body += formBody;
        }

        // ATTENDANCE context (directors only)
        if (persona.seeAll) {
          const missingOut = yAtt.filter(r => { const o = typeof r[0]==='string'&&/^AT-/.test(r[0])?1:0; return !r[o+8]; });
          if (yAtt.length > 0) {
            body += sectionHeader('Yesterday\'s attendance', null, '');
            body += `<div style="display:flex;gap:12px;margin-bottom:16px">
              <div style="flex:1;background:#E8F5E9;border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:20px;font-weight:600;color:#0F6E56">${yAtt.length - missingOut.length}</div>
                <div style="font-size:11px;color:#2E7D32">Full day</div>
              </div>
              <div style="flex:1;background:${missingOut.length?'#FFEBEE':'#F3F4F6'};border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:20px;font-weight:600;color:${missingOut.length?'#C62828':'#9CA3AF'}">${missingOut.length}</div>
                <div style="font-size:11px;color:${missingOut.length?'#C62828':'#9CA3AF'}">No checkout</div>
              </div>
              <div style="flex:1;background:#F3F4F6;border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:20px;font-weight:600;color:#374151">${yAtt.length}</div>
                <div style="font-size:11px;color:#6B7280">Total</div>
              </div>
            </div>
            ${missingOut.length?`<p style="font-size:12px;color:#C62828;margin-bottom:16px">Missing checkout: ${missingOut.slice(0,6).map(r=>{const o=typeof r[0]==='string'&&/^AT-/.test(r[0])?1:0;return r[o+1]||'';}).filter(Boolean).join(', ')}${missingOut.length>6?` +${missingOut.length-6} more`:''}</p>`:''}`;
          }
        }
      }

      if (persona.role === 'accounts') {
        // ACCOUNTS: see fully-approved payments ready to pay + WFR pending their action
        const approvedPayments = (pendingForms['payment'] || []).filter(p => p.status === 'Approved');
        if (approvedPayments.length > 0) {
          body += sectionHeader('Payments approved — ready to release', approvedPayments.length, '#0F6E56');
          for (const p of approvedPayments) {
            body += `<div style="border:.5px solid #0F6E56;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#F0FBF6">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-size:13px;font-weight:600">${p.ref} &mdash; ${p.proj}</div>
                  <div style="font-size:11px;color:#6B7280">Submitted by ${p.name} &middot; ${p.submitted}</div>
                </div>
                <div style="font-size:16px;font-weight:700;color:#0F6E56">&#8377;${Number(p.amt).toLocaleString('en-IN')}</div>
              </div>
              <div style="margin-top:10px"><a href="${BASE_URL}" style="font-size:12px;background:#0F6E56;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none">Mark as Released in Portal</a></div>
            </div>`;
            totalActions++;
          }
        }

        // New procurement approved — need to order
        const approvedProc = [...(pendingForms['procurement_low']||[]), ...(pendingForms['procurement_high']||[])]
          .filter(p => p.status === 'Approved');
        if (approvedProc.length > 0) {
          body += sectionHeader('Procurement approved — action ordering', approvedProc.length, '#185FA5');
          for (const p of approvedProc) {
            body += `<div style="border:.5px solid #E5E7EB;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#fff">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div><div style="font-size:13px;font-weight:600">${p.ref} &mdash; ${p.proj}</div>
                <div style="font-size:11px;color:#6B7280">By ${p.name} &middot; ${p.submitted}</div></div>
                <div style="font-size:15px;font-weight:700;color:#0C1A2E">&#8377;${Number(p.amt).toLocaleString('en-IN')}</div>
              </div>
              <div style="margin-top:10px"><a href="${BASE_URL}" style="font-size:12px;background:#185FA5;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none">Update Delivery Status in Portal</a></div>
            </div>`;
          }
        }

        // ── Bills & Receipts uploaded yesterday/today ────────────────────────────
      const billRows = await getFileRows(token, driveId, '13_Bill_Receipts.xlsx');
      const recentBills = billRows.slice(1).filter(r => {
        const d = (r[1]||'').toString().split('T')[0]; // timestamp col
        return d === yStr || d === todayStr;
      });

      if (recentBills.length > 0) {
        body += sectionHeader('Bills & receipts uploaded', recentBills.length, '#7F3F98');
        // Running total
        const totalAmt = recentBills.reduce((s, r) => s + (parseFloat(r[8])||0), 0);
        body += `<div style="background:#F3EAFB;border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px;color:#7F3F98;font-weight:500">${recentBills.length} bill${recentBills.length!==1?'s':''} uploaded</div>
          <div style="font-size:16px;font-weight:700;color:#7F3F98">&#8377;${totalAmt.toLocaleString('en-IN')}</div>
        </div>`;

        // Table of all bills with photo links
        body += `<table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:16px">
          <thead><tr style="background:#F3F4F6">
            <th style="padding:8px 10px;font-size:11px;color:#6B7280;text-align:left;font-weight:500">Ref</th>
            <th style="padding:8px 10px;font-size:11px;color:#6B7280;text-align:left;font-weight:500">Vendor</th>
            <th style="padding:8px 10px;font-size:11px;color:#6B7280;text-align:left;font-weight:500">Type</th>
            <th style="padding:8px 10px;font-size:11px;color:#6B7280;text-align:left;font-weight:500">Project</th>
            <th style="padding:8px 10px;font-size:11px;color:#6B7280;text-align:right;font-weight:500">Amount</th>
            <th style="padding:8px 10px;font-size:11px;color:#6B7280;text-align:left;font-weight:500">Photo</th>
          </tr></thead>
          <tbody>
          ${recentBills.map((r, i) => {
            const ref     = r[0]||'';
            const proj    = r[4]||'';
            const date    = (r[5]||'').toString().split('T')[0];
            const type    = r[6]||'';
            const vendor  = r[7]||'';
            const amount  = parseFloat(r[8])||0;
            const billno  = r[10]||'';
            const desc    = r[11]||'';
            const photos  = (r[12]||'').toString().split(',').map(u=>u.trim()).filter(Boolean);
            const submittedBy = r[2]||'';
            const photoLink = photos.length
              ? `<a href="${photos[0]}" style="font-size:11px;color:#7F3F98;text-decoration:none">View (${photos.length})</a>`
              : '<span style="color:#9CA3AF;font-size:11px">No photo</span>';
            return `<tr style="background:${i%2?'#FAFAFA':'#fff'}">
              <td style="padding:7px 10px;font-size:11px;font-family:monospace;color:#374151">${ref}</td>
              <td style="padding:7px 10px;font-size:12px;font-weight:500">${vendor}${billno?' <span style="font-size:10px;color:#9CA3AF">#'+billno+'</span>':''}</td>
              <td style="padding:7px 10px;font-size:11px;color:#6B7280">${type}</td>
              <td style="padding:7px 10px;font-size:11px;color:#6B7280">${proj}</td>
              <td style="padding:7px 10px;font-size:13px;font-weight:600;color:#0C1A2E;text-align:right">&#8377;${amount.toLocaleString('en-IN')}</td>
              <td style="padding:7px 10px">${photoLink}</td>
            </tr>
            ${desc?`<tr style="background:${i%2?'#FAFAFA':'#fff'}"><td colspan="6" style="padding:2px 10px 8px;font-size:11px;color:#9CA3AF">${desc} &mdash; by ${submittedBy}</td></tr>`:''}`;
          }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#F3EAFB">
              <td colspan="4" style="padding:8px 10px;font-size:12px;font-weight:600;color:#7F3F98">Total</td>
              <td style="padding:8px 10px;font-size:14px;font-weight:700;color:#7F3F98;text-align:right">&#8377;${totalAmt.toLocaleString('en-IN')}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div style="text-align:right;margin-bottom:8px">
          <a href="${BASE_URL}" style="font-size:12px;color:#7F3F98;text-decoration:none">View all in portal &#8594;</a>
        </div>`;
      }

      // ── Contracted staff attendance ───────────────────────────────────────────
      if (persona.role === 'director' || persona.role === 'manager') {
        if (contrToday.length > 0) {
          body += contrSectionToday;
          totalActions++; // count as info item
        } else if (contrYest.length > 0) {
          body += contrSectionYest;
        } else {
          body += '<div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:12px;color:#6B7280">No contracted staff attendance recorded today.</div>';
        }
      }

      if (!approvedPayments.length && !approvedProc.length && !recentBills.length) {
        body += `<div style="background:#F3F4F6;border-radius:8px;padding:16px;text-align:center;color:#6B7280;font-size:13px">Nothing requiring accounts action today.</div>`;
      }
      }

      if (!body) body = `<div style="background:#F3F4F6;border-radius:8px;padding:16px;text-align:center;color:#6B7280;font-size:13px">Nothing requiring your action today. Have a great day!</div>`;

      const subject = totalActions > 0
        ? `[${totalActions} action${totalActions!==1?'s':''}] AIG Pulse Digest &mdash; ${dayLabel}`
        : `[All clear] AIG Pulse Digest &mdash; ${dayLabel}`;

      await sendMail(token, email, subject, wrapEmail(persona.name, dayLabel, body, totalActions));
      console.log(`[ho-digest] Sent to ${email} (${persona.role}): ${totalActions} actions`);
      totalSent++;
    }

    // Post daily summary card to Teams channel
    // Build contracted section for manager digest emails
    const contrSectionToday = buildContrSection(contrToday, 'Today');
    const contrSectionYest  = buildContrSection(contrYest,  'Yesterday');

    const channelFacts = [
      ['Date', dayLabel],
      ['Contracted staff today', contrToday.length + ' workers across ' + [...new Set(contrToday.map(w=>w.site))].length + ' sites'],
      ['Total pending approvals', String(Object.values(pendingForms).flat().length + pendingLeaves.length)],
      ['Attendance yesterday', String(yAtt.length) + ' in, ' + yAtt.filter(r=>{ const o=typeof r[0]==='string'&&/^AT-/.test(r[0])?1:0; return !r[o+8]; }).length + ' missing checkout'],
    ];
    if (dprSummaries && dprSummaries.length) {
      dprSummaries.forEach(d => channelFacts.push([d.label, d.entries + ' entries' + (d.qty ? ', ' + d.qty.toFixed(0) + 'm' : '')]));
    }
    const pendingTotal = Object.values(pendingForms).flat().length + pendingLeaves.length;
    await postToTeamsChannel(
      `Morning digest — ${dayLabel}`,
      channelFacts,
      pendingTotal > 0 ? 'warning' : 'good',
      pendingTotal > 0 ? `${pendingTotal} items need action` : 'All clear'
    );

    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: totalSent }) };
  } catch(err) {
    console.error('[ho-digest]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
