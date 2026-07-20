import { Body, Controller, Get, Param, Post, HttpCode } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  UpdateBudgetDto,
  VerifySettleDto,
} from './dto/expenses.dto';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

@Controller('expenses')
export class ExpenseController {
  constructor(private readonly service: ExpensesService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.service.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Get('balances')
  getBalances(@CurrentUser() user: AuthUser) {
    return this.service.getBalances(user);
  }

  @Post('splits/:id/request-settle')
  @HttpCode(200)
  requestSettle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.requestSettle(user, id);
  }

  @Post('splits/:id/verify-settle')
  @HttpCode(200)
  verifySettle(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VerifySettleDto,
  ) {
    return this.service.verifySettle(user, id, dto.action);
  }

  @Get('budget')
  getBudgetStatus(@CurrentUser() user: AuthUser) {
    return this.service.getBudgetStatus(user);
  }

  @Post('budget')
  @HttpCode(200)
  updateBudget(@CurrentUser() user: AuthUser, @Body() dto: UpdateBudgetDto) {
    return this.service.updateBudget(user, dto.monthlyLimit);
  }

  @Get('members')
  getMembers(@CurrentUser() user: AuthUser) {
    return this.service.getMembers(user);
  }
}
