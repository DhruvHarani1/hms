import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { MealsService } from '../meals/meals.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [DashboardController],
  providers: [MealsService],
})
export class DashboardModule {}
