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
    const { fullName, phone, avatarUrl, dob, admissionDate, ...rest } = dto;

    await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    if (user.role === 'student') {
      const profileData: any = { ...rest };
      if (dob !== undefined) profileData.dob = dob ? new Date(dob) : null;
      if (admissionDate !== undefined)
        profileData.admissionDate = admissionDate ? new Date(admissionDate) : null;
      if (Object.keys(profileData).length > 0) {
        await this.prisma.studentProfile.updateMany({
          where: { userId: user.userId },
          data: profileData,
        });
      }
    }

    const found = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { studentProfile: true },
    });
    if (!found) return null;
    const { passwordHash, ...safe } = found;
    return safe;
  }
}
