import { IsString, IsEnum, IsOptional, IsArray, IsUUID, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsEnum(['direct', 'group'])
  type: 'direct' | 'group';

  /** Required for group conversations. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  /** User IDs to add. For 'direct', exactly 1 ID (the other person). */
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds: string[];
}

export class SendMessageDto {
  @IsEnum(['text', 'image'])
  @IsOptional()
  type?: 'text' | 'image';

  /** Text body (for text) or Cloudinary public_id (for image). */
  @IsString()
  @MaxLength(4000)
  content: string;
}

export class AddMemberDto {
  @IsUUID('4')
  userId: string;
}
