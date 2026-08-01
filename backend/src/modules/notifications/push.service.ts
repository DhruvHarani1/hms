import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

/**
 * Wraps the Expo push service. In the MVP this sends real pushes if device
 * tokens are Expo tokens; otherwise it logs (so the flow is testable without
 * a physical device). Batching keeps it fast for thousands of students.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private expo = new Expo();

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, any> = {},
    options?: { channelId?: string; sound?: string },
  ): Promise<void> {
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    const invalidCount = tokens.length - validTokens.length;

    if (invalidCount > 0) {
      this.logger.debug(
        `Skipping ${invalidCount} non-Expo token(s) (dev/simulated).`,
      );
    }
    if (validTokens.length === 0) {
      this.logger.log(`[push:simulated] "${title}" — ${body}`);
      return;
    }

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      sound: (options?.sound ?? 'default') as any,
      title,
      body,
      data,
      priority: 'high',
      channelId: options?.channelId,
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        this.logger.error(`Push chunk failed: ${err}`);
      }
    }
    this.logger.log(`Pushed "${title}" to ${validTokens.length} device(s).`);
  }
}
