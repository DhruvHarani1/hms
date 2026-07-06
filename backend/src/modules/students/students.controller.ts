import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { IsOptional, IsString } from 'class-validator';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentPdfService } from './student-pdf.service';

class RejectDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('students')
export class StudentsController {
  constructor(
    private prisma: PrismaService,
    private pdf: StudentPdfService,
    private jwt: JwtService,
  ) {}

  // ── Profile PDF (warden) ──
  @Roles('warden', 'staff')
  @Post(':id/pdf-link')
  @HttpCode(200)
  async pdfLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const token = await this.jwt.signAsync(
      { sub: user.userId, hostelId: user.hostelId, studentId: id, purpose: 'student-pdf' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
    );
    return { token };
  }

  @Public()
  @Get(':id/pdf')
  async pdfDownload(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new BadRequestException('Invalid or expired link');
    }
    if (payload.purpose !== 'student-pdf' || payload.studentId !== id) {
      throw new BadRequestException('Invalid link');
    }
    const buffer = await this.pdf.build(payload.hostelId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="student-${id}.pdf"`,
    );
    res.send(buffer);
  }

  // ── Join-request approval queue (warden) ──
  @Roles('warden', 'staff')
  @Get('requests')
  async requests(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        hostelId: user.hostelId,
        role: 'student',
        status: 'pending',
        deletedAt: null,
      },
      include: { studentProfile: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Roles('warden', 'staff')
  @Patch(':id/approve')
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const student = await this.prisma.user.findFirst({
      where: { id, hostelId: user.hostelId, role: 'student' },
    });
    if (!student) throw new BadRequestException('Student not found');
    await this.prisma.user.update({
      where: { id },
      data: { status: 'active', rejectionReason: null },
    });
    return { success: true, status: 'active' };
  }

  @Roles('warden', 'staff')
  @Patch(':id/reject')
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ) {
    const student = await this.prisma.user.findFirst({
      where: { id, hostelId: user.hostelId, role: 'student' },
    });
    if (!student) throw new BadRequestException('Student not found');
    await this.prisma.user.update({
      where: { id },
      data: { status: 'rejected', rejectionReason: dto.reason ?? null },
    });
    return { success: true, status: 'rejected' };
  }

  @Roles('warden', 'staff')
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: {
        hostelId: user.hostelId,
        role: 'student',
        status: 'active',
        deletedAt: null,
        ...(q && {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      include: { studentProfile: true },
      orderBy: { fullName: 'asc' },
    });
  }

  @Roles('warden', 'staff')
  @Get(':id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const student = await this.prisma.user.findFirst({
      where: { id, hostelId: user.hostelId, role: 'student' },
      include: { studentProfile: true },
    });
    if (!student) throw new BadRequestException('Student not found');
    const { passwordHash, ...rest } = student;
    return rest;
  }

  @Roles('warden')
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStudentDto,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new BadRequestException('Email already in use');

    const passwordHash = await argon2.hash(dto.password);

    const created = await this.prisma.user.create({
      data: {
        hostelId: user.hostelId,
        role: 'student',
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        studentProfile: {
          create: {
            hostelId: user.hostelId,
            rollNo: dto.rollNo,
            course: dto.course,
            year: dto.year,
            department: dto.department,
            roomNumber: dto.roomNumber,
          },
        },
      },
      include: { studentProfile: true },
    });

    const { passwordHash: _, ...rest } = created;
    return rest;
  }
}
