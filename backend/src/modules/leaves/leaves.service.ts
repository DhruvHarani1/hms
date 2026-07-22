import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class LeavesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private mail: MailService,
  ) {}

  private parseDate(input: string): Date {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private eachDate(start: Date, end: Date): Date[] {
    const out: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      out.push(new Date(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }

  /** Create leave → auto-mark attendance absent + clear meals for the range → notify wardens. */
  async create(
    hostelId: string,
    studentId: string,
    dto: { startDate: string; endDate: string; reason: string },
  ) {
    const start = this.parseDate(dto.startDate);
    const end = this.parseDate(dto.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid dates');
    }
    if (end < start) {
      throw new BadRequestException('End date must be on/after start date');
    }
    const dates = this.eachDate(start, end);
    if (dates.length > 90) {
      throw new BadRequestException('Leave range too long (max 90 days)');
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        hostelId,
        studentId,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    });

    // Mark each day absent (viaLeave) + clear that day's meals.
    await this.prisma.$transaction([
      ...dates.map((date) =>
        this.prisma.attendance.upsert({
          where: { studentId_date: { studentId, date } },
          create: { hostelId, studentId, date, viaLeave: true },
          update: { viaLeave: true },
        }),
      ),
      this.prisma.mealAttendance.deleteMany({
        where: {
          studentId,
          mealType: { in: ['lunch', 'dinner'] },
          date: { gte: start, lte: end },
        },
      }),
    ]);

    // Notify wardens.
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { fullName: true },
    });
    await this.notifications.notifyWardens(
      hostelId,
      '🏖️ New leave request',
      `${student?.fullName ?? 'A student'} is on leave ${dto.startDate} → ${dto.endDate} (${dto.reason})`,
      { leaveId: leave.id, studentId },
      studentId,
    );

    // Fire-and-forget: email all wardens about the leave.
    this.prisma.user
      .findMany({
        where: { hostelId, role: { in: ['warden', 'staff'] as any }, status: 'active', deletedAt: null },
        select: { email: true },
      })
      .then((wardens) => {
        for (const w of wardens) {
          this.mail
            .sendWardenLeaveRequest(w.email, student?.fullName ?? 'A student', dto.startDate, dto.endDate, dto.reason)
            .catch(() => {});
        }
      })
      .catch(() => {});

    return leave;
  }

  async listForWarden(hostelId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { hostelId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async listForStudent(studentId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
