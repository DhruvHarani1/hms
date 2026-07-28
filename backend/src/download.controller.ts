import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from './common/decorators/public.decorator';

// Permanent GitHub Release asset link (never expires)
const PERMANENT_GITHUB_APK_URL =
  'https://github.com/DhruvHarani1/hms/releases/download/v1.1.0/app-release.apk';

@Public()
@Controller('download')
export class DownloadController {
  @Get('version')
  getVersion() {
    return {
      latestVersion: process.env.APP_LATEST_VERSION || '1.1.0',
      minRequiredVersion: process.env.APP_MIN_REQUIRED_VERSION || '1.0.0',
      downloadUrl:
        process.env.APP_DOWNLOAD_URL ||
        'https://hms-api-47qf.onrender.com/api/v1/download',
      apkUrl: process.env.PERMANENT_APK_URL || PERMANENT_GITHUB_APK_URL,
    };
  }

  @Get('apk')
  redirectApk(@Res() res: Response) {
    const targetUrl = process.env.PERMANENT_APK_URL || PERMANENT_GITHUB_APK_URL;
    return res.redirect(302, targetUrl);
  }

  @Get()
  getDownloadRedirect(@Res() res: Response) {
    const targetUrl = process.env.PERMANENT_APK_URL || PERMANENT_GITHUB_APK_URL;
    return res.redirect(302, targetUrl);
  }
}
