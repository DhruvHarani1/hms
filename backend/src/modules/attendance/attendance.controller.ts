import {
  BadRequestException,
  Body,
  Controller,
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

  @Post('mark')
  @HttpCode(200)
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkAttendanceDto) {
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
