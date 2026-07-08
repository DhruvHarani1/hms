import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/** Daily retention cleanup to keep the (free-tier) DB small. */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private prisma: PrismaService) {}

  private daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  }

  // Every day at 19:30 UTC (~1am IST).
  @Cron('30 19 * * *')
  async run() {
    const now = new Date();
    try {
      // Meal notifications (ready + daily menu) — gone after 1 day.
      const meals = await this.prisma.notification.deleteMany({
        where: { type: 'meal', createdAt: { lt: this.daysAgo(1) } },
      });
      // All other notifications — 30 days.
      const oldNotifs = await this.prisma.notification.deleteMany({
        where: { type: { not: 'meal' }, createdAt: { lt: this.daysAgo(30) } },
      });
      // Resolved/closed complaints — 2 days after last change.
      const complaints = await this.prisma.complaint.deleteMany({
        where: {
          status: { in: ['resolved', 'closed'] },
          updatedAt: { lt: this.daysAgo(2) },
        },
      });
      // Notices — 30 days after posting.
      const notices = await this.prisma.notice.deleteMany({
        where: { createdAt: { lt: this.daysAgo(30) } },
      });
      // Expired/used password reset codes.
      const resets = await this.prisma.passwordReset.deleteMany({
        where: { createdAt: { lt: this.daysAgo(1) } },
      });
      // Revoked or expired refresh tokens.
      const tokens = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
        },
      });
      // Old daily meal-menu sessions (only today's matters).
      const sessions = await this.prisma.mealSession.deleteMany({
        where: { createdAt: { lt: this.daysAgo(2) } },
      });
      // Usage analytics older than 90 days.
      const usage = await this.prisma.usageDaily.deleteMany({
        where: { date: { lt: this.daysAgo(90) } },
      });

      this.logger.log(
        `cleanup: mealNotif=${meals.count} oldNotif=${oldNotifs.count} ` +
          `complaints=${complaints.count} notices=${notices.count} ` +
          `resets=${resets.count} tokens=${tokens.count} sessions=${sessions.count} usage=${usage.count}`,
      );
    } catch (e: any) {
      this.logger.error(`cleanup failed: ${e?.message ?? e}`);
    }
  }
}
