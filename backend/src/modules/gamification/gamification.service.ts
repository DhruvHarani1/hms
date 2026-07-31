import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Badge Definitions ───
// Each badge has: id, name, icon, description, category, and a check function
export interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  hint: string;        // shown when locked
  category: 'meals' | 'attendance' | 'community' | 'finance' | 'special';
}

const BADGE_DEFS: BadgeDef[] = [
  // Meal badges
  { id: 'first_bite',       name: 'First Bite',       icon: '🥄', desc: 'Marked your first meal',                     hint: 'Mark your first meal',                   category: 'meals' },
  { id: 'breakfast_person', name: 'Breakfast Person',  icon: '🌅', desc: 'Ate breakfast 10 times',                     hint: 'Eat breakfast 10 times',                 category: 'meals' },
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

  // ─── Streaks ───
  async computeStreaks(studentId: string) {
    const todayStr = this.todayIST();
    const today = this.parseDate(todayStr);

    // Get last 120 days of data in 2 parallel queries
    const since = new Date(today);
    since.setDate(since.getDate() - 120);

    const [absences, meals] = await Promise.all([
      // Attendance: a row means ABSENT
      this.prisma.attendance.findMany({
        where: { studentId, date: { gte: since, lte: today } },
        select: { date: true },
        orderBy: { date: 'desc' },
      }),
      // MealAttendance: status=present means ATE
      this.prisma.mealAttendance.findMany({
        where: { studentId, date: { gte: since, lte: today }, status: 'present' },
        select: { date: true, mealType: true },
        orderBy: { date: 'desc' },
      }),
    ]);

    // Build lookup sets
    const absentDates = new Set(absences.map((a) => a.date.toISOString().slice(0, 10)));

    // Meals: group by date -> set of meal types eaten
    const mealsByDate = new Map<string, Set<string>>();
    for (const m of meals) {
      const d = m.date.toISOString().slice(0, 10);
      if (!mealsByDate.has(d)) mealsByDate.set(d, new Set());
      mealsByDate.get(d)!.add(m.mealType);
    }

    // Walk backward from today counting streaks
    let attendanceStreak = 0;
    let mealStreak = 0;
    let perfectStreak = 0;

    const cursor = new Date(today);
    for (let i = 0; i < 120; i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const isPresent = !absentDates.has(dateStr);
      const mealsEaten = mealsByDate.get(dateStr) ?? new Set();
      const ateAllMeals = mealsEaten.has('lunch') && mealsEaten.has('dinner');

      // Attendance streak
      if (i === 0 || attendanceStreak === i) {
        if (isPresent) attendanceStreak = i + 1;
      }

      // Meal streak (lunch + dinner)
      if (i === 0 || mealStreak === i) {
        if (ateAllMeals) mealStreak = i + 1;
      }

      // Perfect streak (present + all meals)
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

    // Days elapsed this week (including today)
    const daysElapsed = mondayOffset + 1;

    const [absences, meals] = await Promise.all([
      this.prisma.attendance.count({
        where: { studentId, date: { gte: monday, lte: today } },
      }),
      this.prisma.mealAttendance.count({
        where: { studentId, date: { gte: monday, lte: today }, status: 'present' },
      }),
    ]);

    const daysPresent = daysElapsed - absences;
    const totalPossibleMeals = daysElapsed * 2; // lunch + dinner
    const totalEarned = daysPresent + meals;
    const totalPossible = daysElapsed + totalPossibleMeals; // days + meals
    const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    return {
      percentage,
      daysPresent,
      daysTotal: daysElapsed,
      mealsEaten: meals,
      mealsTotal: totalPossibleMeals,
    };
  }

  // ─── Badges ───
  async computeBadges(studentId: string) {
    const todayStr = this.todayIST();
    const today = this.parseDate(todayStr);

    // Month boundaries
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const dayOfMonth = today.getUTCDate();

    // Gather all stats in parallel
    const [
      totalMeals,
      breakfastCount,
      lunchCount,
      dinnerCount,
      totalComplaints,
      resolvedComplaints,
      totalSplits,
      hasBudget,
      user,
      monthAbsences,
      monthMeals,
      streaks,
    ] = await Promise.all([
      this.prisma.mealAttendance.count({ where: { studentId, status: 'present' } }),
      this.prisma.mealAttendance.count({ where: { studentId, status: 'present', mealType: 'breakfast' } }),
      this.prisma.mealAttendance.count({ where: { studentId, status: 'present', mealType: 'lunch' } }),
      this.prisma.mealAttendance.count({ where: { studentId, status: 'present', mealType: 'dinner' } }),
      this.prisma.complaint.count({ where: { studentId } }),
      this.prisma.complaint.count({ where: { studentId, status: 'resolved' } }),
      this.prisma.expenseSplit.count({ where: { userId: studentId } }),
      this.prisma.studentBudget.findFirst({ where: { userId: studentId } }),
      this.prisma.user.findUnique({ where: { id: studentId }, select: { createdAt: true } }),
      this.prisma.attendance.count({ where: { studentId, date: { gte: monthStart, lte: today } } }),
      this.prisma.mealAttendance.count({ where: { studentId, status: 'present', date: { gte: monthStart, lte: today } } }),
      this.computeStreaks(studentId),
    ]);

    const daysSinceJoin = user ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000) : 0;
    const monthAttendancePct = dayOfMonth > 0 ? ((dayOfMonth - monthAbsences) / dayOfMonth) * 100 : 0;
    const monthMealPct = dayOfMonth > 0 ? (monthMeals / (dayOfMonth * 2)) * 100 : 0;

    // Evaluate each badge
    const checks: Record<string, boolean> = {
      first_bite:        totalMeals >= 1,
      breakfast_person:  breakfastCount >= 10,
      lunch_regular:     lunchCount >= 30,
      dinner_fan:        dinnerCount >= 30,
      iron_stomach:      totalMeals >= 50,
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

  // ─── Full gamification payload for dashboard ───
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
    return current + 50; // beyond 100, next is +50
  }
}
