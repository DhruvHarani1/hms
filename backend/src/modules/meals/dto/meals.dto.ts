import { ArrayNotEmpty, IsArray, IsIn, IsOptional } from 'class-validator';
import { MealType } from '@prisma/client';

export class MarkMealDto {
  /** ISO date string (yyyy-mm-dd). Defaults to today when omitted. */
  @IsOptional()
  date?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['breakfast', 'lunch', 'dinner'], { each: true })
  meals: MealType[];

  @IsOptional()
  @IsIn(['present', 'absent', 'opted_out'])
  status?: 'present' | 'absent' | 'opted_out';
}
