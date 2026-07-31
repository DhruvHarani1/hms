import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Badge Definitions ───
export interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  hint: string;
  category: 'meals' | 'attendance' | 'community' | 'finance' | 'special';
}

const BADGE_DEFS: BadgeDef[] = [
  // Meal badges
  { id: 'first_bite',       name: 'First Bite',       icon: '🥄', desc: 'Ate your first meal',                        hint: 'Eat your first meal',                    category: 'meals' },
  { id: 'breakfast_person', name: 'Meal Regular',      icon: '🌅', desc: 'Ate 10+ meals total',                        hint: 'Eat 10 meals',                           category: 'meals' },
  { id: 'lunch_regular',    name: 'Lunch Regular',     icon: '☀️',  desc: 'Ate lunch 30 times',                        hint: 'Eat lunch 30 times',                     category: 'meals' },
  { id: 'dinner_fan',       name: 'Dinner Fan',        icon: '🌙', desc: 'Ate dinner 30 times',                       hint: 'Eat dinner 30 times',                    category: 'meals' },
  { id: 'iron_stomach',     name: 'Iron Stomach',      icon: '🦾', desc: 'Ate 50 total meals',                        hint: 'Eat 50 meals total',                     category: 'meals' },
  { id: 'foodie_week',      name: 'Foodie Week',       icon: '🔥', desc: 'All meals for 7 consecutive days',          hint: 'Eat all meals for 7 straight days',      category: 'meals' },
  { id: 'meal_machine',     name: 'Meal Machine',      icon: '💪', desc: '90%+ meal attendance this month',           hint: 'Get 90%+ meal attendance in a month',    category: 'meals' },

  // Attendance badges
  { id: 'home_body',        name: 'Home Body',         icon: '🏡', desc: '7-day attendance streak',                    hint: 'Be present for 7 straight days',         category: 'attendance' },
  { id: 'month_resident',   name: 'Month Resident',    icon: '🏆', desc: '30-day attendance streak',                   hint: 'Be present for 30 straight days',        category: 'attendance' },
  { id: 'century_club',     name: 'Century Club',      icon: '💯', desc: '100-day attendance streak',                  hint: 'Be present for 100 straight days',       category: 'attendance' },
  { id: 'always_here',      name: 'Always Here',       icon: '📍', desc: '95%+ monthly attendance',                    hint: 'Get 95%+ attendance in a month',         category: 'attendance' },

  // Community badges
  { id: 'first_voice',      name: 'First Voice',       icon: '📢', desc: 'Filed your first complaint',                hint: 'File your first complaint',              category: 'community' },
  { id: 'problem_solver',   name: 'Problem Solver',    icon: '✅', desc: 'Had 3 complaints resolved',                 hint: 'Get 3 complaints resolved',              category: 'community' },
  { id: 'community_champ',  name: 'Community Champ',   icon: '🏅', desc: 'Had 5 complaints resolved',                 hint: 'Get 5 complaints resolved',              category: 'community' },

  // Finance badges
  { id: 'first_split',      name: 'First Split',       icon: '💸', desc: 'Created or joined your first bill split',   hint: 'Create or join a bill split',            category: 'finance' },
  { id: 'budget_conscious',  name: 'Budget Conscious', icon: '📊', desc: 'Set a monthly budget',                      hint: 'Set a monthly budget',                   category: 'finance' },

  // Special badges
  { id: 'day_one',           name: 'Day One',          icon: '🎂', desc: 'Using the app for 30+ days',                hint: 'Keep using the app for 30 days',         category: 'special' },
  { id: 'veteran',           name: 'Veteran',          icon: '🎖️',  desc: 'Using the app for 90+ days',               hint: 'Keep using the app for 90 days',         category: 'special' },
  { id: 'og',                name: 'OG',               icon: '👑', desc: 'Using the app for 180+ days',               hint: 'Keep using the app for 180 days',        category: 'special' },
];

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // IMPORTANT — Inverted Data Model:
  //   Attendance table: row EXISTS = ABSENT, no row = PRESENT
  //   MealAttendance:   row with absent/opted_out = NOT eating
  //                     no row (or status=present) = IS eating
  //   So we query OPT-OUTS and subtract from totals.
  // ─────────────────────────────────────────────────────────────

  // ─── Streaks ───
  async computeStreaks(studentId: string) {
    const todayStr = this.todayIST();
    const today = this.parseDate(todayStr);

    // Start from YESTERDAY — today is still in progress
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Cap streaks at user registration date
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { createdAt: true },
    });
    const joinDate = user
      ? new Date(Date.UTC(user.createdAt.getUTCFullYear(), user.createdAt.getUTCMonth(), user.createdAt.getUTCDate()))
      : yesterday;

    const maxLookback = Math.min(
      120,
      Math.max(1, Math.floor((yesterday.getTime() - joinDate.getTime()) / 86400000) + 1),
    );

    const since = new Date(yesterday);
    since.setDate(since.getDate() - maxLookback);

    const [absences, mealOptOuts] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { studentId, date: { gte: since, lte: yesterday } },
        select: { date: true },
      }),
      // Inverted: query the opt-outs
      this.prisma.mealAttendance.findMany({
        where: {
          studentId,
          date: { gte: since, lte: yesterday },
          mealType: { in: ['lunch', 'dinner'] },
          status: { in: ['absent', 'opted_out'] },
        },
        select: { date: true, mealType: true },
      }),
    ]);

    const absentDates = new Set(absences.map((a) => a.date.toISOString().slice(0, 10)));

    // Meals: group by date → set of meal types SKIPPED
    const skippedByDate = new Map<string, Set<string>>();
    for (const m of mealOptOuts) {
      const d = m.date.toISOString().slice(0, 10);
      if (!skippedByDate.has(d)) skippedByDate.set(d, new Set());
      skippedByDate.get(d)!.add(m.mealType);
    }

    let attendanceStreak = 0;
    let mealStreak = 0;
    let perfectStreak = 0;

    const cursor = new Date(yesterday);
    for (let i = 0; i < maxLookback; i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const isPresent = !absentDates.has(dateStr);
      const skipped = skippedByDate.get(dateStr) ?? new Set();
      const ateAllMeals = !skipped.has('lunch') && !skipped.has('dinner');

      if (i === 0 || attendanceStreak === i) {
        if (isPresent) attendanceStreak = i + 1;
      }
      if (i === 0 || mealStreak === i) {
        if (ateAllMeals) mealStreak = i + 1;
      }
      if (i === 0 || perfectStreak === i) {
        if (isPresent && ateAllMeals) perfectStreak = i + 1;
      }

      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      attendance: { current: attendanceStreak, nextMilestone: this.nextMilestone(attendanceStreak) },
      meals:      { current: mealStreak,       nextMilestone: this.nextMilestone(mealStreak) },
      perfect:    { current: perfectStreak,    nextMilestone: this.nextMilestone(perfectStreak) },
    };
  }

  // ─── Weekly Activity Score ───
  async weeklyActivityScore(studentId: string) {
    const todayStr = this.todayIST();
    const today = this.parseDate(todayStr);
    const dayOfWeek = today.getUTCDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(monday.getDate() - mondayOffset);

    // Use yesterday as end — today is in progress
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const effectiveEnd = yesterday < monday ? monday : yesterday;
    const daysElapsed = Math.max(1, Math.floor((effectiveEnd.getTime() - monday.getTime()) / 86400000) + 1);

    const [absences, mealOptOuts] = await Promise.all([
      this.prisma.attendance.count({
        where: { studentId, date: { gte: monday, lte: effectiveEnd } },
      }),
      this.prisma.mealAttendance.count({
        where: {
          studentId,
          date: { gte: monday, lte: effectiveEnd },
          mealType: { in: ['lunch', 'dinner'] },
          status: { in: ['absent', 'opted_out'] },
        },
      }),
    ]);

    const daysPresent = daysElapsed - absences;
    const totalPossibleMeals = daysElapsed * 2;
    const mealsEaten = totalPossibleMeals - mealOptOuts;
    const totalEarned = daysPresent + mealsEaten;
    const totalPossible = daysElapsed + totalPossibleMeals;
    const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    return {
      percentage,
      daysPresent,
      daysTotal: daysElapsed,
      mealsEaten,
      mealsTotal: totalPossibleMeals,
    };
  }

  // ─── Badges ───
  async computeBadges(studentId: string) {
    const todayStr = this.todayIST();
    const today = this.parseDate(todayStr);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const dayOfMonth = today.getUTCDate();

    const [
      user,
      lunchOptOuts,
      dinnerOptOuts,
      totalMealOptOuts,
      totalComplaints,
      resolvedComplaints,
      totalSplits,
      hasBudget,
      monthAbsences,
      monthMealOptOuts,
      streaks,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: studentId }, select: { createdAt: true } }),
      this.prisma.mealAttendance.count({
        where: { studentId, mealType: 'lunch', status: { in: ['absent', 'opted_out'] } },
      }),
      this.prisma.mealAttendance.count({
        where: { studentId, mealType: 'dinner', status: { in: ['absent', 'opted_out'] } },
      }),
      this.prisma.mealAttendance.count({
        where: { studentId, mealType: { in: ['lunch', 'dinner'] }, status: { in: ['absent', 'opted_out'] } },
      }),
      this.prisma.complaint.count({ where: { studentId } }),
      this.prisma.complaint.count({ where: { studentId, status: 'resolved' } }),
      this.prisma.expenseSplit.count({ where: { userId: studentId } }),
      this.prisma.studentBudget.findFirst({ where: { userId: studentId } }),
      this.prisma.attendance.count({ where: { studentId, date: { gte: monthStart, lte: today } } }),
      this.prisma.mealAttendance.count({
        where: {
          studentId,
          date: { gte: monthStart, lte: today },
          mealType: { in: ['lunch', 'dinner'] },
          status: { in: ['absent', 'opted_out'] },
        },
      }),
      this.computeStreaks(studentId),
    ]);

    const daysSinceJoin = user ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000) : 0;
    const totalDays = Math.max(daysSinceJoin, 1);

    // Inverted: total possible - opt-outs = eaten
    const totalLunchEaten = Math.max(0, totalDays - lunchOptOuts);
    const totalDinnerEaten = Math.max(0, totalDays - dinnerOptOuts);
    const totalMealsEaten = Math.max(0, (totalDays * 2) - totalMealOptOuts);

    const monthAttendancePct = dayOfMonth > 0 ? ((dayOfMonth - monthAbsences) / dayOfMonth) * 100 : 0;
    const monthMealsEaten = (dayOfMonth * 2) - monthMealOptOuts;
    const monthMealPct = dayOfMonth > 0 ? (monthMealsEaten / (dayOfMonth * 2)) * 100 : 0;

    const checks: Record<string, boolean> = {
      first_bite:        totalMealsEaten >= 1,
      breakfast_person:  totalMealsEaten >= 10,
      lunch_regular:     totalLunchEaten >= 30,
      dinner_fan:        totalDinnerEaten >= 30,
      iron_stomach:      totalMealsEaten >= 50,
      foodie_week:       streaks.meals.current >= 7,
      meal_machine:      monthMealPct >= 90,
      home_body:         streaks.attendance.current >= 7,
      month_resident:    streaks.attendance.current >= 30,
      century_club:      streaks.attendance.current >= 100,
      always_here:       monthAttendancePct >= 95,
      first_voice:       totalComplaints >= 1,
      problem_solver:    resolvedComplaints >= 3,
      community_champ:   resolvedComplaints >= 5,
      first_split:       totalSplits >= 1,
      budget_conscious:  hasBudget !== null,
      day_one:           daysSinceJoin >= 30,
      veteran:           daysSinceJoin >= 90,
      og:                daysSinceJoin >= 180,
    };

    const earned: Array<BadgeDef & { earned: true }> = [];
    const locked: Array<BadgeDef & { earned: false }> = [];

    for (const badge of BADGE_DEFS) {
      if (checks[badge.id]) {
        earned.push({ ...badge, earned: true });
      } else {
        locked.push({ ...badge, earned: false });
      }
    }

    return { earned, locked, total: BADGE_DEFS.length, earnedCount: earned.length };
  }

  // ─── Full payload ───
  async getStudentGamification(studentId: string) {
    const [streaks, weeklyScore, badges] = await Promise.all([
      this.computeStreaks(studentId),
      this.weeklyActivityScore(studentId),
      this.computeBadges(studentId),
    ]);
    return { streaks, weeklyScore, badges };
  }

  // ─── Helpers ───

  private todayIST(): string {
    const istMs = Date.now() + (5 * 60 + 30) * 60 * 1000;
    return new Date(istMs).toISOString().slice(0, 10);
  }

  private parseDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private nextMilestone(current: number): number {
    const milestones = [7, 14, 30, 60, 100];
    for (const m of milestones) {
      if (current < m) return m;
    }
    return current + 50;
  }
}
