import { BadRequestException, Injectable } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto } from './dto/meals.dto';

type MenuMeal = 'breakfast' | 'lunch' | 'dinner';

@Injectable()
export class MealReviewService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private parseDateUTC(dateStr: string): Date {
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }

  async submitReview(hostelId: string, studentId: string, dto: CreateReviewDto) {
    const parsedDate = this.parseDateUTC(dto.date);

    // 1. Verify the student did not opt out of this meal
    const attendance = await this.prisma.mealAttendance.findUnique({
      where: {
        studentId_date_mealType: {
          studentId,
          date: parsedDate,
          mealType: dto.mealType as MealType,
        },
      },
    });

    if (attendance && (attendance.status === 'opted_out' || attendance.status === 'absent')) {
      throw new BadRequestException('You cannot rate a meal that you opted out of.');
    }

    // 2. Upsert the review
    const review = await this.prisma.mealReview.upsert({
      where: {
        studentId_date_mealType: {
          studentId,
          date: parsedDate,
          mealType: dto.mealType as MealType,
        },
      },
      create: {
        hostelId,
        studentId,
        date: parsedDate,
        mealType: dto.mealType as MealType,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
    });

    // 3. Trigger push notification alert to warden if rating is < 2 stars (i.e. 1 star)
    if (dto.rating < 2) {
      const mealName = dto.mealType.charAt(0).toUpperCase() + dto.mealType.slice(1);
      const student = await this.prisma.user.findUnique({ where: { id: studentId } });
      const commentStr = dto.comment?.trim() ? `"${dto.comment.trim()}"` : 'No comment provided';

      await this.notifications.notifyWardens(
        hostelId,
        `⚠️ Low Meal Rating Alert`,
        `A student rated today's ${mealName} 1/5 stars. Comment: ${commentStr}`,
        {
          mealType: dto.mealType,
          date: dto.date,
          rating: dto.rating.toString(),
          studentName: student?.fullName ?? 'Student',
        },
        studentId,
      );
    }

    return review;
  }

  async getStudentReviewsForDates(studentId: string, dateStrings: string[]) {
    const utcDates = dateStrings.map((d) => this.parseDateUTC(d));
    return this.prisma.mealReview.findMany({
      where: {
        studentId,
        date: { in: utcDates },
      },
      select: {
        id: true,
        date: true,
        mealType: true,
        rating: true,
        comment: true,
      },
    });
  }

  async getReviewStats(hostelId: string, dateStr: string) {
    const parsedDate = this.parseDateUTC(dateStr);

    const reviews = await this.prisma.mealReview.findMany({
      where: {
        hostelId,
        date: parsedDate,
      },
      include: {
        student: {
          select: {
            fullName: true,
            studentProfile: {
              select: { surname: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Compute averages
    const sums = { breakfast: 0, lunch: 0, dinner: 0 };
    const counts = { breakfast: 0, lunch: 0, dinner: 0 };

    for (const r of reviews) {
      const type = r.mealType as MenuMeal;
      if (sums[type] !== undefined) {
        sums[type] += r.rating;
        counts[type]++;
      }
    }

    const averages = {
      breakfast: counts.breakfast > 0 ? parseFloat((sums.breakfast / counts.breakfast).toFixed(1)) : 0,
      lunch: counts.lunch > 0 ? parseFloat((sums.lunch / counts.lunch).toFixed(1)) : 0,
      dinner: counts.dinner > 0 ? parseFloat((sums.dinner / counts.dinner).toFixed(1)) : 0,
    };

    const feed = reviews.map((r) => {
      const baseName = r.student?.fullName ?? 'Unknown Student';
      const surname = r.student?.studentProfile?.surname?.trim();
      const studentName =
        surname && !baseName.toLowerCase().endsWith(surname.toLowerCase())
          ? `${baseName} ${surname}`
          : baseName;

      return {
        id: r.id,
        mealType: r.mealType,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        studentName,
      };
    });

    return {
      averages,
      feed,
    };
  }
}
