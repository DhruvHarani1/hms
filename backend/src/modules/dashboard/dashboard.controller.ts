import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { MealsService } from '../meals/meals.service';
import { GamificationService } from '../gamification/gamification.service';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Last `n` UTC-midnight dates ending today (IST), oldest first. */
function lastNDates(n: number): Date[] {
  const istMs = Date.now() + (5 * 60 + 30) * 60 * 1000;
  const todayIST = new Date(istMs).toISOString().slice(0, 10);
  const todayUTC = new Date(todayIST);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(todayUTC);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return d;
  });
}

@Controller('dashboard')
export class DashboardController {
  constructor(
    private prisma: PrismaService,
    private meals: MealsService,
    private gamification: GamificationService,
  ) {}

  @Roles('warden', 'staff')
  @Get('warden')
  async warden(@CurrentUser() user: AuthUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hostelId = user.hostelId;

    const [
      totalStudents,
      pendingComplaints,
      inProgressComplaints,
      todaySessions,
      ateToday,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { hostelId, role: 'student', status: 'active', deletedAt: null },
      }),
      this.prisma.complaint.count({
        where: { hostelId, status: 'pending' },
      }),
      this.prisma.complaint.count({
        where: { hostelId, status: 'in_progress' },
      }),
      this.prisma.mealSession.findMany({ where: { hostelId, date: today } }),
      this.meals.ateTodayCount(hostelId),
    ]);

    return {
      totalStudents,
      pendingComplaints,
      inProgressComplaints,
      ateToday,
      todayMeals: {
        ateToday,
        sessionsMarkedReady: todaySessions.map((s) => s.mealType),
      },
    };
  }

  @Roles('warden', 'staff')
  @Get('analytics')
  async analytics(@CurrentUser() user: AuthUser, @Query('days') daysParam?: string) {
    const hostelId = user.hostelId;
    const days = Math.min(Math.max(parseInt(daysParam ?? '14', 10) || 14, 7), 60);
    const dates = lastNDates(days);
    const rangeStart = dates[0];
    const rangeEndExclusive = new Date(dates[days - 1]);
    rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

    const totalStudents = await this.prisma.user.count({
      where: { hostelId, role: 'student', status: 'active', deletedAt: null },
    });

    // ── Meal trend: % of students who ate (lunch or dinner) each day ──
    const optOutRows = await this.prisma.mealAttendance.findMany({
      where: {
        hostelId,
        mealType: { in: ['lunch', 'dinner'] },
        status: { in: ['absent', 'opted_out'] },
        date: { gte: rangeStart, lt: rangeEndExclusive },
      },
      select: { date: true, studentId: true, mealType: true },
    });
    const optOutByDay = new Map<string, Map<string, { lunch: boolean; dinner: boolean }>>();
    for (const r of optOutRows) {
      const k = dateKey(r.date);
      if (!optOutByDay.has(k)) optOutByDay.set(k, new Map());
      const perStudent = optOutByDay.get(k)!;
      const entry = perStudent.get(r.studentId) ?? { lunch: false, dinner: false };
      if (r.mealType === 'lunch') entry.lunch = true;
      if (r.mealType === 'dinner') entry.dinner = true;
      perStudent.set(r.studentId, entry);
    }
    const mealTrend = dates.map((d) => {
      const k = dateKey(d);
      const perStudent = optOutByDay.get(k);
      let optedOutBoth = 0;
      if (perStudent) {
        for (const v of perStudent.values()) if (v.lunch && v.dinner) optedOutBoth++;
      }
      const ateCount = Math.max(0, totalStudents - optedOutBoth);
      return {
        date: k,
        ateCount,
        percentage: totalStudents > 0 ? Math.round((ateCount / totalStudents) * 100) : 0,
      };
    });

    // ── Attendance trend: % present each day (no row = present) ──
    const absentRows = await this.prisma.attendance.findMany({
      where: { hostelId, date: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { date: true, studentId: true },
    });
    const absentByDay = new Map<string, Set<string>>();
    for (const r of absentRows) {
      const k = dateKey(r.date);
      if (!absentByDay.has(k)) absentByDay.set(k, new Set());
      absentByDay.get(k)!.add(r.studentId);
    }
    const attendanceTrend = dates.map((d) => {
      const k = dateKey(d);
      const absentCount = absentByDay.get(k)?.size ?? 0;
      const presentCount = Math.max(0, totalStudents - absentCount);
      return {
        date: k,
        presentCount,
        percentage: totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0,
      };
    });

    // ── Complaints by category ──
    const categoryGroups = await this.prisma.complaint.groupBy({
      by: ['categoryId'],
      where: { hostelId, createdAt: { gte: rangeStart } },
      _count: { _all: true },
    });
    const categories = await this.prisma.complaintCategory.findMany({
      where: { hostelId },
      select: { id: true, name: true },
    });
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    const complaintsByCategory = categoryGroups
      .map((g) => ({
        category: g.categoryId ? categoryNames.get(g.categoryId) ?? 'Uncategorized' : 'Uncategorized',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Complaints by status (current snapshot, all-time) ──
    const statusGroups = await this.prisma.complaint.groupBy({
      by: ['status'],
      where: { hostelId },
      _count: { _all: true },
    });
    const complaintsByStatus = statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));

    return { days, mealTrend, attendanceTrend, complaintsByCategory, complaintsByStatus };
  }

  @Get('leaderboard')
  async leaderboard(@CurrentUser() user: AuthUser) {
    return this.gamification.getLeaderboard(user.hostelId);
  }

  @Get('student')
  async student(@CurrentUser() user: AuthUser) {
    const hostelId = user.hostelId;

    const [profile, mealStats, unread, openComplaints, latestNotices, gamification] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user.userId },
          include: { studentProfile: true },
        }),
        this.meals.myStats(user.userId),
        this.prisma.notificationRecipient.count({
          where: { userId: user.userId, readAt: null },
        }),
        this.prisma.complaint.count({
          where: {
            studentId: user.userId,
            status: { in: ['pending', 'in_progress'] },
          },
        }),
        this.prisma.notice.findMany({
          where: { hostelId },
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
          take: 5,
        }),
        this.gamification.getStudentGamification(user.userId),
      ]);

    return {
      profile: profile
        ? {
            fullName: profile.fullName,
            email: profile.email,
            roomNumber: profile.studentProfile?.roomNumber ?? null,
          }
        : null,
      mealStats,
      unreadNotifications: unread,
      openComplaints,
      latestNotices,
      gamification,
    };
  }
}
