import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  HttpCode,
} from '@nestjs/common';
import { MealsService } from './meals.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { MarkDayDto, MarkMealDto } from './dto/meals.dto';

@Controller('meals')
export class MealsController {
  constructor(private readonly service: MealsService) {}

  // ── Day-level calendar (one tick per day) ──
  @Post('day')
  @HttpCode(200)
  setDay(@CurrentUser() user: AuthUser, @Body() dto: MarkDayDto) {
    return this.service.setDay(user.hostelId, user.userId, dto.date, dto.marked);
  }

  @Get('me')
  myMonth(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.service.monthDays(user.userId, month);
  }

  @Roles('warden', 'staff')
  @Get('student/:id')
  async studentMonth(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('month') month?: string,
  ) {
    const res = await this.service.studentMonthForWarden(
      user.hostelId,
      id,
      month,
    );
    if (!res) throw new NotFoundException('Student not found');
    return res;
  }

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
