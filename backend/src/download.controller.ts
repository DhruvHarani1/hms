import { Controller, Get, Header, Res } from '@nestjs/common';
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
      downloadUrl: process.env.APP_DOWNLOAD_URL || 'https://hms-api-47qf.onrender.com/api/v1/download',
      apkUrl: APK_URL,
    };
  }

  @Get('apk')
  redirectApk(@Res() res: Response) {
    return res.redirect(302, APK_URL);
  }

  @Get()
  @Header('Content-Type', 'text/html')
  getDownloadPage() {
    const latestVersion = process.env.APP_LATEST_VERSION || '1.0.0';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download AIFDMS Hostel App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      padding: 40px 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      background: rgba(79, 70, 229, 0.2);
      border: 1px solid rgba(129, 140, 248, 0.3);
      color: #a5b4fc;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 24px;
    }
    .icon-container {
      width: 88px;
      height: 88px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px auto;
      font-size: 44px;
      box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 28px;
      border-radius: 16px;
      font-weight: 700;
      font-size: 16px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px 0 rgba(79, 70, 229, 0.5);
    }
    .footer-text {
      margin-top: 24px;
      font-size: 13px;
      color: #64748b;
    }
    .footer-text span {
      color: #38bdf8;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Official Mobile Release</div>
    <div class="icon-container">📱</div>
    <h1>AIFDMS Hostel App</h1>
    <p>Download the latest version of the hostel application for seamless meal attendance, bill splitting, complaints, and notices.</p>
    <a href="${APK_URL}" class="btn">
      <span>📥 Download Android APK</span>
    </a>
    <div class="footer-text">
      Current Release: <span>v${latestVersion}</span> • Android 8.0+
    </div>
  </div>
</body>
</html>`;
  }
}
