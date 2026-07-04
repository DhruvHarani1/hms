import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/** Mark/unmark a single meal (lunch or dinner) on a date. Breakfast derived. */
export class MarkMealDto {
  @IsString()
  @IsNotEmpty()
  date: string; // "YYYY-MM-DD"

  @IsIn(['lunch', 'dinner'])
  meal: 'lunch' | 'dinner';

  @IsBoolean()
  marked: boolean;
}

/** Bulk mark/unmark across a whole month. */
export class BulkMealDto {
  @IsOptional()
  @IsString()
  month?: string; // "YYYY-MM"

  @IsIn(['lunch', 'dinner', 'both'])
  meal: 'lunch' | 'dinner' | 'both';

  @IsBoolean()
  marked: boolean;
}
