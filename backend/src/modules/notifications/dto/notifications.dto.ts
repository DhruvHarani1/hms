import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { DevicePlatform, MealType } from '@prisma/client';

export class MealReadyDto {
  @IsIn(['breakfast', 'lunch', 'dinner'])
  mealType: MealType;

  @IsOptional()
  @IsString()
  menu?: string;
}

export class RegisterDeviceDto {
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @IsString()
  @IsNotEmpty()
  token: string;
}

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}
