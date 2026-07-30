import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { EditRequestsService } from './edit-requests.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

class CreateEditRequestDto {
  @IsString()
  date: string; // YYYY-MM-DD

  @IsObject()
  changes: {
    attendance?: boolean;
    lunch?: boolean;
    dinner?: boolean;
  };

  @IsString()
  @MinLength(5)
  reason: string;
}

class ReviewDto {
  @IsString()
  @IsOptional()
  note?: string;
}

@Controller('edit-requests')
export class EditRequestsController {
  constructor(private readonly service: EditRequestsService) {}

  /** Student: submit an edit request for a past day. */
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEditRequestDto,
  ) {
    const today = this.todayIST();
    if (dto.date >= today) {
      throw new BadRequestException(
        'You can only request edits for past days. Today and future days are directly editable.',
      );
    }
    if (!dto.changes || Object.keys(dto.changes).length === 0) {
      throw new BadRequestException(
        'Specify at least one change (attendance, lunch, or dinner).',
      );
    }
    const existing = await this.service.findPendingForDay(user.userId, dto.date);
    if (existing) {
      throw new ConflictException(
        'You already have a pending edit request for this day.',
      );
    }
    return this.service.create(user.hostelId, user.userId, dto);
  }

  /** Student: get own requests. */
  @Get('mine')
  mine(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.service.findByStudent(user.userId, status);
  }

  /** Warden: list all hostel requests. */
  @Roles('warden', 'staff')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.service.findByHostel(user.hostelId, status);
  }

  /** Warden: count of pending requests (for badge). */
  @Roles('warden', 'staff')
  @Get('count')
  count(@CurrentUser() user: AuthUser) {
    return this.service.pendingCount(user.hostelId);
  }

  /** Warden: approve a request → applies the actual data change. */
  @Roles('warden', 'staff')
  @Post(':id/approve')
  @HttpCode(200)
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    const req = await this.service.findOne(id, user.hostelId);
    if (!req) throw new NotFoundException('Edit request not found.');
    if (req.status !== 'pending')
      throw new ForbiddenException('Request is already reviewed.');
    return this.service.approve(req, user.userId);
  }

  /** Warden: reject a request. */
  @Roles('warden', 'staff')
  @Post(':id/reject')
  @HttpCode(200)
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    const req = await this.service.findOne(id, user.hostelId);
    if (!req) throw new NotFoundException('Edit request not found.');
    if (req.status !== 'pending')
      throw new ForbiddenException('Request is already reviewed.');
    return this.service.reject(req, user.userId);
  }

  private todayIST(): string {
    const istMs = Date.now() + (5 * 60 + 30) * 60 * 1000;
    return new Date(istMs).toISOString().slice(0, 10);
  }
}
