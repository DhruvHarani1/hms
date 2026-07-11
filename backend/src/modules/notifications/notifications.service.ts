import { Injectable } from '@nestjs/common';
import {
  MealType,
  NotificationType,
  NotificationPriority,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from './push.service';
import { WebPushService } from '../web-push/web-push.service';

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
    private webPush: WebPushService,
  ) {}

  /** Core: create one notification + recipient rows for the given users, then
   *  push (device) + web push. */
  private async notifyUsers(
    userIds: string[],
    params: {
      hostelId: string;
      type: NotificationType;
      title: string;
      body: string;
      data?: Record<string, any>;
      priority?: NotificationPriority;
      audience?: 'all' | 'individual';
      createdBy?: string;
    },
  ) {
    if (userIds.length === 0) return { notificationId: null, notified: 0 };

    const notification = await this.prisma.notification.create({
      data: {
        hostelId: params.hostelId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        priority: params.priority ?? 'normal',
        audience: params.audience ?? 'all',
        createdBy: params.createdBy,
        recipients: { create: userIds.map((id) => ({ userId: id })) },
      },
    });

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    await this.push.sendToTokens(
      tokens.map((t) => t.token),
      params.title,
      params.body,
      { notificationId: notification.id, type: params.type, ...params.data },
    );
    await this.webPush.sendToUsers(userIds, {
      title: params.title,
      body: params.body,
      data: { type: params.type },
    });

    return { notificationId: notification.id, notified: userIds.length };
  }

  /** Notify all active users of a hostel matching the given roles. */
  private async notifyRoles(
    roles: string[],
    params: {
      hostelId: string;
      type: NotificationType;
      title: string;
      body: string;
      data?: Record<string, any>;
      priority?: NotificationPriority;
      createdBy?: string;
    },
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        hostelId: params.hostelId,
        role: { in: roles as any },
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });
    return this.notifyUsers(users.map((u) => u.id), params);
  }

  /** Students only (announcements, notices). */
  private async fanOut(params: {
    hostelId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: NotificationPriority;
    createdBy?: string;
  }) {
    return this.notifyRoles(['student'], params);
  }

  /** Everyone in the hostel (meal-ready). */
  async notifyEveryone(params: {
    hostelId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: NotificationPriority;
    createdBy?: string;
  }) {
    return this.notifyRoles(['student', 'warden', 'staff', 'cook'], params);
  }

  /** Notify a specific set of user IDs (e.g. chat message recipients). */
  async notifySpecificUsers(userIds: string[], params: {
    hostelId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: NotificationPriority;
    createdBy?: string;
  }) {
    return this.notifyUsers(userIds, { ...params, audience: 'individual' });
  }

  /** Students + cook (daily menu). */
  async notifyStudentsAndCook(params: {
    hostelId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    createdBy?: string;
  }) {
    return this.notifyRoles(['student', 'cook'], params);
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

    // Mark today's meal session ready (UTC-midnight key to match menu setting).
    const n = new Date();
    const today = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    await this.prisma.mealSession.upsert({
      where: { hostelId_date_mealType: { hostelId, date: today, mealType } },
      create: {
        hostelId,
        date: today,
        mealType,
        ...(menu ? { menu } : {}),
        readyMarkedAt: new Date(),
        markedBy: wardenId,
      },
      update: {
        readyMarkedAt: new Date(),
        markedBy: wardenId,
        ...(menu ? { menu } : {}),
      },
    });

    // Meal-ready → notify everyone (students + warden + cook).
    return this.notifyEveryone({
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
    await this.webPush.sendToUsers(
      wardens.map((w) => w.id),
      { title, body, data: { type: 'individual' } },
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
