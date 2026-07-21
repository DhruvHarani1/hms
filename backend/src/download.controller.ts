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
  <title>AIFDMS Hostel App — Official Mobile Release</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.4);
      --bg: #090d16;
      --card-bg: rgba(17, 24, 39, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      overflow-x: hidden;
      position: relative;
    }

    /* Ambient Background Glow */
    .glow-1 {
      position: absolute;
      top: -10%;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(0, 0, 0, 0) 70%);
      pointer-events: none;
      z-index: 0;
    }

    .glow-2 {
      position: absolute;
      bottom: -10%;
      right: 10%;
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
      pointer-events: none;
      z-index: 0;
    }

    .container {
      width: 100%;
      max-width: 840px;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    /* Header Section */
    .header {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(129, 140, 248, 0.25);
      color: #a5b4fc;
      padding: 6px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 20px;
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      background-color: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }

    .logo-box {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
      border-radius: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      font-size: 52px;
      box-shadow: 0 20px 40px -10px var(--primary-glow);
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    h1 {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 17px;
      line-height: 1.6;
      max-width: 540px;
    }

    /* Main Download CTA Card */
    .cta-card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--card-border);
      border-radius: 28px;
      padding: 36px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      position: relative;
      overflow: hidden;
    }

    .cta-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--primary), transparent);
    }

    .download-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      max-width: 380px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 18px 32px;
      border-radius: 18px;
      font-weight: 700;
      font-size: 17px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 10px 25px -5px var(--primary-glow);
    }

    .download-btn:hover {
      transform: translateY(-3px) scale(1.01);
      box-shadow: 0 15px 35px -5px rgba(99, 102, 241, 0.6);
    }

    .meta-info {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 20px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Features Grid */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .feature-card {
      background: rgba(17, 24, 39, 0.5);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 24px;
      transition: transform 0.2s, border-color 0.2s;
    }

    .feature-card:hover {
      transform: translateY(-2px);
      border-color: rgba(99, 102, 241, 0.3);
    }

    .feature-icon {
      font-size: 28px;
      margin-bottom: 12px;
      display: inline-block;
    }

    .feature-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #f1f5f9;
    }

    .feature-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    /* Steps Section */
    .steps-section {
      background: rgba(17, 24, 39, 0.4);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 28px;
    }

    .steps-title {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 20px;
      text-align: center;
    }

    .steps-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }

    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid var(--primary);
      color: #a5b4fc;
      font-weight: 800;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .step-text {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.5;
    }

    /* Footer */
    .footer {
      text-align: center;
      font-size: 13px;
      color: #64748b;
      margin-top: 12px;
    }

    @media (max-width: 640px) {
      h1 { font-size: 30px; }
      .cta-card { padding: 24px; }
      .download-btn { width: 100%; }
      .meta-info { flex-direction: column; gap: 8px; }
    }
  </style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>

  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="badge">
        <div class="badge-dot"></div>
        OFFICIAL HOSTEL RELEASE
      </div>
      <div class="logo-box">🏢</div>
      <h1>AIFDMS Hostel App</h1>
      <p class="subtitle">The complete mobile workspace for hostel students, wardens, and staff. Manage meals, split bills, submit complaints, and get live alerts.</p>
    </div>

    <!-- Download Card -->
    <div class="cta-card">
      <a href="${APK_URL}" class="download-btn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Android APK
      </a>
      <div class="meta-info">
        <div class="meta-item">📦 Version <span>v${latestVersion}</span></div>
        <div>•</div>
        <div class="meta-item">🤖 Android 8.0+</div>
        <div>•</div>
        <div class="meta-item">🔒 Verified Build</div>
      </div>
    </div>

    <!-- Features Grid -->
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">🍽️</div>
        <div class="feature-title">Meal Attendance</div>
        <div class="feature-desc">Mark meal attendance, inspect weekly mess menus, and rate daily food quality.</div>
      </div>

      <div class="feature-card">
        <div class="feature-icon">💸</div>
        <div class="feature-title">Room Expense Splitter</div>
        <div class="feature-desc">Split dinner and grocery bills with roommates or wardens with double-shake verification.</div>
      </div>

      <div class="feature-card">
        <div class="feature-icon">📝</div>
        <div class="feature-title">Photo Complaints</div>
        <div class="feature-desc">Snap photos of maintenance issues and track repair status updates in real-time.</div>
      </div>

      <div class="feature-card">
        <div class="feature-icon">📢</div>
        <div class="feature-title">Instant Alerts</div>
        <div class="feature-desc">Receive instant push notifications for notices, emergency announcements, and gate passes.</div>
      </div>
    </div>

    <!-- Installation Steps -->
    <div class="steps-section">
      <div class="steps-title">How to Install on Android</div>
      <div class="steps-container">
        <div class="step-item">
          <div class="step-num">1</div>
          <div class="step-text">Tap <strong>Download Android APK</strong> above to save the file to your device.</div>
        </div>
        <div class="step-item">
          <div class="step-num">2</div>
          <div class="step-text">Open the downloaded <strong>.apk</strong> file. If prompted by your browser, tap <strong>Settings</strong> and enable <em>"Allow from this source"</em>.</div>
        </div>
        <div class="step-item">
          <div class="step-num">3</div>
          <div class="step-text">Tap <strong>Install</strong>, launch the app, and log in with your hostel account credentials!</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      © AIFDMS Hostel Management System • All Rights Reserved
    </div>
  </div>
</body>
</html>`;
  }
}
