import { Body, Controller, Get, Patch } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

function extractFirstName(fullName?: string | null, surname?: string | null): string {
  const name = (fullName || '').trim();
  const sur = (surname || '').trim();
  if (!name) return '';
  if (sur && name.toLowerCase().endsWith(sur.toLowerCase())) {
    return name.slice(0, -sur.length).trim();
  }
  return name;
}

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
    const surname = rest.studentProfile?.surname;
    const firstName = extractFirstName(rest.fullName, surname);
    return {
      ...rest,
      firstName,
    };
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const { fullName, phone, avatarUrl, dob, admissionDate, surname, ...rest } = dto;

    const current = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { studentProfile: true },
    });

    const currentSurname = surname !== undefined ? surname?.trim() : current?.studentProfile?.surname?.trim();
    const inputFirstName = fullName !== undefined ? fullName.trim() : extractFirstName(current?.fullName, currentSurname);

    let updatedFullName = current?.fullName;
    if (inputFirstName && currentSurname) {
      if (inputFirstName.toLowerCase().endsWith(currentSurname.toLowerCase())) {
        updatedFullName = inputFirstName;
      } else {
        updatedFullName = `${inputFirstName} ${currentSurname}`;
      }
    } else if (inputFirstName) {
      updatedFullName = inputFirstName;
    }

    const userData: any = {};
    if (updatedFullName !== undefined) userData.fullName = updatedFullName;
    if (phone !== undefined) userData.phone = phone;
    if (avatarUrl !== undefined) userData.avatarUrl = avatarUrl;

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
    const updatedFirstName = extractFirstName(safe.fullName, safe.studentProfile?.surname);
    return {
      ...safe,
      firstName: updatedFirstName,
    };
  }
}
