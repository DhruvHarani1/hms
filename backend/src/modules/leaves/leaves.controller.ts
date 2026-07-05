import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { LeavesService } from './leaves.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

class CreateLeaveDto {
  @IsString()
  @IsNotEmpty()
  startDate: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

@Controller('leaves')
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveDto) {
    return this.service.create(user.hostelId, user.userId, dto);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.listForStudent(user.userId);
  }

  @Roles('warden', 'staff')
  @Get()
  all(@CurrentUser() user: AuthUser) {
    return this.service.listForWarden(user.hostelId);
  }
}
