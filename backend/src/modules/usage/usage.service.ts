import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsageService {
  constructor(private prisma: PrismaService) {}

  private todayUTC(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }

  /** Add foreground seconds for a user's current day. Capped per call so a
   *  bad client can't inflate numbers. */
  async addSeconds(hostelId: string, userId: string, seconds: number) {
    const s = Math.max(0, Math.min(Math.floor(seconds || 0), 600)); // <=10min/ping
    if (s === 0) return { added: 0 };
    const date = this.todayUTC();
    await this.prisma.usageDaily.upsert({
      where: { userId_date: { userId, date } },
      create: { hostelId, userId, date, seconds: s },
      update: { seconds: { increment: s } },
    });
    return { added: s };
  }

  /** Warden analytics: per-user minutes over the last N days + today + total. */
  async summary(hostelId: string, days = 7) {
    const since = this.todayUTC();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const today = this.todayUTC();

    const [users, rows] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          hostelId,
          role: { in: ['student', 'cook'] },
          deletedAt: null,
        },
        select: {
          id: true,
          fullName: true,
          role: true,
          studentProfile: { select: { roomNumber: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.usageDaily.findMany({
        where: { hostelId, date: { gte: since } },
        select: { userId: true, date: true, seconds: true },
      }),
    ]);

    const todayKey = today.toISOString().slice(0, 10);
    const byUser: Record<string, { total: number; today: number; activeDays: Set<string> }> = {};
    for (const r of rows) {
      const k = r.date.toISOString().slice(0, 10);
      const u = (byUser[r.userId] ??= { total: 0, today: 0, activeDays: new Set() });
      u.total += r.seconds;
      u.activeDays.add(k);
      if (k === todayKey) u.today += r.seconds;
    }

    const toMin = (s: number) => Math.round(s / 60);
    const result = users.map((u) => {
      const d = byUser[u.id];
      const activeDays = d ? d.activeDays.size : 0;
      const totalMin = d ? toMin(d.total) : 0;
      return {
        userId: u.id,
        name: u.fullName,
        role: u.role,
        room: u.studentProfile?.roomNumber ?? null,
        todayMinutes: d ? toMin(d.today) : 0,
        totalMinutes: totalMin,
        activeDays,
        avgMinutesPerActiveDay: activeDays ? Math.round(totalMin / activeDays) : 0,
      };
    });

    // Most-used first.
    result.sort((a, b) => b.totalMinutes - a.totalMinutes);
    return { days, generatedAt: new Date().toISOString(), users: result };
  }

  /** Developer view: every user across all hostels, with hostel name. */
  async summaryAllHostels(days = 7) {
    const since = this.todayUTC();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const today = this.todayUTC();
    const todayKey = today.toISOString().slice(0, 10);

    const [users, rows] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: { in: ['student', 'cook', 'warden'] }, deletedAt: null },
        select: {
          id: true,
          fullName: true,
          role: true,
          hostel: { select: { name: true } },
          studentProfile: { select: { roomNumber: true } },
        },
      }),
      this.prisma.usageDaily.findMany({
        where: { date: { gte: since } },
        select: { userId: true, date: true, seconds: true },
      }),
    ]);

    const byUser: Record<string, { total: number; today: number; days: Set<string> }> = {};
    for (const r of rows) {
      const k = r.date.toISOString().slice(0, 10);
      const u = (byUser[r.userId] ??= { total: 0, today: 0, days: new Set() });
      u.total += r.seconds;
      u.days.add(k);
      if (k === todayKey) u.today += r.seconds;
    }

    const toMin = (s: number) => Math.round(s / 60);
    const result = users.map((u) => {
      const d = byUser[u.id];
      const activeDays = d ? d.days.size : 0;
      const totalMinutes = d ? toMin(d.total) : 0;
      return {
        userId: u.id,
        name: u.fullName,
        role: u.role,
        hostel: u.hostel?.name ?? '',
        room: u.studentProfile?.roomNumber ?? null,
        todayMinutes: d ? toMin(d.today) : 0,
        totalMinutes,
        activeDays,
        avgMinutesPerActiveDay: activeDays ? Math.round(totalMinutes / activeDays) : 0,
      };
    });
    result.sort((a, b) => b.totalMinutes - a.totalMinutes);
    return { days, generatedAt: new Date().toISOString(), users: result };
  }

  /** One user's daily breakdown (for a detail view / chart). */
  async userDaily(hostelId: string, userId: string, days = 30) {
    const since = this.todayUTC();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const rows = await this.prisma.usageDaily.findMany({
      where: { hostelId, userId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, seconds: true },
    });
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      minutes: Math.round(r.seconds / 60),
    }));
  }
}
