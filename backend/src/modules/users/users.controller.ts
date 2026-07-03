import { Body, Controller, Get, Patch } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const found = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { studentProfile: true },
    });
    if (!found) return null;
    const { passwordHash, ...rest } = found;
    return rest;
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const { fullName, phone, avatarUrl, ...profileFields } = dto;

    const updated = await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    // Update student profile fields if this is a student and any were sent.
    if (user.role === 'student' && Object.keys(profileFields).length > 0) {
      await this.prisma.studentProfile.updateMany({
        where: { userId: user.userId },
        data: profileFields,
      });
    }

    const { passwordHash, ...rest } = updated;
    return rest;
  }
}
