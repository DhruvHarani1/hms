import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { MealsService } from '../meals/meals.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EditRequestsService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
    private mealsService: MealsService,
    private notifications: NotificationsService,
  ) {}

  /** Create a new edit request for a past day. */
  async create(
    hostelId: string,
    studentId: string,
    dto: { date: string; changes: Record<string, any>; reason: string },
  ) {
    const date = this.parseDate(dto.date);
    const req = await this.prisma.attendanceEditRequest.create({
      data: {
        hostelId,
        studentId,
        date,
        changes: dto.changes,
        reason: dto.reason,
        status: 'pending',
      },
      include: {
        student: { select: { fullName: true } },
      },
    });

    // Notify all wardens in the hostel
    const dateLabel = dto.date; // YYYY-MM-DD
    await this.notifyWardens(hostelId, req.student.fullName, dateLabel);

    return this.formatRequest(req);
  }

  /** Find a pending request for a specific student+day (used to check duplicates). */
  async findPendingForDay(studentId: string, dateStr: string) {
    const date = this.parseDate(dateStr);
    return this.prisma.attendanceEditRequest.findFirst({
      where: { studentId, date, status: 'pending' },
    });
  }

  /** Find one request by ID scoped to hostel (warden use). */
  async findOne(id: string, hostelId: string) {
    return this.prisma.attendanceEditRequest.findFirst({
      where: { id, hostelId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            studentProfile: { select: { rollNo: true, roomNumber: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true } },
      },
    });
  }

  /** Student: get own requests. */
  async findByStudent(studentId: string, status?: string) {
    const where: any = { studentId };
    if (status) where.status = status;
    const reqs = await this.prisma.attendanceEditRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return reqs.map(this.formatRequest);
  }

  /** Warden: list all hostel requests. */
  async findByHostel(hostelId: string, status?: string) {
    const where: any = { hostelId };
    if (status) where.status = status;
    else where.status = 'pending'; // default to pending
    const reqs = await this.prisma.attendanceEditRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            studentProfile: { select: { rollNo: true, roomNumber: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true } },
      },
    });
    return reqs.map(this.formatRequest);
  }

  /** Warden: count of pending requests. */
  async pendingCount(hostelId: string) {
    const count = await this.prisma.attendanceEditRequest.count({
      where: { hostelId, status: 'pending' },
    });
    return { count };
  }

  /** Warden: approve → apply the changes, update request status. */
  async approve(req: any, reviewerId: string) {
    const dateStr = req.date.toISOString().slice(0, 10);
    const changes = req.changes as Record<string, boolean>;

    // Apply each change using existing services
    if (typeof changes.attendance === 'boolean') {
      // attendance: true = present (delete absent row), false = absent (create row)
      await this.attendanceService.setAbsent(
        req.hostelId,
        req.studentId,
        dateStr,
        !changes.attendance, // setAbsent(absent=true) = mark absent
      );
    }
    if (typeof changes.lunch === 'boolean') {
      await this.mealsService.setMeal(
        req.hostelId,
        req.studentId,
        dateStr,
        'lunch',
        changes.lunch, // true = eating (marked), false = not eating (opted_out)
      );
    }
    if (typeof changes.dinner === 'boolean') {
      await this.mealsService.setMeal(
        req.hostelId,
        req.studentId,
        dateStr,
        'dinner',
        changes.dinner,
      );
    }

    // Update request status
    const updated = await this.prisma.attendanceEditRequest.update({
      where: { id: req.id },
      data: { status: 'approved', reviewedBy: reviewerId, reviewedAt: new Date() },
    });

    // Notify student
    await this.notifications.notifySpecificUsers([req.studentId], {
      hostelId: req.hostelId,
      type: 'individual',
      title: '✅ Edit Request Approved',
      body: `Your edit request for ${dateStr} has been approved by the warden.`,
      data: { requestId: req.id, date: dateStr },
      priority: 'normal',
      createdBy: reviewerId,
    });

    return this.formatRequest(updated);
  }

  /** Warden: reject → no data change, update request status. */
  async reject(req: any, reviewerId: string) {
    const dateStr = req.date.toISOString().slice(0, 10);

    const updated = await this.prisma.attendanceEditRequest.update({
      where: { id: req.id },
      data: { status: 'rejected', reviewedBy: reviewerId, reviewedAt: new Date() },
    });

    // Notify student
    await this.notifications.notifySpecificUsers([req.studentId], {
      hostelId: req.hostelId,
      type: 'individual',
      title: '❌ Edit Request Rejected',
      body: `Your edit request for ${dateStr} was not approved by the warden.`,
      data: { requestId: req.id, date: dateStr },
      priority: 'normal',
      createdBy: reviewerId,
    });

    return this.formatRequest(updated);
  }

  // ─── Helpers ───

  private parseDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private formatRequest(req: any) {
    return {
      id: req.id,
      date: req.date?.toISOString?.().slice(0, 10) ?? req.date,
      changes: req.changes,
      reason: req.reason,
      status: req.status,
      reviewedAt: req.reviewedAt,
      createdAt: req.createdAt,
      student: req.student ?? undefined,
      reviewer: req.reviewer ?? undefined,
    };
  }

  private async notifyWardens(hostelId: string, studentName: string, date: string) {
    const wardens = await this.prisma.user.findMany({
      where: { hostelId, role: { in: ['warden', 'staff'] as any }, status: 'active', deletedAt: null },
      select: { id: true },
    });
    if (wardens.length === 0) return;
    await this.notifications.notifySpecificUsers(
      wardens.map((w) => w.id),
      {
        hostelId,
        type: 'individual',
        title: '📝 Edit Request Received',
        body: `${studentName} has requested an edit for ${date}.`,
        data: { date },
        priority: 'normal',
      },
    );
  }
}
