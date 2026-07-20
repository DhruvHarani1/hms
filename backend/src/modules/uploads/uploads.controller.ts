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
  @IsIn(['aadhaar', 'course_proof', 'photo', 'complaint'])
  kind: 'aadhaar' | 'course_proof' | 'photo' | 'complaint';

  @IsString()
  @IsNotEmpty()
  contentType: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  /** Student asks for a signed Cloudinary upload payload for their own doc. */
  @Post('sign')
  @HttpCode(200)
  sign(@CurrentUser() user: AuthUser, @Body() dto: SignUploadDto) {
    const publicId = this.service.buildPublicId(
      user.hostelId,
      user.userId,
      dto.kind,
    );
    // `key` = the public_id the app should save to its profile after upload.
    return { ...this.service.signUpload(publicId), key: publicId };
  }

  /** Signed view/download URL for a document. Owner or same-hostel warden. */
  @Get('url')
  url(@CurrentUser() user: AuthUser, @Query('key') key: string) {
    if (!key) throw new BadRequestException('key required');
    const isWarden = user.role === 'warden' || user.role === 'staff';
    const ownsIt = key.startsWith(`${user.hostelId}/${user.userId}/`);
    const inHostel = key.startsWith(`${user.hostelId}/`);
    if (!(ownsIt || (isWarden && inHostel))) {
      throw new ForbiddenException();
    }
    return { url: this.service.signedViewUrl(key) };
  }
}
