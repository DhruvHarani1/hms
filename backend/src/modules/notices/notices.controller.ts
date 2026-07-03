import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NoticeCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';

class CreateNoticeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsIn(['announcement', 'event', 'holiday', 'rules', 'exam'])
  category?: NoticeCategory;
}

@Controller('notices')
export class NoticesController {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('category') category?: string) {
    return this.prisma.notice.findMany({
      where: {
        hostelId: user.hostelId,
        ...(category && { category: category as NoticeCategory }),
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @Roles('warden', 'staff')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoticeDto) {
    const notice = await this.prisma.notice.create({
      data: {
        hostelId: user.hostelId,
        title: dto.title,
        body: dto.body,
        category: dto.category ?? 'announcement',
        publishedAt: new Date(),
        createdBy: user.userId,
      },
    });

    // Push a notification so students are alerted about the new notice.
    await this.notifications.sendAnnouncement(
      user.hostelId,
      user.userId,
      `📢 ${notice.title}`,
      notice.body.slice(0, 140),
    );

    return notice;
  }
}
