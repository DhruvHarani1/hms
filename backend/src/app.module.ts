import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MealsModule } from './modules/meals/meals.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NoticesModule } from './modules/notices/notices.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    UploadsModule,
    NotificationsModule,
    MealsModule,
    AttendanceModule,
    LeavesModule,
    ComplaintsModule,
    NoticesModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
