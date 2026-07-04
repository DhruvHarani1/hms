import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type Meal = 'lunch' | 'dinner';
type BulkMeal = 'lunch' | 'dinner' | 'both';

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  /** "YYYY-MM-DD" (or today) → UTC-midnight Date (stable @db.Date keys). */
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
    year: number;
    mon: number; // 0-based
    start: Date;
    end: Date;
    days: number;
    label: string;
  } {
    const now = new Date();
    let year = now.getUTCFullYear();
    let mon = now.getUTCMonth();
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
    return { year, mon, start, end, days, label };
  }

  private allMonthDates(year: number, mon: number, days: number): Date[] {
    return Array.from({ length: days }, (_, i) =>
      new Date(Date.UTC(year, mon, i + 1)),
    );
  }

  /* ── Single meal mark/unmark (lunch or dinner only) ───────────── */

  async setMeal(
    hostelId: string,
    studentId: string,
    dateStr: string,
    meal: Meal,
    marked: boolean,
  ) {
    const date = this.parseDate(dateStr);
    if (marked) {
      await this.prisma.mealAttendance.upsert({
        where: {
          studentId_date_mealType: { studentId, date, mealType: meal },
        },
        create: {
          hostelId,
          studentId,
          date,
          mealType: meal,
          status: 'present',
          source: 'self',
        },
        update: { status: 'present', markedAt: new Date() },
      });
    } else {
      await this.prisma.mealAttendance.deleteMany({
        where: { studentId, date, mealType: meal },
      });
    }
    return { date: this.dateKey(date), meal, marked };
  }

  /* ── Bulk over a whole month ──────────────────────────────────── */

  async bulk(
    hostelId: string,
    studentId: string,
    month: string | undefined,
    meal: BulkMeal,
    marked: boolean,
  ) {
    const { year, mon, start, end, days } = this.monthRange(month);
    const meals: Meal[] = meal === 'both' ? ['lunch', 'dinner'] : [meal];

    if (marked) {
      const dates = this.allMonthDates(year, mon, days);
      const rows = dates.flatMap((date) =>
        meals.map((mealType) => ({
          hostelId,
          studentId,
          date,
          mealType,
          status: 'present' as const,
          source: 'self' as const,
        })),
      );
      // Unique (studentId,date,mealType) → skip existing.
      await this.prisma.mealAttendance.createMany({
        data: rows,
        skipDuplicates: true,
      });
    } else {
      await this.prisma.mealAttendance.deleteMany({
        where: {
          studentId,
          mealType: { in: meals },
          date: { gte: start, lt: end },
        },
      });
    }
    return this.monthData(studentId, month);
  }

  /* ── Read a student's month as a per-day meal map ─────────────── */

  async monthData(studentId: string, month?: string) {
    const { start, end, days, label } = this.monthRange(month);
    const rows = await this.prisma.mealAttendance.findMany({
      where: {
        studentId,
        mealType: { in: ['lunch', 'dinner'] },
        status: 'present',
        date: { gte: start, lt: end },
      },
      select: { date: true, mealType: true },
    });

    const map: Record<string, { lunch: boolean; dinner: boolean; breakfast: boolean }> =
      {};
    for (const r of rows) {
      const k = this.dateKey(r.date);
      if (!map[k]) map[k] = { lunch: false, dinner: false, breakfast: false };
      if (r.mealType === 'lunch') map[k].lunch = true;
      if (r.mealType === 'dinner') map[k].dinner = true;
    }
    // Breakfast is derived: on if lunch OR dinner.
    for (const k of Object.keys(map)) {
      map[k].breakfast = map[k].lunch || map[k].dinner;
    }

    const daysAte = Object.keys(map).length;
    return {
      month: label,
      daysInMonth: days,
      days: map,
      daysAte,
      percentage: Math.round((daysAte / days) * 100),
      summary: `Ate on ${daysAte} out of ${days} days.`,
    };
  }

  /** Dashboard stats (day counts). */
  async myStats(studentId: string, month?: string) {
    const data = await this.monthData(studentId, month);
    return {
      month: data.month,
      daysInMonth: data.daysInMonth,
      daysAte: data.daysAte,
      daysWithMeal: data.daysAte,
      mealsTaken: data.daysAte,
      percentage: data.percentage,
      summary: `You ate on ${data.daysAte} out of ${data.daysInMonth} days.`,
    };
  }

  async studentMonthForWarden(hostelId: string, studentId: string, month?: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, hostelId, role: 'student' },
      include: { studentProfile: true },
    });
    if (!student) return null;
    const data = await this.monthData(studentId, month);
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

  async ateTodayCount(hostelId: string) {
    const today = this.parseDate();
    const rows = await this.prisma.mealAttendance.findMany({
      where: {
        hostelId,
        mealType: { in: ['lunch', 'dinner'] },
        status: 'present',
        date: today,
      },
      select: { studentId: true },
    });
    return new Set(rows.map((r) => r.studentId)).size;
  }

  /* ── Export data (all active students × days × meals) ─────────── */

  async exportMatrix(hostelId: string, month?: string) {
    const { start, end, days, label } = this.monthRange(month);

    const students = await this.prisma.user.findMany({
      where: { hostelId, role: 'student', status: 'active', deletedAt: null },
      include: { studentProfile: true },
      orderBy: { fullName: 'asc' },
    });

    const rows = await this.prisma.mealAttendance.findMany({
      where: {
        hostelId,
        mealType: { in: ['lunch', 'dinner'] },
        status: 'present',
        date: { gte: start, lt: end },
      },
      select: { studentId: true, date: true, mealType: true },
    });

    // studentId -> dayNumber -> {lunch,dinner}
    const byStudent: Record<string, Record<number, { lunch: boolean; dinner: boolean }>> =
      {};
    for (const r of rows) {
      const day = r.date.getUTCDate();
      (byStudent[r.studentId] ??= {})[day] ??= { lunch: false, dinner: false };
      if (r.mealType === 'lunch') byStudent[r.studentId][day].lunch = true;
      if (r.mealType === 'dinner') byStudent[r.studentId][day].dinner = true;
    }

    return {
      month: label,
      days,
      students: students.map((s) => ({
        name: s.fullName,
        roomNumber: s.studentProfile?.roomNumber ?? '',
        perDay: byStudent[s.id] ?? {},
      })),
    };
  }
}
