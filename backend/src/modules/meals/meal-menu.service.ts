import { BadRequestException, Injectable } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type MenuMeal = 'breakfast' | 'lunch' | 'dinner';
const MEALS: MenuMeal[] = ['breakfast', 'lunch', 'dinner'];
const LABEL: Record<MenuMeal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};
const EMOJI: Record<MenuMeal, string> = {
  breakfast: '🍳',
  lunch: '🍛',
  dinner: '🌙',
};

@Injectable()
export class MealMenuService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private todayUTC(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }

  // ── Dish master lists (per meal) ──
  listDishes(hostelId: string, mealType: MenuMeal) {
    return this.prisma.dish.findMany({
      where: { hostelId, mealType: mealType as MealType },
      orderBy: { name: 'asc' },
    });
  }

  addDish(hostelId: string, mealType: MenuMeal, name: string) {
    return this.prisma.dish.create({
      data: { hostelId, mealType: mealType as MealType, name: name.trim() },
    });
  }

  async updateDish(hostelId: string, id: string, name: string) {
    const dish = await this.prisma.dish.findFirst({ where: { id, hostelId } });
    if (!dish) throw new BadRequestException('Dish not found');
    return this.prisma.dish.update({ where: { id }, data: { name: name.trim() } });
  }

  async deleteDish(hostelId: string, id: string) {
    await this.prisma.dish.deleteMany({ where: { id, hostelId } });
    return { success: true };
  }

  // ── Today's menu (stored in MealSession.menu as JSON array) ──
  async setMenu(
    hostelId: string,
    wardenId: string,
    mealType: MenuMeal,
    dishes: string[],
  ) {
    const date = this.todayUTC();
    await this.prisma.mealSession.upsert({
      where: { hostelId_date_mealType: { hostelId, date, mealType: mealType as MealType } },
      create: { hostelId, date, mealType: mealType as MealType, menu: JSON.stringify(dishes), markedBy: wardenId },
      update: { menu: JSON.stringify(dishes) },
    });

    // Notify students + cook of the day's menu.
    if (dishes.length > 0) {
      await this.notifications.notifyStudentsAndCook({
        hostelId,
        type: 'meal',
        title: `${EMOJI[mealType]} Today's ${LABEL[mealType]}`,
        body: dishes.join(', '),
        createdBy: wardenId,
        data: { mealType, menu: true },
      });
    }
    return { mealType, dishes };
  }

  async getTodayMenu(hostelId: string) {
    const date = this.todayUTC();
    const sessions = await this.prisma.mealSession.findMany({
      where: { hostelId, date },
    });
    const out: Record<MenuMeal, string[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };
    for (const s of sessions) {
      if ((MEALS as string[]).includes(s.mealType) && s.menu) {
        try {
          const arr = JSON.parse(s.menu);
          if (Array.isArray(arr)) out[s.mealType as MenuMeal] = arr;
        } catch {
          // legacy plain-text menu → single item
          out[s.mealType as MenuMeal] = [s.menu];
        }
      }
    }
    return out;
  }
}
