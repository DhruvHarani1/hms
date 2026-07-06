import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Web Push (VAPID) — real browser/PWA notifications, incl. iOS 16.4+ when the
 * site is installed to the Home Screen. Env:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@x.com)
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private ready = false;

  constructor(private prisma: PrismaService) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@aifdms.app';
    if (pub && priv) {
      webpush.setVapidDetails(subject, pub, priv);
      this.ready = true;
    }
  }

  publicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  async saveSubscription(userId: string, sub: any) {
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
    await this.prisma.webPushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      update: { userId },
    });
  }

  async removeSubscription(endpoint: string) {
    await this.prisma.webPushSubscription.deleteMany({ where: { endpoint } });
  }

  /** Send a web push to every subscription of the given users. */
  async sendToUsers(
    userIds: string[],
    payload: { title: string; body: string; data?: any },
  ) {
    if (!this.ready || userIds.length === 0) return;
    const subs = await this.prisma.webPushSubscription.findMany({
      where: { userId: { in: userIds } },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          )
          .catch(async (err: any) => {
            // 404/410 = subscription gone → clean up.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await this.prisma.webPushSubscription.deleteMany({
                where: { endpoint: s.endpoint },
              });
            } else {
              this.logger.warn(`web push failed: ${err?.statusCode ?? err}`);
            }
          }),
      ),
    );
  }
}
