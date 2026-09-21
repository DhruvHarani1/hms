import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsIn(['uno', 'ludo'])
  gameType: 'uno' | 'ludo';
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class MoveDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsOptional()
  payload?: Record<string, any>;
}
