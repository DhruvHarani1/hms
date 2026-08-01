// approval-action.js — multi-stage approval handler
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SP_HOST = 'floindexventures.sharepoint.com';
const SP_SITE = 'OpsPortalData';
const BASE_URL = 'https://pulse-aigengineering.netlify.app';

const FORM_CFG = {
  procurement:      { file:'01_Procurement_Indent.xlsx', refCol:0, emailCol:3, statusCol:26, projCol:4, amtCol:14 },
  procurement_low:  { file:'01_Procurement_Indent.xlsx', refCol:0, emailCol:3, statusCol:26, projCol:4, amtCol:14 },
  procurement_high: { file:'01_Procurement_Indent.xlsx', refCol:0, emailCol:3, statusCol:26, projCol:4, amtCol:14 },
  payment:          { file:'04_Payment_Request.xlsx',    refCol:0, emailCol:3, statusCol:23, projCol:4, amtCol:12 },
  hire:             { file:'05_Hire_Indent.xlsx',        refCol:0, emailCol:3, statusCol:20, projCol:4, amtCol:19 },
};
const STAGES = {
  procurement_low:  [null,{name:'Manoj F / Basha / Manjula / Anjali',emails:['manojf@aigengineering.in','basha@aigengineering.in','manjulab@floindex.com','anjali.d@aigengineering.in']},{name:'Vandit / Dhruv',emails:['vanditm@floindexventures.com','dhruv.h@floindexventures.com']}],
  procurement_high: [null,{name:'Manoj F / Basha / Manjula / Anjali',emails:['manojf@aigengineering.in','basha@aigengineering.in','manjulab@floindex.com','anjali.d@aigengineering.in']},{name:'Vandit / Dhruv',emails:['vanditm@floindexventures.com','dhruv.h@floindexventures.com']}],
  payment:          [null,{name:'Basha / Manoj F / Manjula',emails:['basha@aigengineering.in','manojf@aigengineering.in','manjulab@floindex.com']},{name:'Vandit / Dhruv',emails:['vanditm@floindexventures.com','dhruv.h@floindexventures.com']}],
  hire:             [null,{name:'Basha / Manoj F / Manjula / Anjali',emails:['basha@aigengineering.in','manojf@aigengineering.in','manjulab@floindex.com','anjali.d@aigengineering.in']},{name:'Vandit / Dhruv',emails:['vanditm@floindexventures.com','dhruv.h@floindexventures.com']}],
};

async function postTeams(title, facts, approveUrl, returnUrl, color, tag) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) return;
  const actions = [];
  if (approveUrl) {
    actions.push({ type:'Action.OpenUrl', title:'Approve', url:approveUrl, style:'positive' });
    actions.push({ type:'Action.OpenUrl', title:'Return',  url:returnUrl,  style:'destructive' });
  }
  actions.push({ type:'Action.OpenUrl', title:'Open Pulse', url:'https://pulse-aigengineering.netlify.app' });
  const body = [];
  if (tag) body.push({ type:'TextBlock', text:tag+' — '+title, weight:'Bolder', size:'Medium', wrap:true,
    color: color==='good'?'Good':color==='warning'?'Warning':color==='attention'?'Attention':'Accent' });
  else body.push({ type:'TextBlock', text:title, weight:'Bolder', size:'Medium', wrap:true });
  if (facts&&facts.length) body.push({ type:'FactSet', facts:facts.map(([t,v])=>({title:String(t),value:String(v)})) });
  await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ type:'message', attachments:[{ contentType:'application/vnd.microsoft.card.adaptive', content:{
      '$schema':'http://adaptivecards.io/schemas/adaptive-card.json', type:'AdaptiveCard', version:'1.4', body, actions
    }}]})
  }).catch(e=>console.warn('[Teams]',e.message));
}

async function appToken(){
  const {MS_TENANT_ID,MS_CLIENT_ID,MS_CLIENT_SECRET}=process.env;
  const r=await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:MS_CLIENT_ID,client_secret:MS_CLIENT_SECRET,scope:'https://graph.microsoft.com/.default'})});
  if(!r.ok) throw new Error('Token failed');
  return (await r.json()).access_token;
}
function mkTok(ref,form,action,stage){return Buffer.from((process.env.MS_TENANT_ID||'x')+`${ref}|${form}|${action}|${stage}`).toString('base64').slice(0,24);}
function vfTok(ref,form,action,stage,tok){return mkTok(ref,form,action,stage)===tok;}


// Mirror the status change into the Supabase copy so DB-fallback reads (used
// during Graph throttling) show the real approval state, not stale 'Pending'.
async function mirrorStatus(formKey, rows, statusColIdx, statusVal){
  const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if(!SB_URL || !SB_KEY) return;
  for(const {excelRow} of rows){
    try{
      const g = await fetch(`${SB_URL}/rest/v1/form_rows?form_id=eq.${encodeURIComponent(formKey)}&excel_row=eq.${excelRow}&select=vals`,
        { headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` } });
      if(!g.ok) continue;
      const rowsDb = await g.json();
      if(!rowsDb.length) continue;
      const vals = rowsDb[0].vals || [];
      while(vals.length <= statusColIdx) vals.push('');
      vals[statusColIdx] = statusVal;
      await fetch(`${SB_URL}/rest/v1/form_rows?form_id=eq.${encodeURIComponent(formKey)}&excel_row=eq.${excelRow}`,
        { method:'PATCH', headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
          body: JSON.stringify({ vals }) });
    }catch(e){ /* mirror is best-effort */ }
  }
}

async function mail(tok,to,subject,html,cc){
  const from=process.env.REMINDER_FROM_EMAIL; if(!from) return;
  if(!/\bPulse\b/i.test(subject)) subject = '[Pulse] ' + subject;
  const ccList = [...new Set([...(cc||[]),'ashwinig@floindexventures.com','vanditm@floindexventures.com','dhruv.h@floindexventures.com'])].filter(e=>e!==to);
  const msg = {subject,body:{contentType:'HTML',content:html},toRecipients:[{emailAddress:{address:to}}],from:{emailAddress:{address:from}}};
  if(ccList.length) msg.ccRecipients = ccList.map(e=>({emailAddress:{address:e}}));
  await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`,{method:'POST',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},body:JSON.stringify({message:msg})}).catch(e=>console.error(e.message));
}

function page(icon,title,body,color='#0C1A2E'){return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;background:#F0F2F5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#fff;border-radius:16px;padding:40px 36px;max-width:440px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}.icon{font-size:52px;margin-bottom:16px}.title{font-size:22px;font-weight:600;color:${color};margin-bottom:8px}.sub{font-size:14px;color:#666;line-height:1.6;margin-bottom:24px}.btn{display:inline-block;padding:10px 24px;background:#185FA5;color:#fff;border-radius:8px;text-decoration:none;font-size:13px}</style></head><body><div class="card"><div class="icon">${icon}</div><div class="title">${title}</div><div class="sub">${body}</div><a class="btn" href="${BASE_URL}">Portal</a></div></body></html>`;}

exports.handler = async (event) => {
  const q=event.queryStringParameters||{};
  const {ref,form,action,stage:stageStr,token,approver_name,approver_email,remarks}=q;
  const stage=parseInt(stageStr||'1',10);
  // Accept both the split keys (procurement_low/high) from first-stage links
  // and the base key (procurement) that later-stage links may carry.
  if(form && !FORM_CFG[form] && FORM_CFG[form.replace(/_(low|high)$/,'')]) form = form.replace(/_(low|high)$/,'');
  if(!ref||!form||!action||!token||!FORM_CFG[form]) return {statusCode:400,headers:{'Content-Type':'text/html'},body:page('⚠️','Bad Request','Invalid link parameters.','#E65100')};
  if(!['approve','return'].includes(action)) return {statusCode:400,headers:{'Content-Type':'text/html'},body:page('⚠️','Bad Action','Action must be approve or return.','#E65100')};
  if(!vfTok(ref,form,action,stage,token)) return {statusCode:403,headers:{'Content-Type':'text/html'},body:page('🔒','Expired','This link has expired. Use the portal.','#C62828')};
  try{
    const tok=await appToken();
    const cfg=FORM_CFG[form];
    const stages=STAGES[form];
    // Get SharePoint file
    const siteR=await fetch(`${GRAPH_BASE}/sites/${SP_HOST}:/sites/${SP_SITE}`,{headers:{'Authorization':`Bearer ${tok}`}});
    const siteId=(await siteR.json()).id;
    const driveR=await fetch(`${GRAPH_BASE}/sites/${siteId}/drive`,{headers:{'Authorization':`Bearer ${tok}`}});
    const driveId=(await driveR.json()).id;
    const fileR=await fetch(`${GRAPH_BASE}/drives/${driveId}/root:/${encodeURIComponent(cfg.file)}`,{headers:{'Authorization':`Bearer ${tok}`}});
    const fileId=(await fileR.json()).id;
    const ws=`${GRAPH_BASE}/drives/${driveId}/items/${fileId}/workbook/worksheets`;
    // Get all sheets and find rows
    const sheetsR=await fetch(`${ws}?$select=name`,{headers:{'Authorization':`Bearer ${tok}`}});
    const sheets=(await sheetsR.json()).value||[];
    let matchRows=[];
    for(const sh of sheets){
      const rr=await fetch(`${ws}('${encodeURIComponent(sh.name)}')/usedRange?$select=values`,{headers:{'Authorization':`Bearer ${tok}`}});
      const vals=(await rr.json()).values||[];
      vals.forEach((row,i)=>{if(i>0&&(row[cfg.refCol]||'').toString().trim()===ref) matchRows.push({row,sheet:sh.name,excelRow:i+1});});
    }
    if(!matchRows.length) throw new Error(`Ref ${ref} not found`);
    const fRow=matchRows[0];
    const submitterEmail=(fRow.row[cfg.emailCol]||'').toString();
    const submitterName=(fRow.row[2]||'').toString();
    const project=(fRow.row[cfg.projCol]||'').toString();
    const totalAmt=matchRows.reduce((s,{row})=>s+(parseFloat(row[cfg.amtCol])||0),0);
    const approverDisplay=approver_name?decodeURIComponent(approver_name):'Approver';
    const remarksText=remarks?decodeURIComponent(remarks):'';
    const enc=encodeURIComponent;

    if(action==='return'){
      for(const {sheet,excelRow} of matchRows){
        const col=String.fromCharCode(65+(cfg.statusCol));
        await fetch(`${ws}('${encodeURIComponent(sheet)}')/range(address='${col}${excelRow}')`,{method:'PATCH',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},body:JSON.stringify({values:[['Returned']]})});
      }
      await mirrorStatus(form.replace(/_(low|high)$/,''), matchRows, cfg.statusCol, 'Returned');
      await mail(tok,submitterEmail,`[Returned] ${form} ${ref}`,`<div style="font-family:Arial;max-width:500px"><div style="background:#C62828;padding:16px;border-radius:8px 8px 0 0"><h3 style="color:#fff;margin:0">Returned for revision</h3></div><div style="background:#fff;border:1px solid #eee;border-top:none;padding:16px;font-size:13px"><p>Dear ${submitterName}, your request <strong>${ref}</strong> for <strong>${project}</strong> was returned by <strong>${approverDisplay}</strong>.${remarksText?'<br>Reason: '+remarksText:''}</p><p>Please log in to <a href="${BASE_URL}">AIG Pulse</a> to revise and resubmit.</p></div></div>`);
      return {statusCode:200,headers:{'Content-Type':'text/html'},body:page('↩️','Returned',`${ref} returned to ${submitterName} for revision.`,'#C45911')};
    }

    const nextStage=stage+1;
    const next=stages[nextStage];
    let status;
    if(next){
      status=`Approved by ${approverDisplay}`;
      // ── ONE email to all next-stage approvers ─────────────────────────────
      // Each approver gets their own named button inside the single mail, so
      // attribution is preserved without sending a separate mail per person.
      const _nm = e => ({
        'vanditm@floindexventures.com':'Vandit', 'dhruv.h@floindexventures.com':'Dhruv H', 'ashwinig@floindexventures.com':'Ashwini',
        'manojf@aigengineering.in':'Manoj F', 'basha@aigengineering.in':'Basha',
        'manjulab@floindex.com':'Manjula', 'anjali.d@aigengineering.in':'Anjali'
      }[String(e).toLowerCase()]
        || String(e).split('@')[0].split(/[._-]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' '));
      const _btn = (e, action, colour) => {
        const u = `${BASE_URL}/api/approval-action?ref=${enc(ref)}&form=${enc(form)}&action=${action}&stage=${nextStage}`
                + `&token=${enc(mkTok(ref, form, action, nextStage))}&approver_name=${enc(_nm(e))}&approver_email=${enc(e)}`;
        return `<a href="${u}" style="display:inline-block;margin:3px 5px;padding:9px 16px;background:${colour};color:#fff;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600">${_nm(e)}</a>`;
      };
      const _body = `<div style="font-family:Arial;max-width:600px">`
        + `<div style="background:#0C1A2E;padding:20px;border-radius:8px 8px 0 0">`
        + `<h2 style="color:#fff;margin:0;font-size:16px">Optional Director Review - ${ref}</h2></div>`
        + `<div style="background:#fff;border:1px solid #eee;border-top:none;padding:20px">`
        + `<p>Dear ${next.name},</p>`
        + `<p>Project: <strong>${project}</strong><br>Submitted by: ${submitterName}`
        + `<br>Amount: Rs.${totalAmt.toLocaleString('en-IN')}`
        + `<br>Already approved by: ${approverDisplay} (your endorsement is optional)</p>`
        + `<div style="margin:16px 0"><div style="font-size:12px;color:#6B7280;margin-bottom:6px">Endorse as \u2014 tap your own name:</div>`
        + `<div style="margin-bottom:10px">${next.emails.map(e => _btn(e, 'approve', '#0F6E56')).join('')}</div>`
        + `<div style="font-size:12px;color:#6B7280;margin-bottom:6px">Or return for changes:</div>`
        + `<div>${next.emails.map(e => _btn(e, 'return', '#C62828')).join('')}</div></div>`
        + `</div></div>`;
      await mail(tok, next.emails[0], `[Optional] Director Review - ${form} ${ref} (already approved)`,
                 _body, next.emails.slice(1));
    } else {
      status=`Approved \u00b7 Director: ${approverDisplay}`;
      await mail(tok,submitterEmail,`[Approved] ${ref} - Fully Approved`,`<div style="font-family:Arial;max-width:500px"><div style="background:#0F6E56;padding:16px;border-radius:8px 8px 0 0"><h3 style="color:#fff;margin:0">Fully Approved</h3></div><div style="background:#fff;border:1px solid #eee;border-top:none;padding:16px;font-size:13px"><p>Dear ${submitterName}, your request <strong>${ref}</strong> for <strong>${project}</strong> has been fully approved. Amount: Rs.${totalAmt.toLocaleString('en-IN')}</p></div></div>`);
    }
    for(const {sheet,excelRow} of matchRows){
      const col=String.fromCharCode(65+(cfg.statusCol));
      await fetch(`${ws}('${encodeURIComponent(sheet)}')/range(address='${col}${excelRow}')`,{method:'PATCH',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},body:JSON.stringify({values:[[status]]})});
    }
    await mirrorStatus(form.replace(/_(low|high)$/,''), matchRows, cfg.statusCol, status);
    return {statusCode:200,headers:{'Content-Type':'text/html'},body:page('✅',`Approved`,`${ref} - Rs.${totalAmt.toLocaleString('en-IN')}<br>${next?'Director notified for optional review.':'Director endorsement recorded.'}`)};
  }catch(err){
    console.error('[approval-action]',err.message);
    return {statusCode:500,headers:{'Content-Type':'text/html'},body:page('⚠️','Error',err.message,'#C62828')};
  }
};
