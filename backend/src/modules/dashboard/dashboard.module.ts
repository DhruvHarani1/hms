import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { MealsService } from '../meals/meals.service';

@Module({
  controllers: [DashboardController],
  providers: [MealsService],
})
export class DashboardModule {}
