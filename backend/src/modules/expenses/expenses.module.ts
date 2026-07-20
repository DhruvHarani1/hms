import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpenseController } from './expense.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [NotificationsModule, UploadsModule],
  controllers: [ExpenseController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
