import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { MealsService } from '../meals/meals.service';
import { GamificationService } from '../gamification/gamification.service';

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
