import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateExpenseDto, UpdateBudgetDto } from './dto/expenses.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { SettlementStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private uploads: UploadsService,
  ) {}

  async create(user: AuthUser, dto: CreateExpenseDto) {
    if (!dto.participants || dto.participants.length === 0) {
      return this.prisma.expense.create({
        data: {
          hostelId: user.hostelId,
          title: dto.title,
          amount: dto.amount,
          payerId: user.userId,
          splitType: 'EQUAL',
          receiptUrl: dto.receiptUrl || null,
        },
        include: {
          splits: {
            include: {
              user: { select: { id: true, fullName: true } },
            },
          },
        },
      });
    }

    // 1. Calculate splits
    const splitsToCreate: { userId: string; amount: number }[] = [];
    let calculatedTotal = 0;

    if (dto.splitType === 'EQUAL') {
      const share = Number((dto.amount / dto.participants.length).toFixed(2));
      for (const p of dto.participants) {
        if (p.userId !== user.userId) {
          splitsToCreate.push({ userId: p.userId, amount: share });
        }
        calculatedTotal += share;
      }
    } else if (dto.splitType === 'PERCENTAGE') {
      for (const p of dto.participants) {
        if (!p.amount) {
          throw new BadRequestException('Percentage amount is required for each participant.');
        }
        const share = Number((dto.amount * (p.amount / 100)).toFixed(2));
        if (p.userId !== user.userId) {
          splitsToCreate.push({ userId: p.userId, amount: share });
        }
        calculatedTotal += share;
      }
    } else if (dto.splitType === 'CUSTOM') {
      for (const p of dto.participants) {
        if (p.amount === undefined) {
          throw new BadRequestException('Custom amount is required for each participant.');
        }
        if (p.userId !== user.userId) {
          splitsToCreate.push({ userId: p.userId, amount: p.amount });
        }
        calculatedTotal += p.amount;
      }
    }

    // Account for minor decimal rounding issues
    const diff = Math.abs(dto.amount - calculatedTotal);
    if (diff > 1.0) {
      throw new BadRequestException(
        `Split amounts (${calculatedTotal}) must sum up to the total expense amount (${dto.amount}).`
      );
    }

    // 2. Create database records
    const expense = await this.prisma.expense.create({
      data: {
        hostelId: user.hostelId,
        title: dto.title,
        amount: dto.amount,
        payerId: user.userId,
        splitType: dto.splitType,
        receiptUrl: dto.receiptUrl || null,
        splits: {
          create: splitsToCreate.map((s) => ({
            userId: s.userId,
            amount: s.amount,
            status: 'UNPAID',
          })),
        },
      },
      include: {
        splits: {
          include: {
            user: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    // 3. Fetch payer name and send push notification to all participants
    const payerUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true },
    });
    const payerName = payerUser?.fullName ?? 'Someone';

    const participantIds = splitsToCreate.map((s) => s.userId);
    if (participantIds.length > 0) {
      this.notifications.notifySpecificUsers(
        participantIds,
        {
          hostelId: user.hostelId,
          type: 'individual',
          title: '💸 New Split Added',
          body: `${payerName} added a split for "${dto.title}". You owe ₹${splitsToCreate.find(s => s.userId === participantIds[0])?.amount || 0}.`,
          data: { expenseId: expense.id },
        }
      ).catch(() => {});
    }

    return expense;
  }

  async list(user: AuthUser) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        hostelId: user.hostelId,
        OR: [
          { payerId: user.userId },
          { splits: { some: { userId: user.userId } } },
        ],
      },
      include: {
        payer: { select: { id: true, fullName: true, role: true } },
        splits: {
          include: {
            user: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Sign receipt URLs
    return expenses.map((e) => {
      const signedUrl = e.receiptUrl ? this.uploads.signedViewUrl(e.receiptUrl) : null;
      return {
        ...e,
        receiptUrl: signedUrl,
      };
    });
  }

  async getBalances(user: AuthUser) {
    // 1. Fetch all members in the hostel (students, wardens, staff) to show names
    const members = await this.prisma.user.findMany({
      where: {
        hostelId: user.hostelId,
        role: { in: ['student', 'warden', 'staff'] as any },
        status: 'active',
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        email: true,
      },
    });

    // 2. Fetch all unsettled splits involving the user
    // A. Splits where current user is debtor (status is UNPAID or PENDING)
    const debtorSplits = await this.prisma.expenseSplit.findMany({
      where: {
        userId: user.userId,
        status: { in: [SettlementStatus.UNPAID, SettlementStatus.PENDING] },
      },
      include: {
        expense: {
          select: { payerId: true },
        },
      },
    });

    // B. Splits where current user is creditor (status is UNPAID or PENDING)
    const creditorSplits = await this.prisma.expenseSplit.findMany({
      where: {
        expense: {
          hostelId: user.hostelId,
          payerId: user.userId,
        },
        status: { in: [SettlementStatus.UNPAID, SettlementStatus.PENDING] },
      },
      include: {
        expense: true,
        user: true,
      },
    });

    // 3. Compute net balances: otherUserId -> amount (positive means they owe X, negative means X owes them)
    const balanceMap: Record<string, { netAmount: number; pendingApprovals: any[] }> = {};

    // Initialize for all other users
    for (const m of members) {
      if (m.id !== user.userId) {
        balanceMap[m.id] = { netAmount: 0, pendingApprovals: [] };
      }
    }

    // Add what others owe the user
    for (const s of creditorSplits) {
      if (balanceMap[s.userId]) {
        balanceMap[s.userId].netAmount += s.amount;
        if (s.status === SettlementStatus.PENDING) {
          balanceMap[s.userId].pendingApprovals.push({
            splitId: s.id,
            title: s.expense.title,
            amount: s.amount,
            date: s.expense.createdAt,
          });
        }
      }
    }

    // Subtract what the user owes others
    for (const s of debtorSplits) {
      const creditorId = s.expense.payerId;
      if (balanceMap[creditorId]) {
        balanceMap[creditorId].netAmount -= s.amount;
      }
    }

    // 4. Build response array
    return members
      .filter((m) => m.id !== user.userId)
      .map((m) => {
        const { netAmount, pendingApprovals } = balanceMap[m.id] || { netAmount: 0, pendingApprovals: [] };
        return {
          user: m,
          netAmount: Number(netAmount.toFixed(2)),
          pendingApprovals,
        };
      })
      .filter((b) => b.netAmount !== 0 || b.pendingApprovals.length > 0);
  }

  async requestSettle(user: AuthUser, splitId: string) {
    const split = await this.prisma.expenseSplit.findUnique({
      where: { id: splitId },
      include: { expense: true },
    });

    if (!split) throw new NotFoundException('Split debt not found.');
    if (split.userId !== user.userId) {
      throw new ForbiddenException('You can only settle your own splits.');
    }
    if (split.status === 'SETTLED') {
      throw new BadRequestException('This split is already settled.');
    }

    const updated = await this.prisma.expenseSplit.update({
      where: { id: splitId },
      data: { status: 'PENDING' },
    });

    // Fetch debtor name
    const debtorUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true },
    });
    const debtorName = debtorUser?.fullName ?? 'A student';

    // Notify creditor (expense payer)
    this.notifications.notifySpecificUsers(
      [split.expense.payerId],
      {
        hostelId: user.hostelId,
        type: 'individual',
        title: '💳 Settlement Pending Approval',
        body: `${debtorName} marked their split of ₹${split.amount} for "${split.expense.title}" as paid. Please approve to confirm.`,
        data: { splitId },
      }
    ).catch(() => {});

    return updated;
  }

  async verifySettle(user: AuthUser, splitId: string, action: 'approve' | 'decline') {
    const split = await this.prisma.expenseSplit.findUnique({
      where: { id: splitId },
      include: { expense: true },
    });

    if (!split) throw new NotFoundException('Split debt not found.');
    if (split.expense.payerId !== user.userId) {
      throw new ForbiddenException('Only the payer/creditor can verify this settlement.');
    }

    // Fetch creditor name
    const creditorUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true },
    });
    const creditorName = creditorUser?.fullName ?? 'The creditor';

    if (action === 'approve') {
      const updated = await this.prisma.expenseSplit.update({
        where: { id: splitId },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
        },
      });

      // Notify debtor
      this.notifications.notifySpecificUsers(
        [split.userId],
        {
          hostelId: user.hostelId,
          type: 'individual',
          title: '✅ Settlement Approved',
          body: `Your payment of ₹${split.amount} for "${split.expense.title}" was approved by ${creditorName}.`,
          data: { splitId },
        }
      ).catch(() => {});

      return updated;
    } else {
      const updated = await this.prisma.expenseSplit.update({
        where: { id: splitId },
        data: { status: 'UNPAID' },
      });

      // Notify debtor
      this.notifications.notifySpecificUsers(
        [split.userId],
        {
          hostelId: user.hostelId,
          type: 'individual',
          title: '❌ Settlement Declined',
          body: `Your payment of ₹${split.amount} for "${split.expense.title}" was declined by ${creditorName}. Please contact them.`,
          data: { splitId },
        }
      ).catch(() => {});

      return updated;
    }
  }

  async getBudgetStatus(user: AuthUser) {
    const budget = await this.prisma.studentBudget.findUnique({
      where: { userId: user.userId },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Calculate sum of expenses paid by X in this month
    const paidSum = await this.prisma.expense.aggregate({
      where: {
        payerId: user.userId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // 2. Calculate sum of split amounts on X's expenses (what others owe X)
    const othersOweSum = await this.prisma.expenseSplit.aggregate({
      where: {
        expense: {
          payerId: user.userId,
          createdAt: { gte: startOfMonth },
        },
      },
      _sum: { amount: true },
    });

    // 3. Calculate sum of splits X owed and settled (paid) in this month
    const settledOwedSum = await this.prisma.expenseSplit.aggregate({
      where: {
        userId: user.userId,
        status: 'SETTLED',
        settledAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const totalPaidExpenses = paidSum._sum.amount || 0;
    const totalOthersOwe = othersOweSum._sum.amount || 0;
    const totalSettledOwed = settledOwedSum._sum.amount || 0;

    // Net Spent calculation: net = paid - othersOwe + settledOwed
    const netSpent = Number((totalPaidExpenses - totalOthersOwe + totalSettledOwed).toFixed(2));
    const limit = budget?.monthlyLimit ?? 5000; // default 5000 limit

    return {
      monthlyLimit: limit,
      totalSpent: Math.max(0, netSpent),
      percentSpent: limit > 0 ? Math.round((Math.max(0, netSpent) / limit) * 100) : 0,
      breakdown: {
        paidExpenses: totalPaidExpenses,
        othersOwedToYou: totalOthersOwe,
        settledSplitsYouPaid: totalSettledOwed,
      },
    };
  }

  async updateBudget(user: AuthUser, limit: number) {
    if (limit < 0) throw new BadRequestException('Budget limit cannot be negative.');

    return this.prisma.studentBudget.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        monthlyLimit: limit,
      },
      update: {
        monthlyLimit: limit,
      },
    });
  }

  async getMembers(user: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        hostelId: user.hostelId,
        role: { in: ['student', 'warden', 'staff'] as any },
        status: 'active',
        deletedAt: null,
        id: { not: user.userId },
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        email: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }
}
