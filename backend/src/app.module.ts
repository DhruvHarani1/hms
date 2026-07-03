import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MealsModule } from './modules/meals/meals.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { NoticesModule } from './modules/notices/notices.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    NotificationsModule,
    MealsModule,
    ComplaintsModule,
    NoticesModule,
    DashboardModule,
  ],
})
export class AppModule {}
