import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { NoticeCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';

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

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsString()
  imageKey?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class UpdateNoticeDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

@Controller('notices')
export class NoticesController {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private uploads: UploadsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const notices = await this.prisma.notice.findMany({
      where: {
        hostelId: user.hostelId,
        ...(category && { category: category as NoticeCategory }),
        ...(includeExpired !== 'true' && {
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        }),
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });

    return notices.map((n) => ({
      ...n,
      imageUrl: n.imageKey ? this.uploads.signedViewUrl(n.imageKey) : null,
    }));
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
        pinned: dto.pinned ?? false,
        imageKey: dto.imageKey,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
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

  @Roles('warden', 'staff')
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    const notice = await this.prisma.notice.findFirst({
      where: { id, hostelId: user.hostelId },
    });
    if (!notice) return { ok: false };

    return this.prisma.notice.update({
      where: { id: notice.id },
      data: { pinned: dto.pinned },
    });
  }

  @Roles('warden', 'staff')
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const notice = await this.prisma.notice.findFirst({
      where: { id, hostelId: user.hostelId },
    });
    if (!notice) return { ok: true };

    await this.prisma.notice.delete({ where: { id: notice.id } });
    if (notice.imageKey) await this.uploads.deleteImages([notice.imageKey]);
    return { ok: true };
  }
}
