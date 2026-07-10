import { Module } from '@nestjs/common';
import { BirthdayService } from './birthday.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [BirthdayService],
})
export class BirthdayModule {}
