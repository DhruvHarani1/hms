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
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private notifications: NotificationsService,
    private uploads: UploadsService,
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
    const complaints = await this.prisma.complaint.findMany({
      where: {
        hostelId: user.hostelId,
        ...(filters.status && { status: filters.status as any }),
        ...(filters.priority && { priority: filters.priority as any }),
      },
      include: {
        category: true,
        student: { select: { id: true, fullName: true, email: true } },
        attachments: true,
        _count: { select: { replies: true, upvotes: true } },
        upvotes: {
          where: { userId: user.userId },
          select: { id: true },
        },
      },
      orderBy: [
        { upvotes: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
    });

    return complaints.map((c) => {
      const { upvotes, _count, attachments, ...rest } = c;
      const signedAttachments = attachments?.map((a) => ({
        ...a,
        fileUrl: this.uploads.signedViewUrl(a.fileUrl),
      })) ?? [];
      return {
        ...rest,
        attachments: signedAttachments,
        _count,
        upvoteCount: _count.upvotes,
        hasUpvoted: upvotes.length > 0,
      };
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
        _count: { select: { replies: true, upvotes: true } },
        upvotes: {
          where: { userId: user.userId },
          select: { id: true },
        },
      },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const { upvotes, _count, attachments, ...rest } = complaint;
    const signedAttachments = attachments?.map((a) => ({
      ...a,
      fileUrl: this.uploads.signedViewUrl(a.fileUrl),
    })) ?? [];
    return {
      ...rest,
      attachments: signedAttachments,
      _count,
      upvoteCount: _count.upvotes,
      hasUpvoted: upvotes.length > 0,
    };
  }

  async toggleUpvote(user: AuthUser, id: string) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id, hostelId: user.hostelId },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const existing = await this.prisma.complaintUpvote.findUnique({
      where: {
        complaintId_userId: {
          complaintId: id,
          userId: user.userId,
        },
      },
    });

    let upvoted = false;
    if (existing) {
      await this.prisma.complaintUpvote.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.complaintUpvote.create({
        data: {
          complaintId: id,
          userId: user.userId,
        },
      });
      upvoted = true;
    }

    const upvoteCount = await this.prisma.complaintUpvote.count({
      where: { complaintId: id },
    });

    // Milestone Check: notify wardens if it hits a multiple of 5
    if (upvoted && upvoteCount > 0 && upvoteCount % 5 === 0) {
      await this.notifications.notifyWardens(
        user.hostelId,
        `🔥 Complaint Alert (${upvoteCount} Upvotes)`,
        `Complaint "${complaint.title}" now has ${upvoteCount} upvotes.`,
        { complaintId: id, upvoteCount: upvoteCount.toString() },
        user.userId,
      );
    }

    return { upvoted, upvoteCount };
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
