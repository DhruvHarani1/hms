import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
