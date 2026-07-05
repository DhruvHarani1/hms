import { Injectable } from '@nestjs/common';
import {
  MealType,
  NotificationType,
  NotificationPriority,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from './push.service';

type PushMeal = 'breakfast' | 'lunch' | 'dinner';

const MEAL_LABELS: Record<PushMeal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const MEAL_EMOJI: Record<PushMeal, string> = {
  breakfast: '🍳',
  lunch: '🍛',
  dinner: '🌙',
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  /**
   * Core fan-out: create one notification row, a recipient row per student,
   * and push to every registered device. Returns how many students were notified.
   */
  private async fanOut(params: {
    hostelId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: NotificationPriority;
    createdBy?: string;
  }) {
    const students = await this.prisma.user.findMany({
      where: {
        hostelId: params.hostelId,
        role: 'student',
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });

    const notification = await this.prisma.notification.create({
      data: {
        hostelId: params.hostelId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        priority: params.priority ?? 'normal',
        audience: 'all',
        createdBy: params.createdBy,
        recipients: {
          create: students.map((s) => ({ userId: s.id })),
        },
      },
    });

    // Collect device tokens for all recipients and push (batched).
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: students.map((s) => s.id) } },
      select: { token: true },
    });
    await this.push.sendToTokens(
      tokens.map((t) => t.token),
      params.title,
      params.body,
      { notificationId: notification.id, type: params.type, ...params.data },
    );

    return { notificationId: notification.id, notified: students.length };
  }

  async sendMealReady(
    hostelId: string,
    wardenId: string,
    mealType: PushMeal,
    menu?: string,
  ) {
    const label = MEAL_LABELS[mealType];
    const title = `${MEAL_EMOJI[mealType]} ${label} is ready`;
    const body = menu ? `${label} is ready. Today: ${menu}` : `${label} is ready.`;

    // Record/mark the meal session for today.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.mealSession.upsert({
      where: {
        hostelId_date_mealType: { hostelId, date: today, mealType },
      },
      create: {
        hostelId,
        date: today,
        mealType,
        menu,
        readyMarkedAt: new Date(),
        markedBy: wardenId,
      },
      update: { readyMarkedAt: new Date(), markedBy: wardenId, menu },
    });

    return this.fanOut({
      hostelId,
      type: 'meal',
      title,
      body,
      priority: 'high',
      createdBy: wardenId,
      data: { mealType },
    });
  }

  /** Notify all wardens/staff of a hostel (e.g. a new leave request). */
  async notifyWardens(
    hostelId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    createdBy?: string,
  ) {
    const wardens = await this.prisma.user.findMany({
      where: {
        hostelId,
        role: { in: ['warden', 'staff'] },
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (wardens.length === 0) return { notified: 0 };

    const notification = await this.prisma.notification.create({
      data: {
        hostelId,
        type: 'individual',
        title,
        body,
        data: data ?? {},
        priority: 'high',
        audience: 'individual',
        createdBy,
        recipients: { create: wardens.map((w) => ({ userId: w.id })) },
      },
    });

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: wardens.map((w) => w.id) } },
      select: { token: true },
    });
    await this.push.sendToTokens(
      tokens.map((t) => t.token),
      title,
      body,
      { notificationId: notification.id, type: 'individual', ...data },
    );
    return { notified: wardens.length };
  }

  async sendAnnouncement(
    hostelId: string,
    wardenId: string,
    title: string,
    body: string,
  ) {
    return this.fanOut({
      hostelId,
      type: 'announcement',
      title,
      body,
      createdBy: wardenId,
    });
  }

  async inbox(userId: string, unreadOnly = false) {
    return this.prisma.notificationRecipient.findMany({
      where: { userId, ...(unreadOnly && { readAt: null }) },
      include: { notification: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notificationRecipient.count({
      where: { userId, readAt: null },
    });
    return { unread: count };
  }

  async markRead(userId: string, recipientId: string) {
    await this.prisma.notificationRecipient.updateMany({
      where: { id: recipientId, userId },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notificationRecipient.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async history(hostelId: string) {
    return this.prisma.notification.findMany({
      where: { hostelId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { recipients: true } } },
    });
  }

  async registerDevice(userId: string, platform: any, token: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, platform, token },
      update: { userId, platform },
    });
    return { success: true };
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
    return { success: true };
  }
}
