import { Injectable } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarkMealDto } from './dto/meals.dto';

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  /** Parse "YYYY-MM-DD" (or today) to a UTC-midnight Date so @db.Date keys are
   *  stable and round-trip exactly (no local-timezone off-by-one). */
  private parseDate(input?: string): Date {
    if (input) {
      const [y, m, d] = input.split('-').map(Number);
      if (y && m && d) return new Date(Date.UTC(y, m - 1, d));
    }
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }

  private dateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private monthRange(month?: string): {
    start: Date;
    end: Date;
    days: number;
    label: string;
  } {
    const now = new Date();
    let year = now.getUTCFullYear();
    let mon = now.getUTCMonth(); // 0-based
    if (month) {
      const [y, m] = month.split('-').map(Number);
      if (y && m) {
        year = y;
        mon = m - 1;
      }
    }
    const start = new Date(Date.UTC(year, mon, 1));
    const end = new Date(Date.UTC(year, mon + 1, 1));
    const days = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
    const label = `${year}-${String(mon + 1).padStart(2, '0')}`;
    return { start, end, days, label };
  }

  /* ── Day-level marking (one tick per day) ─────────────────────── */

  /** Mark or unmark a single day for a student. mealType 'day' is the
   *  calendar day-tick. Returns { date, marked }. */
  async setDay(
    hostelId: string,
    studentId: string,
    dateStr: string,
    marked: boolean,
  ) {
    const date = this.parseDate(dateStr);
    if (marked) {
      await this.prisma.mealAttendance.upsert({
        where: {
          studentId_date_mealType: { studentId, date, mealType: 'day' },
        },
        create: {
          hostelId,
          studentId,
          date,
          mealType: 'day',
          status: 'present',
          source: 'self',
        },
        update: { status: 'present', markedAt: new Date() },
      });
    } else {
      await this.prisma.mealAttendance.deleteMany({
        where: { studentId, date, mealType: 'day' },
      });
    }
    return { date: this.dateKey(date), marked };
  }

  /** All day-tick dates a student marked in a month → ['2026-07-03', ...]. */
  async monthDays(studentId: string, month?: string) {
    const { start, end, days, label } = this.monthRange(month);
    const rows = await this.prisma.mealAttendance.findMany({
      where: {
        studentId,
        mealType: 'day',
        status: 'present',
        date: { gte: start, lt: end },
      },
      select: { date: true },
    });
    const marked = rows.map((r) => this.dateKey(r.date)).sort();
    return {
      month: label,
      daysInMonth: days,
      markedDates: marked,
      daysAte: marked.length,
      percentage: Math.round((marked.length / days) * 100),
      summary: `Ate on ${marked.length} out of ${days} days.`,
    };
  }

  /* ── Legacy per-meal marking (kept; unused by new calendar) ───── */

  async markMeal(hostelId: string, studentId: string, dto: MarkMealDto) {
    const date = this.parseDate(dto.date);
    const status = dto.status ?? 'present';
    return Promise.all(
      dto.meals.map((mealType: MealType) =>
        this.prisma.mealAttendance.upsert({
          where: { studentId_date_mealType: { studentId, date, mealType } },
          create: { hostelId, studentId, date, mealType, status, source: 'self' },
          update: { status, markedAt: new Date() },
        }),
      ),
    );
  }

  async myAttendance(studentId: string, month?: string) {
    const { start, end } = this.monthRange(month);
    return this.prisma.mealAttendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });
  }

  /** Day-based monthly stats (drives student dashboard + reports). */
  async myStats(studentId: string, month?: string) {
    const { start, end, days, label } = this.monthRange(month);
    const rows = await this.prisma.mealAttendance.findMany({
      where: {
        studentId,
        mealType: 'day',
        status: 'present',
        date: { gte: start, lt: end },
      },
      select: { date: true },
    });
    const daysAte = new Set(rows.map((r) => this.dateKey(r.date))).size;
    return {
      month: label,
      daysInMonth: days,
      daysWithMeal: daysAte,
      daysAte,
      mealsTaken: daysAte,
      percentage: Math.round((daysAte / days) * 100),
      summary: `You ate on ${daysAte} out of ${days} days.`,
    };
  }

  async statsForStudent(hostelId: string, studentId: string, month?: string) {
    return this.myStats(studentId, month);
  }

  /** Warden view of one student's month calendar (read-only). */
  async studentMonthForWarden(
    hostelId: string,
    studentId: string,
    month?: string,
  ) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, hostelId, role: 'student' },
      include: { studentProfile: true },
    });
    if (!student) return null;
    const data = await this.monthDays(studentId, month);
    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        rollNo: student.studentProfile?.rollNo ?? null,
        roomNumber: student.studentProfile?.roomNumber ?? null,
      },
      ...data,
    };
  }

  /** Count of distinct students who marked a day-tick today. */
  async ateTodayCount(hostelId: string) {
    const today = this.parseDate();
    const rows = await this.prisma.mealAttendance.findMany({
      where: { hostelId, mealType: 'day', status: 'present', date: today },
      select: { studentId: true },
    });
    return new Set(rows.map((r) => r.studentId)).size;
  }

  async todaySessions(hostelId: string) {
    const today = this.parseDate();
    return this.prisma.mealSession.findMany({
      where: { hostelId, date: today },
    });
  }
}
