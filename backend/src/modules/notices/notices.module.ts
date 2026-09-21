import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [NotificationsModule, UploadsModule],
  controllers: [NoticesController],
})
export class NoticesModule {}
