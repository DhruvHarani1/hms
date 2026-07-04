import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MealsService } from './meals.service';
import { MealsController } from './meals.controller';
import { MealExportService } from './meal-export.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MealsController],
  providers: [MealsService, MealExportService],
  exports: [MealsService],
})
export class MealsModule {}
