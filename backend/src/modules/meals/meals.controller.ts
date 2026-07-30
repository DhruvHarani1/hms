import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { IsIn, IsArray, IsString, IsNotEmpty } from 'class-validator';
import { MealsService } from './meals.service';
import { MealExportService } from './meal-export.service';
import { MealMenuService } from './meal-menu.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { BulkMealDto, MarkMealDto, CreateReviewDto } from './dto/meals.dto';
import { MealReviewService } from './meal-review.service';

class DishDto {
  @IsIn(['breakfast', 'lunch', 'dinner'])
  mealType: 'breakfast' | 'lunch' | 'dinner';

  @IsString()
  @IsNotEmpty()
  name: string;
}

class SetMenuDto {
  @IsIn(['breakfast', 'lunch', 'dinner'])
  mealType: 'breakfast' | 'lunch' | 'dinner';

  @IsArray()
  @IsString({ each: true })
  dishes: string[];
}

@Controller('meals')
export class MealsController {
  constructor(
    private readonly service: MealsService,
    private readonly exporter: MealExportService,
    private readonly menu: MealMenuService,
    private readonly jwt: JwtService,
    private readonly reviewService: MealReviewService,
  ) {}

  /** Returns today's date string in IST (YYYY-MM-DD) using UTC+5:30 offset. */
  private todayIST(): string {
    const istMs = Date.now() + (5 * 60 + 30) * 60 * 1000;
    return new Date(istMs).toISOString().slice(0, 10);
  }

  // ── Dish master lists + daily menu ──
  @Roles('warden', 'staff', 'cook')
  @Get('dishes')
  listDishes(@CurrentUser() user: AuthUser, @Query('mealType') mealType: any) {
    return this.menu.listDishes(user.hostelId, mealType);
  }

  @Roles('warden', 'staff', 'cook')
  @Post('dishes')
  addDish(@CurrentUser() user: AuthUser, @Body() dto: DishDto) {
    return this.menu.addDish(user.hostelId, dto.mealType, dto.name);
  }

  @Roles('warden', 'staff', 'cook')
  @Patch('dishes/:id')
  updateDish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.menu.updateDish(user.hostelId, id, name);
  }

  @Roles('warden', 'staff', 'cook')
  @Delete('dishes/:id')
  deleteDish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.menu.deleteDish(user.hostelId, id);
  }

  @Roles('warden', 'staff', 'cook')
  @Post('menu')
  @HttpCode(200)
  setMenu(@CurrentUser() user: AuthUser, @Body() dto: SetMenuDto) {
    return this.menu.setMenu(user.hostelId, user.userId, dto.mealType, dto.dishes);
  }

  /** Today's menu — any logged-in user (student view, cook view). */
  @Get('menu')
  todayMenu(@CurrentUser() user: AuthUser) {
    return this.menu.getTodayMenu(user.hostelId);
  }

  // ── Student: mark one meal on a day ──
  @Post('mark')
  @HttpCode(200)
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkMealDto) {
    if (dto.date < this.todayIST()) {
      throw new ForbiddenException(
        'Past days are locked. Submit an edit request instead.',
      );
    }
    return this.service.setMeal(
      user.hostelId,
      user.userId,
      dto.date,
      dto.meal,
      dto.marked,
    );
  }

  // ── Student: bulk over month ──
  @Post('bulk')
  @HttpCode(200)
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkMealDto) {
    // Bulk only affects current/future days; past dates guard is enforced inside service
    return this.service.bulk(
      user.hostelId,
      user.userId,
      dto.month,
      dto.meal,
      dto.marked,
    );
  }

  @Get('me')
  myMonth(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.service.monthData(user.userId, month);
  }

  @Roles('warden', 'staff')
  @Get('student/:id')
  async studentMonth(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('month') month?: string,
  ) {
    const res = await this.service.studentMonthForWarden(user.hostelId, id, month);
    if (!res) throw new NotFoundException('Student not found');
    return res;
  }

  // ── Warden: get a short-lived download link for the browser ──
  @Roles('warden', 'staff')
  @Post('export-link')
  @HttpCode(200)
  async exportLink(
    @CurrentUser() user: AuthUser,
    @Body('month') month?: string,
  ) {
    const token = await this.jwt.signAsync(
      { sub: user.userId, hostelId: user.hostelId, purpose: 'meal-export', month },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
    );
    return { token, month: month ?? null };
  }

  // ── Public (token-gated) xlsx download, openable in a browser ──
  @Public()
  @Get('export')
  async export(
    @Query('token') token: string,
    @Query('month') monthQ: string,
    @Res() res: Response,
  ) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new BadRequestException('Invalid or expired download link');
    }
    if (payload.purpose !== 'meal-export') {
      throw new BadRequestException('Invalid download link');
    }
    const month = payload.month ?? monthQ;
    const buffer = await this.exporter.buildWorkbook(payload.hostelId, month);
    const fname = `hms-meals-${month ?? 'current'}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(buffer);
  }

  // ── Meal Reviews ──
  @Post('reviews')
  @HttpCode(200)
  submitReview(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewService.submitReview(user.hostelId, user.userId, dto);
  }

  @Get('reviews/me')
  getStudentReviews(
    @CurrentUser() user: AuthUser,
    @Query('dates') dates: string | string[],
  ) {
    const datesArr = Array.isArray(dates) ? dates : [dates];
    return this.reviewService.getStudentReviewsForDates(user.userId, datesArr);
  }

  @Roles('warden', 'staff', 'cook')
  @Get('reviews/stats')
  getReviewStats(
    @CurrentUser() user: AuthUser,
    @Query('date') date: string,
  ) {
    if (!date) {
      throw new BadRequestException('Date query parameter is required');
    }
    return this.reviewService.getReviewStats(user.hostelId, date);
  }
}
