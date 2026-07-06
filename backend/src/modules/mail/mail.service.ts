import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * SMTP email via nodemailer. Env:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE(true/false), SMTP_USER, SMTP_PASS, MAIL_FROM
 * Works with Gmail (app password) or Brevo/any SMTP. If unset, emails are
 * logged instead of sent (dev fallback).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  isConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  private get() {
    if (this.transporter) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return this.transporter;
  }

  async sendResetCode(to: string, code: string) {
    const subject = `${code} is your AIFDMS Hostel password reset code`;
    const text =
      `AIFDMS Hostel\n\n` +
      `Your password reset code is: ${code}\n` +
      `This code expires in 15 minutes.\n\n` +
      `If you didn't request a password reset, you can safely ignore this email — your password stays unchanged.\n\n` +
      `— AIFDMS Hostel`;
    const html = this.resetHtml(code);

    if (!this.isConfigured()) {
      this.logger.warn(`[mail:dev] reset code for ${to}: ${code}`);
      return;
    }
    await this.get().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  }

  /** Branded, email-client-safe HTML (inline styles + tables). */
  private resetHtml(code: string): string {
    const brand = '#4f46e5';
    const spacedCode = code.split('').join(' ');
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Password reset</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:${brand};padding:28px 32px;text-align:center;">
          <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;">🏨 AIFDMS Hostel</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 32px 8px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
          <div style="font-size:20px;font-weight:700;margin:0 0 8px;">Reset your password</div>
          <div style="font-size:14px;line-height:22px;color:#475569;">We received a request to reset your AIFDMS Hostel password. Use the code below to continue. This code expires in <strong>15 minutes</strong>.</div>
        </td></tr>
        <!-- Code -->
        <tr><td style="padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:20px;">
              <div style="font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:${brand};">${spacedCode}</div>
            </td></tr>
          </table>
        </td></tr>
        <!-- Security note -->
        <tr><td style="padding:0 32px 24px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
          <div style="font-size:13px;line-height:20px;color:#64748b;">Didn't request this? You can safely ignore this email — your password will not change. Never share this code with anyone; AIFDMS staff will never ask for it.</div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-family:Segoe UI,Helvetica,Arial,sans-serif;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;">AIFDMS Hostel · Automated message, please do not reply.</div>
        </td></tr>
      </table>
      <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:16px;">© AIFDMS Hostel</div>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
