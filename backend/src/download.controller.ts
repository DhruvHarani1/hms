import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from './common/decorators/public.decorator';

// Permanent download URL — update this after each new APK build
const WEBSITE_URL = 'https://aifdms-hostel-app.netlify.app';
const PERMANENT_GITHUB_APK_URL =
  'https://expo.dev/artifacts/eas/-ZyVaN1IkvMXNLGY3F3K6EaLBKjZ75nIgx8aTKyWl6g.apk';

@Public()
@Controller('download')
export class DownloadController {
  @Get('version')
  getVersion() {
    return {
      latestVersion: process.env.APP_LATEST_VERSION || '2.1.0',
      // Bumped to 2.1.0 — any app below this will see the "Update Required" screen
      minRequiredVersion: process.env.APP_MIN_REQUIRED_VERSION || '2.0.0',
      // downloadUrl shown in the "Update Required" screen — points to website/download
      downloadUrl:
        process.env.APP_DOWNLOAD_URL || WEBSITE_URL,
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
