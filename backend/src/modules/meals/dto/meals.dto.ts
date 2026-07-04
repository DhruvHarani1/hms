import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { MealType } from '@prisma/client';

/** Mark/unmark a single calendar day (one tick per day). */
export class MarkDayDto {
  @IsString()
  @IsNotEmpty()
  date: string; // "YYYY-MM-DD"

  @IsBoolean()
  marked: boolean;
}

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
