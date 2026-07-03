import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [NoticesController],
})
export class NoticesModule {}
