import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import * as argon2 from 'argon2';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { buildDeviceInfo } from '../../common/utils/device-info.util';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private mailError(e: any) {
    // eslint-disable-next-line no-console
    console.error('[mail] reset email failed:', e?.message ?? e);
  }

  private async signTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_TTL ?? '30d',
    });
    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.sha256(refreshToken),
        expiresAt,
      },
    });
  }

  private buildPayload(user: {
    id: string;
    role: string;
    hostelId: string;
    email: string;
  }): JwtPayload {
    return {
      sub: user.id,
      role: user.role,
      hostelId: user.hostelId,
      email: user.email,
    };
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  /**
   * Public self-registration → creates a PENDING student that a warden must
   * approve before they can log in. If a previously REJECTED user re-applies
   * with the same email, we flip them back to pending (re-request).
   * Note: Newly registered users must complete email OTP verification.
   */
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const passwordHash = await argon2.hash(dto.password);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException(
          'This email is already registered. Please log in.',
        );
      }
      if (existing.status === 'pending') {
        throw new BadRequestException(
          'A request for this email is already awaiting approval.',
        );
      }
      if (existing.status === 'rejected') {
        // Re-apply: reset to pending with fresh details.
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: dto.fullName,
            passwordHash,
            status: 'pending',
            rejectionReason: null,
            emailVerified: null, // Reset to trigger verification on re-apply
          },
        });
        await this.prisma.studentProfile.updateMany({
          where: { userId: existing.id },
          data: {
            rollNo: dto.rollNo,
            roomNumber: dto.roomNumber,
          },
        });

        // Send OTP verification email in background
        await this.generateAndSendOtp(email, dto.fullName);

        return { status: 'pending', emailVerified: false, email };
      }
      throw new BadRequestException('This email cannot be registered.');
    }

    // Single-tenant MVP: attach to the (one) hostel.
    const hostel = await this.prisma.hostel.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!hostel) {
      throw new BadRequestException(
        'No hostel is configured yet. Contact the warden.',
      );
    }

    const role = dto.role === 'cook' ? 'cook' : 'student';
    await this.prisma.user.create({
      data: {
        hostelId: hostel.id,
        role,
        fullName: dto.fullName,
        email,
        phone: dto.phone,
        passwordHash,
        status: 'pending',
        emailVerified: null, // Starts unverified
        // Only students get a profile record.
        ...(role === 'student'
          ? {
              studentProfile: {
                create: {
                  hostelId: hostel.id,
                  rollNo: dto.rollNo,
                  roomNumber: dto.roomNumber,
                },
              },
            }
          : {}),
      },
    });

    // Send verification OTP in background
    await this.generateAndSendOtp(email, dto.fullName);

    return { status: 'pending', emailVerified: false, email };
  }

  /** Generate a random 6-digit numeric OTP and email it to the user. */
  private async generateAndSendOtp(email: string, fullName: string) {
    const otp = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    await this.prisma.emailOtp.upsert({
      where: { email },
      create: { email, otp, expiresAt },
      update: { otp, expiresAt, createdAt: new Date() },
    });

    // Dev fallback: return or print dev OTP
    if (!this.mail.isConfigured()) {
      // eslint-disable-next-line no-console
      console.log(`[DEV OTP] Verification code for ${email} is: ${otp}`);
    }

    await this.mail.sendVerificationOtp(email, fullName, otp).catch((e) => this.mailError(e));
  }

  /** Verify the email OTP. Handles new email correction if provided. */
  async verifyOtp(email: string, otp: string, newEmail?: string) {
    const targetEmail = email.toLowerCase();
    const verification = await this.prisma.emailOtp.findUnique({
      where: { email: targetEmail },
    });

    if (!verification || verification.otp !== otp || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: targetEmail },
    });
    if (!user) {
      throw new BadRequestException('User account not found');
    }

    let finalEmail = targetEmail;
    if (newEmail) {
      const cleanNewEmail = newEmail.trim().toLowerCase();
      if (cleanNewEmail !== targetEmail) {
        const emailInUse = await this.prisma.user.findUnique({
          where: { email: cleanNewEmail },
        });
        if (emailInUse) {
          throw new BadRequestException('The new email address is already in use.');
        }
        finalEmail = cleanNewEmail;
      }
    }

    // Mark as verified & update email.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: finalEmail,
        emailVerified: new Date(),
      },
    });

    // Delete OTP records.
    await this.prisma.emailOtp.deleteMany({
      where: { email: { in: [targetEmail, finalEmail] } },
    });

    // Trigger registration emails to the warden and user welcome.
    this.sendRegistrationEmails(finalEmail, user.fullName, user.role, user.hostelId);

    // If they updated their email, return the updated email
    return { success: true, emailVerified: true, email: finalEmail };
  }

  /** Resend email verification OTP. Can update target email if newEmail is provided. */
  async resendOtp(email: string, newEmail?: string) {
    const targetEmail = email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: targetEmail },
    });
    if (!user) {
      throw new BadRequestException('User account not found');
    }

    let sendToEmail = targetEmail;
    if (newEmail) {
      const cleanNewEmail = newEmail.trim().toLowerCase();
      if (cleanNewEmail !== targetEmail) {
        const emailInUse = await this.prisma.user.findUnique({
          where: { email: cleanNewEmail },
        });
        if (emailInUse) {
          throw new BadRequestException('The new email address is already in use.');
        }
        sendToEmail = cleanNewEmail;
      }
    }

    // Generate and send OTP to the final destination
    await this.generateAndSendOtp(sendToEmail, user.fullName);
    return { success: true, sentTo: sendToEmail };
  }

  /** Fire-and-forget: send welcome email to user + new-request alert to wardens. */
  private sendRegistrationEmails(email: string, fullName: string, role: string, hostelId: string) {
    // Welcome email to the new user.
    this.mail.sendWelcome(email, fullName, role).catch((e) => this.mailError(e));

    // Notify all wardens about the new join request.
    this.prisma.user
      .findMany({
        where: { hostelId, role: { in: ['warden', 'staff'] as any }, status: 'active', deletedAt: null },
        select: { email: true },
      })
      .then((wardens) => {
        for (const w of wardens) {
          this.mail.sendWardenNewRequest(w.email, fullName, role, email).catch((e) => this.mailError(e));
        }
      })
      .catch((e) => this.mailError(e));
  }

  async login(dto: LoginDto, req?: Request) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Email verification guard for student accounts
    if (user.role === 'student' && !user.emailVerified) {
      throw new HttpException(
        {
          message: 'Please verify your email address to continue.',
          emailVerified: false,
          verifyEmailRequired: true,
          email: user.email,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Approval-gated login: give clear, specific reasons.
    if (user.status === 'pending') {
      throw new ForbiddenException(
        'Your join request is awaiting warden approval.',
      );
    }
    if (user.status === 'rejected') {
      throw new ForbiddenException(
        user.rejectionReason
          ? `Your request was rejected: ${user.rejectionReason}. You can re-apply from Sign up.`
          : 'Your request was rejected. You can re-apply from Sign up.',
      );
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Fire-and-forget: login alert email with device info.
    if (req) {
      buildDeviceInfo(req)
        .then((info) => this.mail.sendLoginAlert(user.email, user.fullName, info))
        .catch((e) => this.mailError(e));
    }

    const tokens = await this.signTokens(this.buildPayload(user));
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { ...tokens, user: this.sanitize(user) };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revokedAt: null },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    // Rotate: revoke the old, issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.signTokens(this.buildPayload(user));
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return { success: true };
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // Always respond success to avoid leaking which emails exist.
    if (!user) return { success: true };

    // 6-digit code.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Invalidate prior unused codes for this user.
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: this.sha256(code), expiresAt },
    });

    // Fire-and-forget: don't block the HTTP response on the SMTP handshake.
    this.mail
      .sendResetCode(user.email, code)
      .catch((e) => this.mailError(e));

    // In dev (no SMTP), return the code so it's testable.
    const devCode =
      process.env.NODE_ENV === 'production' || this.mail.isConfigured()
        ? undefined
        : code;
    return { success: true, devCode };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new BadRequestException('Invalid or expired code');

    const reset = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id, tokenHash: this.sha256(dto.code), usedAt: null },
    });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all existing sessions on password change.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Fire-and-forget: password changed confirmation email.
    this.mail.sendPasswordChanged(user.email, user.fullName).catch((e) => this.mailError(e));

    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const valid = await argon2.verify(user.passwordHash, dto.oldPassword);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Fire-and-forget: password changed confirmation email.
    this.mail.sendPasswordChanged(user.email, user.fullName).catch((e) => this.mailError(e));

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, hostel: true },
    });
    if (!user) throw new UnauthorizedException();

    // Force logout unverified student accounts
    if (user.role === 'student' && !user.emailVerified) {
      throw new UnauthorizedException('Email verification required');
    }

    return this.sanitize(user);
  }
}
