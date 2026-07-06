import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import {
  CreateAnnouncementDto,
  MealReadyDto,
  RegisterDeviceDto,
} from './dto/notifications.dto';

@Controller()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // ── Warden + Cook: meal-ready quick-actions ──
  @Roles('warden', 'staff', 'cook')
  @Post('notifications/meal')
  @HttpCode(200)
  mealReady(@CurrentUser() user: AuthUser, @Body() dto: MealReadyDto) {
    return this.service.sendMealReady(
      user.hostelId,
      user.userId,
      dto.mealType,
      dto.menu,
    );
  }

  @Roles('warden', 'staff')
  @Post('notifications/announcement')
  @HttpCode(200)
  announce(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.service.sendAnnouncement(
      user.hostelId,
      user.userId,
      dto.title,
      dto.body,
    );
  }

  @Roles('warden', 'staff')
  @Get('notifications/history')
  history(@CurrentUser() user: AuthUser) {
    return this.service.history(user.hostelId);
  }

  // ── Any user: personal inbox ──
  @Get('notifications')
  inbox(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.service.inbox(user.userId, unread === 'true');
  }

  @Get('notifications/unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.userId);
  }

  @Patch('notifications/:id/read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markRead(user.userId, id);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.userId);
  }

  // ── Device token registration ──
  @Post('device-tokens')
  @HttpCode(200)
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.service.registerDevice(user.userId, dto.platform, dto.token);
  }

  @Delete('device-tokens/:token')
  removeDevice(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.service.removeDevice(user.userId, token);
  }
}
