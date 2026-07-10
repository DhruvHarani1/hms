import { Injectable, Logger } from '@nestjs/common';
import { DeviceInfo } from '../../common/utils/device-info.util';

/**
 * Email via Brevo HTTP API (https://api.brevo.com — port 443, never blocked
 * by hosts that block SMTP ports like Render free). Env:
 *   BREVO_API_KEY   — Brevo transactional API key (xkeysib-...)
 *   MAIL_FROM       — sender email (must be a verified Brevo sender)
 *   MAIL_FROM_NAME  — sender display name (optional, default "AIFDMS Hostel")
 * If unset, emails are logged instead of sent (dev fallback).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  isConfigured(): boolean {
    return !!(process.env.BREVO_API_KEY && process.env.MAIL_FROM);
  }

  // ── Core send helper (DRY) ────────────────────────────────────────

  private async sendMail(to: string, subject: string, html: string, text: string) {
    if (!this.isConfigured()) {
      this.logger.warn(`[mail:dev] → ${to}: ${subject}`);
      return;
    }

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY as string,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            email: process.env.MAIL_FROM,
            name: process.env.MAIL_FROM_NAME || 'AIFDMS Hostel',
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Brevo ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (e: any) {
      this.logger.error(`[mail] send failed for ${to}: ${e?.message ?? e}`);
    }
  }

  // ── Shared HTML template ──────────────────────────────────────────

  private readonly BRAND = '#4f46e5';
  private readonly BRAND_LIGHT = '#eef2ff';
  private readonly BRAND_BORDER = '#c7d2fe';

  /**
   * Builds branded, email-client-safe HTML (inline styles + tables).
   * @param title   Bold heading in the card
   * @param bodyHtml  Main content (can include inner HTML)
   * @param securityWarning  Optional security alert block (shown in amber)
   */
  private baseHtml(title: string, bodyHtml: string, securityWarning?: string): string {
    const warningBlock = securityWarning
      ? `<tr><td style="padding:0 32px 24px;">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
             <tr><td style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;">
               <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#92400e;">
                 ⚠️ ${securityWarning}
               </div>
             </td></tr>
           </table>
         </td></tr>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:${this.BRAND};padding:28px 32px;text-align:center;">
          <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;">🏨 AIFDMS Hostel</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 32px 8px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
          <div style="font-size:20px;font-weight:700;margin:0 0 12px;">${title}</div>
          <div style="font-size:14px;line-height:22px;color:#475569;">${bodyHtml}</div>
        </td></tr>
        ${warningBlock}
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-family:Segoe UI,Helvetica,Arial,sans-serif;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;">AIFDMS Hostel · Automated message, please do not reply.</div>
        </td></tr>
      </table>
      <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:16px;">© AIFDMS Hostel · ॥ जय महेश ॥</div>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /** Info card: key-value table in a soft box */
  private infoCard(rows: [string, string][]): string {
    const trs = rows
      .map(
        ([k, v]) =>
          `<tr>
            <td style="padding:6px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top;">${k}</td>
            <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:600;">${v}</td>
          </tr>`,
      )
      .join('');
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr><td style="background:${this.BRAND_LIGHT};border:1px solid ${this.BRAND_BORDER};border-radius:12px;padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs}</table>
        </td></tr>
      </table>`;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  1. PASSWORD RESET CODE  (existing — refactored to use shared send)
  // ═══════════════════════════════════════════════════════════════════

  async sendResetCode(to: string, code: string) {
    const spacedCode = code.split('').join(' ');
    const codeBlock = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr><td align="center" style="background:${this.BRAND_LIGHT};border:1px solid ${this.BRAND_BORDER};border-radius:12px;padding:20px;">
          <div style="font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:${this.BRAND};">${spacedCode}</div>
        </td></tr>
      </table>`;

    const bodyHtml =
      `We received a request to reset your AIFDMS Hostel password. Use the code below to continue. ` +
      `This code expires in <strong>15 minutes</strong>.` +
      codeBlock;

    const text =
      `AIFDMS Hostel\n\n` +
      `Your password reset code is: ${code}\n` +
      `This code expires in 15 minutes.\n\n` +
      `If you didn't request a password reset, you can safely ignore this email.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml(
      'Reset your password',
      bodyHtml,
      `Didn't request this? You can safely ignore this email — your password will not change. Never share this code with anyone; AIFDMS staff will never ask for it.`,
    );

    await this.sendMail(to, `${code} is your AIFDMS Hostel password reset code`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  2. WELCOME / GREETING  (on signup)
  // ═══════════════════════════════════════════════════════════════════

  async sendWelcome(to: string, fullName: string, role: string) {
    const roleLabel = role === 'cook' ? 'Cook' : 'Student';
    const features = role === 'cook'
      ? `<ul style="padding-left:20px;margin:12px 0;">
           <li>🍳 Mark meals as ready for students</li>
           <li>📋 View today's menu set by the warden</li>
           <li>🔔 Get hostel notifications</li>
         </ul>`
      : `<ul style="padding-left:20px;margin:12px 0;">
           <li>🍛 Track your daily meals (breakfast, lunch, dinner)</li>
           <li>📅 Mark & view your attendance</li>
           <li>📝 File & track complaints</li>
           <li>📢 Get hostel notices & announcements</li>
           <li>🏖️ Apply for leave</li>
           <li>📄 Upload documents (photo, Aadhaar, course proof)</li>
         </ul>`;

    const bodyHtml =
      `Hi <strong>${fullName}</strong>, thank you for joining the AIFDMS Hostel App as a <strong>${roleLabel}</strong>! 🎉` +
      `<br><br>` +
      `Your account is <strong>pending warden approval</strong>. You'll receive an email once approved, and then you can log in.` +
      `<br><br>` +
      `<strong>What you can do once approved:</strong>` +
      features +
      `<div style="text-align:center;margin-top:16px;font-size:15px;color:${this.BRAND};font-weight:700;">॥ जय महेश ॥</div>`;

    const text =
      `Hi ${fullName},\n\nThank you for joining AIFDMS Hostel App as a ${roleLabel}!\n\n` +
      `Your account is pending warden approval. You'll receive an email once approved.\n\n` +
      `— AIFDMS Hostel · ॥ जय महेश ॥`;

    const html = this.baseHtml('Welcome to AIFDMS Hostel! 🎉', bodyHtml);
    await this.sendMail(to, `Welcome to AIFDMS Hostel, ${fullName}!`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  3. NEW DEVICE LOGIN ALERT
  // ═══════════════════════════════════════════════════════════════════

  async sendLoginAlert(to: string, fullName: string, info: DeviceInfo) {
    const location = [info.city, info.country].filter(Boolean).join(', ') || 'Unknown';

    const card = this.infoCard([
      ['Device', info.device],
      ['Browser', info.browser],
      ['OS', info.os],
      ['Location', location],
      ['IP Address', info.ip],
      ['Time', info.time],
    ]);

    const bodyHtml =
      `Hi <strong>${fullName}</strong>, we noticed a new sign-in to your AIFDMS Hostel account.` +
      card;

    const text =
      `Hi ${fullName},\n\nNew sign-in detected on your AIFDMS Hostel account.\n\n` +
      `Device: ${info.device}\nBrowser: ${info.browser}\nOS: ${info.os}\n` +
      `Location: ${location}\nIP: ${info.ip}\nTime: ${info.time}\n\n` +
      `If this wasn't you, change your password immediately and contact the warden.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml(
      'New sign-in to your account',
      bodyHtml,
      `<strong>If this wasn't you</strong>, change your password immediately using "Forgot Password" and contact the warden right away. Your account may be compromised.`,
    );

    await this.sendMail(to, `New sign-in to your AIFDMS Hostel account`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  4. PASSWORD CHANGED
  // ═══════════════════════════════════════════════════════════════════

  async sendPasswordChanged(to: string, fullName: string) {
    const bodyHtml =
      `Hi <strong>${fullName}</strong>, the password for your AIFDMS Hostel account was <strong>successfully changed</strong>.` +
      `<br><br>` +
      `If you made this change, no further action is needed.`;

    const text =
      `Hi ${fullName},\n\nYour AIFDMS Hostel password was successfully changed.\n\n` +
      `If you didn't make this change, contact the warden immediately and reset your password.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml(
      'Your password was changed',
      bodyHtml,
      `<strong>If you didn't make this change</strong>, your account may be compromised. Contact the warden immediately and use "Forgot Password" to secure your account.`,
    );

    await this.sendMail(to, `Your AIFDMS Hostel password was changed`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  5. ACCOUNT APPROVED
  // ═══════════════════════════════════════════════════════════════════

  async sendAccountApproved(to: string, fullName: string) {
    const bodyHtml =
      `Hi <strong>${fullName}</strong>, great news — the warden has <strong>approved</strong> your AIFDMS Hostel account! 🎉` +
      `<br><br>` +
      `You can now <strong>log in</strong> to the app and start using all features.` +
      `<br><br>` +
      `<strong>Get started:</strong>` +
      `<ul style="padding-left:20px;margin:12px 0;">
         <li>Open the AIFDMS Hostel App or visit the web version</li>
         <li>Log in with your registered email and password</li>
         <li>Complete your profile and upload documents</li>
       </ul>` +
      `<div style="text-align:center;margin-top:16px;font-size:15px;color:${this.BRAND};font-weight:700;">॥ जय महेश ॥</div>`;

    const text =
      `Hi ${fullName},\n\nGreat news — the warden has approved your AIFDMS Hostel account!\n\n` +
      `You can now log in to the app.\n\n— AIFDMS Hostel · ॥ जय महेश ॥`;

    const html = this.baseHtml("You're approved! 🎉", bodyHtml);
    await this.sendMail(to, `Your AIFDMS Hostel account is approved!`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  6. ACCOUNT REJECTED
  // ═══════════════════════════════════════════════════════════════════

  async sendAccountRejected(to: string, fullName: string, reason?: string) {
    const reasonText = reason
      ? `<br><br><strong>Reason:</strong> ${reason}`
      : `<br><br>No specific reason was provided.`;

    const bodyHtml =
      `Hi <strong>${fullName}</strong>, unfortunately your AIFDMS Hostel account request was <strong>not approved</strong>.` +
      reasonText +
      `<br><br>` +
      `You can <strong>re-apply</strong> from the Sign Up page if you'd like to try again. If you have questions, please speak to the warden directly.`;

    const text =
      `Hi ${fullName},\n\nYour AIFDMS Hostel account request was not approved.\n\n` +
      `Reason: ${reason || 'No specific reason was provided.'}\n\n` +
      `You can re-apply from the Sign Up page.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml('Account request not approved', bodyHtml);
    await this.sendMail(to, `Your AIFDMS Hostel account request was not approved`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  7. ACCOUNT REMOVED
  // ═══════════════════════════════════════════════════════════════════

  async sendAccountRemoved(to: string, fullName: string) {
    const bodyHtml =
      `Hi <strong>${fullName}</strong>, your AIFDMS Hostel account has been <strong>removed</strong> by the warden.` +
      `<br><br>` +
      `All your data (profile, documents, attendance, meals, complaints) has been deleted.` +
      `<br><br>` +
      `If you believe this was a mistake, please contact the warden directly to resolve the issue.`;

    const text =
      `Hi ${fullName},\n\nYour AIFDMS Hostel account has been removed by the warden.\n\n` +
      `If you believe this was a mistake, please contact the warden directly.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml(
      'Account removed',
      bodyHtml,
      `If you did not expect this, contact the warden directly to clarify the situation.`,
    );

    await this.sendMail(to, `Your AIFDMS Hostel account has been removed`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  8. WARDEN: NEW JOIN REQUEST
  // ═══════════════════════════════════════════════════════════════════

  async sendWardenNewRequest(to: string, applicantName: string, role: string, email: string) {
    const roleLabel = role === 'cook' ? 'Cook' : 'Student';

    const card = this.infoCard([
      ['Name', applicantName],
      ['Role', roleLabel],
      ['Email', email],
    ]);

    const bodyHtml =
      `A new user wants to join AIFDMS Hostel.` +
      card +
      `Open the <strong>Requests</strong> tab in the AIFDMS Hostel App to approve or reject this request.`;

    const text =
      `New join request on AIFDMS Hostel.\n\n` +
      `Name: ${applicantName}\nRole: ${roleLabel}\nEmail: ${email}\n\n` +
      `Open the app to approve or reject.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml('📋 New join request', bodyHtml);
    await this.sendMail(to, `New join request: ${applicantName} (${roleLabel})`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  9. WARDEN: NEW LEAVE REQUEST
  // ═══════════════════════════════════════════════════════════════════

  async sendWardenLeaveRequest(
    to: string,
    studentName: string,
    startDate: string,
    endDate: string,
    reason: string,
  ) {
    const card = this.infoCard([
      ['Student', studentName],
      ['From', startDate],
      ['To', endDate],
      ['Reason', reason],
    ]);

    const bodyHtml =
      `A student has applied for leave.` +
      card +
      `Attendance has been <strong>auto-marked absent</strong> and meals cleared for the leave period.`;

    const text =
      `New leave request on AIFDMS Hostel.\n\n` +
      `Student: ${studentName}\nFrom: ${startDate}\nTo: ${endDate}\nReason: ${reason}\n\n` +
      `Attendance auto-marked absent. Meals cleared.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml('🏖️ New leave request', bodyHtml);
    await this.sendMail(to, `Leave request: ${studentName} (${startDate} → ${endDate})`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  10. WARDEN: NEW COMPLAINT FILED
  // ═══════════════════════════════════════════════════════════════════

  async sendWardenNewComplaint(
    to: string,
    studentName: string,
    title: string,
    category: string,
    priority: string,
  ) {
    const card = this.infoCard([
      ['Student', studentName],
      ['Category', category],
      ['Priority', priority.charAt(0).toUpperCase() + priority.slice(1)],
      ['Title', title],
    ]);

    const bodyHtml =
      `A student has filed a new complaint.` +
      card +
      `Open the <strong>Complaints</strong> tab in the app to triage and respond.`;

    const text =
      `New complaint on AIFDMS Hostel.\n\n` +
      `Student: ${studentName}\nCategory: ${category}\nPriority: ${priority}\nTitle: ${title}\n\n` +
      `Open the app to respond.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml('📝 New complaint filed', bodyHtml);
    await this.sendMail(to, `New complaint: ${title} (${category})`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  11. COMPLAINT RESOLVED → STUDENT
  // ═══════════════════════════════════════════════════════════════════

  async sendComplaintResolved(to: string, fullName: string, complaintTitle: string) {
    const bodyHtml =
      `Hi <strong>${fullName}</strong>, your complaint has been <strong>resolved</strong>.` +
      `<br><br>` +
      this.infoCard([['Complaint', complaintTitle]]) +
      `If you're satisfied with the resolution, no further action is needed. If the issue persists, you can file a new complaint from the app.`;

    const text =
      `Hi ${fullName},\n\nYour complaint "${complaintTitle}" has been resolved.\n\n` +
      `If the issue persists, you can file a new complaint.\n\n— AIFDMS Hostel`;

    const html = this.baseHtml('✅ Complaint resolved', bodyHtml);
    await this.sendMail(to, `Your complaint "${complaintTitle}" has been resolved`, html, text);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BATCH: GREETING FOR EXISTING USERS (one-time catch-up)
  // ═══════════════════════════════════════════════════════════════════

  async sendExistingUserGreeting(to: string, fullName: string, role: string) {
    const roleLabel = role === 'cook' ? 'Cook' : role === 'warden' ? 'Warden' : 'Student';

    const features = role === 'warden'
      ? `<ul style="padding-left:20px;margin:12px 0;">
           <li>📋 <strong>New join requests</strong> — emailed when someone signs up</li>
           <li>🏖️ <strong>Leave applications</strong> — emailed when a student applies for leave</li>
           <li>📝 <strong>New complaints</strong> — emailed when a complaint is filed</li>
         </ul>`
      : role === 'cook'
      ? `<ul style="padding-left:20px;margin:12px 0;">
           <li>🔐 <strong>Login alerts</strong> — get notified when someone signs into your account</li>
           <li>🔑 <strong>Password change alerts</strong> — know immediately if your password is changed</li>
         </ul>`
      : `<ul style="padding-left:20px;margin:12px 0;">
           <li>🔐 <strong>Login alerts</strong> — get notified with device & location info when someone signs into your account</li>
           <li>🔑 <strong>Password change alerts</strong> — know immediately if your password is changed</li>
           <li>✅ <strong>Complaint updates</strong> — get emailed when your complaint is resolved</li>
         </ul>`;

    const bodyHtml =
      `Hi <strong>${fullName}</strong>! 👋` +
      `<br><br>` +
      `We've added <strong>email notifications</strong> to the AIFDMS Hostel App to keep you informed and your account secure.` +
      `<br><br>` +
      `<strong>What's new for you as a ${roleLabel}:</strong>` +
      features +
      `All security emails include a <strong>"contact the warden"</strong> prompt in case something looks suspicious.` +
      `<br><br>` +
      `No action needed — these emails will be sent automatically going forward. Just keep using the app as usual!` +
      `<div style="text-align:center;margin-top:20px;font-size:15px;color:${this.BRAND};font-weight:700;">॥ जय महेश ॥</div>`;

    const text =
      `Hi ${fullName},\n\n` +
      `We've added email notifications to the AIFDMS Hostel App!\n\n` +
      `You'll now get emails for login alerts, password changes, and more.\n` +
      `No action needed — just keep using the app.\n\n` +
      `— AIFDMS Hostel · ॥ जय महेश ॥`;

    const html = this.baseHtml('🔔 New: Email notifications are here!', bodyHtml);
    await this.sendMail(to, `AIFDMS Hostel — Email notifications are now live!`, html, text);
  }
}
