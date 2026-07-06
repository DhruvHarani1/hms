import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
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
  ) {}

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
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
          },
        });
        await this.prisma.studentProfile.updateMany({
          where: { userId: existing.id },
          data: {
            rollNo: dto.rollNo,
            roomNumber: dto.roomNumber,
          },
        });
        return { status: 'pending', reapplied: true };
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

    return { status: 'pending', reapplied: false, role };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
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

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: this.sha256(rawToken), expiresAt },
    });

    // MVP: email delivery is deferred — return the token in dev so it's testable.
    const devToken =
      process.env.NODE_ENV === 'production' ? undefined : rawToken;
    return { success: true, devToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.sha256(dto.token);
    const reset = await this.prisma.passwordReset.findFirst({
      where: { tokenHash, usedAt: null },
    });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all existing sessions on password change.
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
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
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, hostel: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }
}
