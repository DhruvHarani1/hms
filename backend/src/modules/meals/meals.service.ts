import { Injectable } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarkMealDto } from './dto/meals.dto';

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  private parseDate(input?: string): Date {
    const d = input ? new Date(input) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private monthRange(month?: string): {
    start: Date;
    end: Date;
    days: number;
    label: string;
  } {
    const now = new Date();
    let year = now.getFullYear();
    let mon = now.getMonth(); // 0-based
    if (month) {
      const [y, m] = month.split('-').map(Number);
      if (y && m) {
        year = y;
        mon = m - 1;
      }
    }
    const start = new Date(year, mon, 1);
    const end = new Date(year, mon + 1, 1);
    const days = new Date(year, mon + 1, 0).getDate();
    // Label built from local year/month — avoid toISOString() UTC shift.
    const label = `${year}-${String(mon + 1).padStart(2, '0')}`;
    return { start, end, days, label };
  }

  async markMeal(
    hostelId: string,
    studentId: string,
    dto: MarkMealDto,
  ) {
    const date = this.parseDate(dto.date);
    const status = dto.status ?? 'present';

    const results = await Promise.all(
      dto.meals.map((mealType: MealType) =>
        this.prisma.mealAttendance.upsert({
          where: {
            studentId_date_mealType: { studentId, date, mealType },
          },
          create: {
            hostelId,
            studentId,
            date,
            mealType,
            status,
            source: 'self',
          },
          update: { status, markedAt: new Date() },
        }),
      ),
    );
    return results;
  }

  async myAttendance(studentId: string, month?: string) {
    const { start, end } = this.monthRange(month);
    return this.prisma.mealAttendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });
  }

  async myStats(studentId: string, month?: string) {
    const { start, end, days, label } = this.monthRange(month);
    const records = await this.prisma.mealAttendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
    });

    const present = records.filter((r) => r.status === 'present');
    // "Days with at least one meal" — the headline student stat.
    const daysWithMeal = new Set(
      present.map((r) => r.date.toISOString().slice(0, 10)),
    ).size;

    const byMeal = {
      breakfast: present.filter((r) => r.mealType === 'breakfast').length,
      lunch: present.filter((r) => r.mealType === 'lunch').length,
      dinner: present.filter((r) => r.mealType === 'dinner').length,
    };

    return {
      month: label,
      daysInMonth: days,
      daysWithMeal,
      mealsTaken: present.length,
      percentage: Math.round((daysWithMeal / days) * 100),
      byMeal,
      summary: `You had meals on ${daysWithMeal} out of ${days} days.`,
    };
  }

  async statsForStudent(
    hostelId: string,
    studentId: string,
    month?: string,
  ) {
    // Reuse myStats but scoped to a warden-selected student.
    return this.myStats(studentId, month);
  }

  async todaySessions(hostelId: string) {
    const today = this.parseDate();
    return this.prisma.mealSession.findMany({
      where: { hostelId, date: today },
    });
  }
}
