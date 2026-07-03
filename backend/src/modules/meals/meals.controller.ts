import { Body, Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { MealsService } from './meals.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { MarkMealDto } from './dto/meals.dto';

@Controller('meals')
export class MealsController {
  constructor(private readonly service: MealsService) {}

  @Post('attendance')
  @HttpCode(200)
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkMealDto) {
    return this.service.markMeal(user.hostelId, user.userId, dto);
  }

  @Get('attendance/me')
  myAttendance(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
  ) {
    return this.service.myAttendance(user.userId, month);
  }

  @Get('stats/me')
  myStats(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.service.myStats(user.userId, month);
  }

  @Roles('warden', 'staff')
  @Get('stats')
  statsForStudent(
    @CurrentUser() user: AuthUser,
    @Query('studentId') studentId: string,
    @Query('month') month?: string,
  ) {
    return this.service.statsForStudent(user.hostelId, studentId, month);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.service.todaySessions(user.hostelId);
  }
}
