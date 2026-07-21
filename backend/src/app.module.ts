import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebPushModule } from './modules/web-push/web-push.module';
import { MealsModule } from './modules/meals/meals.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NoticesModule } from './modules/notices/notices.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { UsageModule } from './modules/usage/usage.module';
import { BirthdayModule } from './modules/birthday/birthday.module';
import { ChatModule } from './modules/chat/chat.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { HealthController } from './health.controller';
import { DownloadController } from './download.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    UploadsModule,
    NotificationsModule,
    WebPushModule,
    MealsModule,
    AttendanceModule,
    LeavesModule,
    ComplaintsModule,
    NoticesModule,
    DashboardModule,
    CleanupModule,
    UsageModule,
    BirthdayModule,
    ChatModule,
    ExpensesModule,
  ],
  controllers: [HealthController, DownloadController],
})
export class AppModule {}
