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
    const subject = 'AIFDMS Hostel — password reset code';
    const text = `Your password reset code is ${code}. It expires in 15 minutes. If you didn't request this, ignore this email.`;
    const html = `<div style="font-family:sans-serif">
      <h2>AIFDMS Hostel</h2>
      <p>Your password reset code is:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:4px">${code}</p>
      <p>Expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>`;

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
}
