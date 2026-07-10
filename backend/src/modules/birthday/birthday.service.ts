import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

/**
 * Daily midnight (IST) cron: check for birthdays today and
 *  1. Send a birthday greeting email to the birthday person.
 *  2. Push a notification to ALL active users: "🎂 X's birthday is today!"
 */
@Injectable()
export class BirthdayService {
  private readonly logger = new Logger(BirthdayService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private mail: MailService,
  ) {}

  // Every day at 18:30 UTC = 12:00 AM IST (midnight).
  @Cron('30 18 * * *')
  async checkBirthdays() {
    this.logger.log('🎂 Running birthday check...');

    try {
      // Get today's month and day in IST.
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const ist = new Date(now.getTime() + istOffset);
      const todayMonth = ist.getUTCMonth() + 1; // 1-based
      const todayDay = ist.getUTCDate();

      // Find all student profiles where dob month+day matches today.
      // Prisma doesn't support EXTRACT() easily, so raw query:
      const birthdayProfiles = await this.prisma.$queryRaw<
        { user_id: string; full_name: string; email: string; hostel_id: string }[]
      >`
        SELECT sp.user_id, u.full_name, u.email, u.hostel_id
        FROM student_profiles sp
        JOIN users u ON u.id = sp.user_id
        WHERE sp.dob IS NOT NULL
          AND EXTRACT(MONTH FROM sp.dob) = ${todayMonth}
          AND EXTRACT(DAY FROM sp.dob) = ${todayDay}
          AND u.status = 'active'
          AND u.deleted_at IS NULL
      `;

      if (birthdayProfiles.length === 0) {
        this.logger.log('No birthdays today.');
        return;
      }

      this.logger.log(`🎂 Found ${birthdayProfiles.length} birthday(s) today!`);

      for (const b of birthdayProfiles) {
        // 1. Send birthday email to the person.
        this.mail
          .sendBirthdayGreeting(b.email, b.full_name)
          .catch((e) => this.logger.error(`Birthday email failed for ${b.email}: ${e?.message}`));

        // 2. Push notification to everyone in the hostel.
        this.notifications
          .notifyEveryone({
            hostelId: b.hostel_id,
            type: 'event',
            title: `🎂 Happy Birthday, ${b.full_name}!`,
            body: `Today is ${b.full_name}'s birthday! Wish them a wonderful day! 🎉`,
            data: { type: 'birthday', userId: b.user_id },
          })
          .catch((e) => this.logger.error(`Birthday notification failed: ${e?.message}`));
      }
    } catch (e: any) {
      this.logger.error(`Birthday check failed: ${e?.message ?? e}`);
    }
  }
}
