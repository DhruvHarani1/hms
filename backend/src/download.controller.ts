import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from './common/decorators/public.decorator';

const APK_URL =
  'https://expo.dev/artifacts/eas/RzMNNDiymDBau__PUuT4uJKbnzXGm6asCzOdtucanMs.apk';

@Public()
@Controller('download')
export class DownloadController {
  @Get('version')
  getVersion() {
    return {
      latestVersion: process.env.APP_LATEST_VERSION || '1.0.0',
      minRequiredVersion: process.env.APP_MIN_REQUIRED_VERSION || '1.0.0',
      downloadUrl:
        process.env.APP_DOWNLOAD_URL ||
        'https://hms-api-47qf.onrender.com/api/v1/download',
      apkUrl: APK_URL,
    };
  }

  @Get('apk')
  redirectApk(@Res() res: Response) {
    return res.redirect(302, APK_URL);
  }

  @Get()
  getDownloadRedirect(@Res() res: Response) {
    return res.redirect(302, APK_URL);
  }
}
