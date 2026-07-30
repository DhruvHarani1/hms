import { Module } from '@nestjs/common';
import { EditRequestsService } from './edit-requests.service';
import { EditRequestsController } from './edit-requests.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { MealsModule } from '../meals/meals.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AttendanceModule, MealsModule, NotificationsModule],
  controllers: [EditRequestsController],
  providers: [EditRequestsService],
  exports: [EditRequestsService],
})
export class EditRequestsModule {}
