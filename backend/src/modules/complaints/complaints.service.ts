import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateComplaintDto,
  ReplyComplaintDto,
  UpdateComplaintDto,
} from './dto/complaints.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async categories(hostelId: string) {
    return this.prisma.complaintCategory.findMany({ where: { hostelId } });
  }

  async create(user: AuthUser, dto: CreateComplaintDto) {
    let priority: any = 'medium';
    if (dto.categoryId) {
      const cat = await this.prisma.complaintCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (cat) priority = cat.defaultPriority;
    }

    const complaint = await this.prisma.complaint.create({
      data: {
        hostelId: user.hostelId,
        studentId: user.userId,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        priority,
        attachments: dto.attachments?.length
          ? {
              create: dto.attachments.map((fileUrl) => ({
                fileUrl,
                uploadedBy: user.userId,
              })),
            }
          : undefined,
      },
      include: { attachments: true, category: true },
    });

    // Fire-and-forget: email all wardens about the new complaint.
    const studentUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true },
    });
    this.prisma.user
      .findMany({
        where: { hostelId: user.hostelId, role: { in: ['warden', 'staff'] as any }, status: 'active', deletedAt: null },
        select: { email: true },
      })
      .then((wardens) => {
        for (const w of wardens) {
          this.mail
            .sendWardenNewComplaint(
              w.email,
              studentUser?.fullName ?? 'A student',
              dto.title,
              complaint.category?.name ?? 'Uncategorized',
              String(priority),
            )
            .catch(() => {});
        }
      })
      .catch(() => {});

    return complaint;
  }

  async list(user: AuthUser, filters: { status?: string; priority?: string }) {
    const isWarden = user.role === 'warden' || user.role === 'staff';
    return this.prisma.complaint.findMany({
      where: {
        hostelId: user.hostelId,
        ...(isWarden ? {} : { studentId: user.userId }),
        ...(filters.status && { status: filters.status as any }),
        ...(filters.priority && { priority: filters.priority as any }),
      },
      include: {
        category: true,
        student: { select: { id: true, fullName: true, email: true } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(user: AuthUser, id: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id, hostelId: user.hostelId },
      include: {
        category: true,
        attachments: true,
        student: { select: { id: true, fullName: true, email: true } },
        replies: {
          include: { author: { select: { id: true, fullName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const isWarden = user.role === 'warden' || user.role === 'staff';
    if (!isWarden && complaint.studentId !== user.userId) {
      throw new ForbiddenException();
    }
    return complaint;
  }

  async update(user: AuthUser, id: string, dto: UpdateComplaintDto) {
    const existing = await this.getOne(user, id); // ensures it exists + in tenant
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
        ...(dto.status === 'resolved' && { resolvedAt: new Date() }),
      },
    });

    // Fire-and-forget: email the student when complaint is resolved.
    if (dto.status === 'resolved') {
      const student = await this.prisma.user.findUnique({
        where: { id: existing.studentId },
        select: { email: true, fullName: true },
      });
      if (student) {
        this.mail
          .sendComplaintResolved(student.email, student.fullName, existing.title)
          .catch(() => {});
      }
    }

    return updated;
  }

  async reply(user: AuthUser, id: string, dto: ReplyComplaintDto) {
    await this.getOne(user, id);
    return this.prisma.complaintReply.create({
      data: {
        complaintId: id,
        authorId: user.userId,
        message: dto.message,
      },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });
  }
}
