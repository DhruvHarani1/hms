import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { AttendanceService } from './attendance.service';
import { AttendanceExportService } from './attendance-export.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

class MarkAttendanceDto {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsBoolean()
  absent: boolean;
}

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly exporter: AttendanceExportService,
    private readonly jwt: JwtService,
  ) {}

  /** Returns today's date string in IST (YYYY-MM-DD) using UTC+5:30 offset. */
  private todayIST(): string {
    // IST = UTC + 5h30m. Use offset math — never re-parse toLocaleString output.
    const istMs = Date.now() + (5 * 60 + 30) * 60 * 1000;
    return new Date(istMs).toISOString().slice(0, 10);
  }

  @Post('mark')
  @HttpCode(200)
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkAttendanceDto) {
    if (dto.date < this.todayIST()) {
      throw new ForbiddenException(
        'Past days are locked. Submit an edit request instead.',
      );
    }
    return this.service.setAbsent(user.hostelId, user.userId, dto.date, dto.absent);
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

  @Roles('warden', 'staff')
  @Post('export-link')
  @HttpCode(200)
  async exportLink(@CurrentUser() user: AuthUser, @Body('month') month?: string) {
    const token = await this.jwt.signAsync(
      { sub: user.userId, hostelId: user.hostelId, purpose: 'attendance-export', month },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
    );
    return { token, month: month ?? null };
  }

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
    if (payload.purpose !== 'attendance-export') {
      throw new BadRequestException('Invalid download link');
    }
    const month = payload.month ?? monthQ;
    const buffer = await this.exporter.buildWorkbook(payload.hostelId, month);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="hms-attendance-${month ?? 'current'}.xlsx"`,
    );
    res.send(buffer);
  }
}
