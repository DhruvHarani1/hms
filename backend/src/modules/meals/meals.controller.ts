import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { MealsService } from './meals.service';
import { MealExportService } from './meal-export.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { BulkMealDto, MarkMealDto } from './dto/meals.dto';

@Controller('meals')
export class MealsController {
  constructor(
    private readonly service: MealsService,
    private readonly exporter: MealExportService,
    private readonly jwt: JwtService,
  ) {}

  // ── Student: mark one meal on a day ──
  @Post('mark')
  @HttpCode(200)
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkMealDto) {
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
}
