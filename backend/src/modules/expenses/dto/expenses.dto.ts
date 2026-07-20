import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SplitType } from '@prisma/client';

export class ParticipantSplitDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  amount: number;

  @IsEnum(SplitType)
  splitType: SplitType;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantSplitDto)
  participants: ParticipantSplitDto[];
}

export class UpdateBudgetDto {
  @IsNumber()
  monthlyLimit: number;
}

export class VerifySettleDto {
  @IsString()
  @IsNotEmpty()
  action: 'approve' | 'decline';
}
