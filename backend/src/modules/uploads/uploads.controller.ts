import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  HttpCode,
} from '@nestjs/common';
import { IsIn, IsString, IsNotEmpty } from 'class-validator';
import { UploadsService } from './uploads.service';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

class SignUploadDto {
  @IsIn(['aadhaar', 'course_proof', 'photo'])
  kind: 'aadhaar' | 'course_proof' | 'photo';

  @IsString()
  @IsNotEmpty()
  contentType: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  /** Student requests a presigned PUT to upload their own document. */
  @Post('sign')
  @HttpCode(200)
  async sign(@CurrentUser() user: AuthUser, @Body() dto: SignUploadDto) {
    const key = this.service.buildKey(
      user.hostelId,
      user.userId,
      dto.kind,
      dto.contentType,
    );
    const uploadUrl = await this.service.presignPut(key, dto.contentType);
    return { uploadUrl, key };
  }

  /** Presigned GET to view/download a document. Owner or same-hostel warden. */
  @Get('url')
  async url(@CurrentUser() user: AuthUser, @Query('key') key: string) {
    if (!key) throw new BadRequestException('key required');
    const isWarden = user.role === 'warden' || user.role === 'staff';
    const ownsIt = key.startsWith(`${user.hostelId}/${user.userId}/`);
    const inHostel = key.startsWith(`${user.hostelId}/`);
    if (!(ownsIt || (isWarden && inHostel))) {
      throw new ForbiddenException();
    }
    const url = await this.service.presignGet(key);
    return { url };
  }
}
