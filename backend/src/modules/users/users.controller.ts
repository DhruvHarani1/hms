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
    const { fullName, phone, avatarUrl, dob, admissionDate, surname, ...rest } = dto;

    // Build User update
    const userData: any = {};
    if (fullName !== undefined) userData.fullName = fullName;
    if (phone !== undefined) userData.phone = phone;
    if (avatarUrl !== undefined) userData.avatarUrl = avatarUrl;

    // If surname changed, combine firstName + surname into User.fullName
    if (user.role === 'student' && surname !== undefined) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { fullName: true },
      });
      if (currentUser) {
        // Use the new fullName if provided, otherwise the existing one
        const baseName = (fullName ?? currentUser.fullName ?? '').trim();
        const surnameClean = surname.trim();
        if (surnameClean) {
          // Strip old surname if it was already appended
          const parts = baseName.split(' ');
          // Find the first name (everything before the last word if >1 word)
          // But since we don't know the original first name vs surname split,
          // we trust the StudentProfile.surname as the source of truth
          const currentProfile = await this.prisma.studentProfile.findFirst({
            where: { userId: user.userId },
            select: { surname: true },
          });
          const oldSurname = currentProfile?.surname?.trim();
          let firstName = baseName;
          if (oldSurname && baseName.toLowerCase().endsWith(oldSurname.toLowerCase())) {
            firstName = baseName.slice(0, -oldSurname.length).trim();
          }
          userData.fullName = `${firstName} ${surnameClean}`;
        }
      }
    }

    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id: user.userId },
        data: userData,
      });
    }

    if (user.role === 'student') {
      const profileData: any = { ...rest };
      if (surname !== undefined) profileData.surname = surname;
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
