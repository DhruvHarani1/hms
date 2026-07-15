import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MealsService } from './meals.service';
import { MealsController } from './meals.controller';
import { MealExportService } from './meal-export.service';
import { MealMenuService } from './meal-menu.service';
import { MealReviewService } from './meal-review.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [MealsController],
  providers: [MealsService, MealExportService, MealMenuService, MealReviewService],
  exports: [MealsService],
})
export class MealsModule {}
