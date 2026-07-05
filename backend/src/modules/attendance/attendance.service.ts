import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

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

  private monthRange(month?: string) {
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

  /** Toggle a day. absent=true → mark absent (create row); false → present (delete). */
  async setAbsent(
    hostelId: string,
    studentId: string,
    dateStr: string,
    absent: boolean,
  ) {
    const date = this.parseDate(dateStr);
    if (absent) {
      await this.prisma.attendance.upsert({
        where: { studentId_date: { studentId, date } },
        create: { hostelId, studentId, date },
        update: {},
      });
    } else {
      await this.prisma.attendance.deleteMany({ where: { studentId, date } });
    }
    return { date: this.dateKey(date), absent };
  }

  async monthData(studentId: string, month?: string) {
    const { start, end, days, label } = this.monthRange(month);
    const rows = await this.prisma.attendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      select: { date: true },
    });
    const absentDates = rows.map((r) => this.dateKey(r.date)).sort();
    const presentDays = days - absentDates.length;
    return {
      month: label,
      daysInMonth: days,
      absentDates,
      absentDays: absentDates.length,
      presentDays,
      percentage: Math.round((presentDays / days) * 100),
      summary: `Present ${presentDays} of ${days} days.`,
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

  async exportMatrix(hostelId: string, month?: string) {
    const { start, end, days, label } = this.monthRange(month);
    const students = await this.prisma.user.findMany({
      where: { hostelId, role: 'student', status: 'active', deletedAt: null },
      include: { studentProfile: true },
      orderBy: { fullName: 'asc' },
    });
    const rows = await this.prisma.attendance.findMany({
      where: { hostelId, date: { gte: start, lt: end } },
      select: { studentId: true, date: true },
    });
    const absentByStudent: Record<string, Set<number>> = {};
    for (const r of rows) {
      (absentByStudent[r.studentId] ??= new Set()).add(r.date.getUTCDate());
    }
    return {
      month: label,
      days,
      students: students.map((s) => ({
        name: s.fullName,
        roomNumber: s.studentProfile?.roomNumber ?? '',
        absent: absentByStudent[s.id] ?? new Set<number>(),
      })),
    };
  }
}
