import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { ComplaintPriority, ComplaintStatus } from '@prisma/client';

export class CreateComplaintDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[]; // array of file URLs (uploaded client-side)
}

export class UpdateComplaintDto {
  @IsOptional()
  @IsIn(['pending', 'in_progress', 'resolved', 'closed'])
  status?: ComplaintStatus;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: ComplaintPriority;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class ReplyComplaintDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}
