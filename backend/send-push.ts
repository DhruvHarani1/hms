import { PrismaClient } from '@prisma/client';
import { Expo } from 'expo-server-sdk';

const prisma = new PrismaClient();
const expo = new Expo();

async function main() {
  console.log('Fetching registered device tokens...');
  const devices = await prisma.deviceToken.findMany({
    select: { token: true },
  });

  const tokens = devices.map((d) => d.token).filter((t) => Expo.isExpoPushToken(t));
  console.log(`Found ${devices.length} tokens. Valid Expo tokens: ${tokens.length}`);

  if (tokens.length === 0) {
    console.log('No valid Expo push tokens found. Exiting.');
    return;
  }

  const title = '🚀 Update: Meal Ratings are Live!';
  const body = 'You can now rate and review meals directly in the app. Update or reload your app to check it out!';

  const messages = tokens.map((to) => ({
    to,
    sound: 'default' as const,
    title,
    body,
    priority: 'high' as const,
  }));

  console.log(`Sending notifications to ${tokens.length} devices...`);
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log('Sent chunk successfully. Tickets:', tickets);
    } catch (err) {
      console.error('Error sending chunk:', err);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
