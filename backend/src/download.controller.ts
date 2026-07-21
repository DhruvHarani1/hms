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
  @Header('Content-Type', 'text/html')
  getDownloadPage() {
    const ver = process.env.APP_LATEST_VERSION || '1.0.0';
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIFDMS — Download the Official Hostel App</title>
<meta name="description" content="Download the AIFDMS Hostel Management mobile app for Android. Manage meals, split bills, file complaints, and stay updated with real-time alerts.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#050816;
  --surface:rgba(15,23,42,.55);
  --surface-2:rgba(15,23,42,.35);
  --border:rgba(148,163,184,.08);
  --border-hover:rgba(99,102,241,.35);
  --primary:#6366f1;
  --primary-light:#818cf8;
  --accent:#06b6d4;
  --green:#10b981;
  --text:#f1f5f9;
  --muted:#94a3b8;
  --muted-2:#64748b;
  --danger:#ef4444;
  --radius:20px;
}

html{scroll-behavior:smooth}
body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  background:var(--bg);color:var(--text);
  overflow-x:hidden;line-height:1.6;
  -webkit-font-smoothing:antialiased;
}

/* ─── Ambient Glows ─── */
.orb{position:fixed;border-radius:50%;pointer-events:none;filter:blur(120px);opacity:.45;z-index:0}
.orb-1{width:700px;height:700px;background:radial-gradient(circle,rgba(99,102,241,.35),transparent 70%);top:-15%;left:30%}
.orb-2{width:500px;height:500px;background:radial-gradient(circle,rgba(6,182,212,.2),transparent 70%);bottom:10%;right:-5%}
.orb-3{width:400px;height:400px;background:radial-gradient(circle,rgba(139,92,246,.2),transparent 70%);top:50%;left:-10%}

/* ─── Grid Pattern ─── */
body::before{
  content:'';position:fixed;inset:0;z-index:0;
  background-image:
    linear-gradient(rgba(148,163,184,.03) 1px,transparent 1px),
    linear-gradient(90deg,rgba(148,163,184,.03) 1px,transparent 1px);
  background-size:64px 64px;
  mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%);
  -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%);
}

.page{position:relative;z-index:1;width:100%;max-width:1100px;margin:0 auto;padding:0 20px}

/* ─── Nav ─── */
nav{
  position:sticky;top:0;z-index:50;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  background:rgba(5,8,22,.7);
  border-bottom:1px solid var(--border);
  padding:16px 0;
}
.nav-inner{display:flex;align-items:center;justify-content:space-between;max-width:1100px;margin:0 auto;padding:0 20px}
.nav-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;text-decoration:none;color:var(--text)}
.nav-logo-icon{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--primary),#4338ca);display:flex;align-items:center;justify-content:center;font-size:18px;border:1px solid rgba(255,255,255,.12)}
.nav-links{display:flex;gap:28px}
.nav-links a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500;transition:color .2s}
.nav-links a:hover{color:var(--text)}
.nav-dl{
  background:var(--primary);color:#fff;text-decoration:none;
  padding:8px 20px;border-radius:10px;font-weight:600;font-size:14px;
  transition:all .2s;box-shadow:0 4px 12px rgba(99,102,241,.3);
}
.nav-dl:hover{background:#4f46e5;transform:translateY(-1px)}

/* ─── Hero ─── */
.hero{padding:100px 0 80px;text-align:center;display:flex;flex-direction:column;align-items:center}
.hero-badge{
  display:inline-flex;align-items:center;gap:8px;
  padding:7px 18px;border-radius:999px;
  background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);
  color:#6ee7b7;font-size:12px;font-weight:700;letter-spacing:.8px;
  text-transform:uppercase;margin-bottom:28px;
  animation:fadeDown .6s ease;
}
.hero-badge-dot{width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 12px #10b981;animation:blink 2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes fadeDown{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

h1{
  font-size:clamp(38px,6vw,64px);font-weight:900;
  letter-spacing:-.04em;line-height:1.08;
  margin-bottom:20px;animation:fadeUp .7s ease .1s both;
}
h1 .grad{
  background:linear-gradient(135deg,var(--primary-light),var(--accent));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.hero-sub{
  font-size:clamp(16px,2.2vw,19px);color:var(--muted);max-width:600px;
  margin-bottom:40px;animation:fadeUp .7s ease .2s both;
}

.hero-cta{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;animation:fadeUp .7s ease .3s both}
.btn-primary{
  display:inline-flex;align-items:center;gap:10px;
  background:linear-gradient(135deg,var(--primary),#4338ca);color:#fff;
  padding:16px 36px;border-radius:16px;font-weight:700;font-size:16px;
  text-decoration:none;transition:all .3s cubic-bezier(.4,0,.2,1);
  box-shadow:0 8px 30px rgba(99,102,241,.35);
  border:1px solid rgba(255,255,255,.1);
}
.btn-primary:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(99,102,241,.5)}
.btn-secondary{
  display:inline-flex;align-items:center;gap:10px;
  background:var(--surface);color:var(--text);
  padding:16px 36px;border-radius:16px;font-weight:700;font-size:16px;
  text-decoration:none;transition:all .3s;
  border:1px solid var(--border);
}
.btn-secondary:hover{border-color:var(--border-hover);background:rgba(99,102,241,.06);transform:translateY(-2px)}

.hero-meta{
  display:flex;gap:32px;margin-top:36px;
  animation:fadeUp .7s ease .4s both;
}
.hero-stat{text-align:center}
.hero-stat-val{font-size:28px;font-weight:800;color:var(--text)}
.hero-stat-label{font-size:12px;color:var(--muted-2);font-weight:600;text-transform:uppercase;letter-spacing:.5px}

/* ─── Phone Mockup ─── */
.mockup-section{display:flex;justify-content:center;padding:0 0 80px;animation:fadeUp .8s ease .5s both}
.phone-frame{
  width:280px;height:560px;border-radius:40px;
  background:linear-gradient(145deg,#1e293b,#0f172a);
  border:2px solid rgba(148,163,184,.12);
  box-shadow:0 40px 80px -20px rgba(0,0,0,.6),0 0 60px rgba(99,102,241,.08);
  padding:12px;position:relative;overflow:hidden;
}
.phone-notch{
  width:120px;height:28px;background:#050816;border-radius:0 0 16px 16px;
  position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:3;
}
.phone-screen{
  width:100%;height:100%;border-radius:30px;overflow:hidden;
  background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%);
  display:flex;flex-direction:column;align-items:center;
  padding:48px 20px 20px;gap:16px;
}
.ps-greeting{font-size:11px;color:var(--muted);font-weight:600;width:100%}
.ps-title{font-size:18px;font-weight:800;width:100%}
.ps-card{
  width:100%;background:rgba(30,41,59,.6);border:1px solid var(--border);
  border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;
}
.ps-card-icon{font-size:22px;flex-shrink:0}
.ps-card-text{font-size:11px;font-weight:600;color:var(--muted)}
.ps-card-val{font-size:15px;font-weight:700;margin-top:2px}
.ps-tabs{
  width:100%;margin-top:auto;
  display:flex;justify-content:space-around;
  padding:10px 0 4px;border-top:1px solid var(--border);
}
.ps-tab{font-size:18px;opacity:.5}
.ps-tab.active{opacity:1}

/* ─── Section Titles ─── */
.section{padding:80px 0}
.section-label{
  display:inline-flex;align-items:center;gap:6px;
  font-size:12px;font-weight:700;color:var(--primary-light);
  text-transform:uppercase;letter-spacing:1.2px;margin-bottom:14px;
}
.section-title{font-size:clamp(28px,4vw,40px);font-weight:800;letter-spacing:-.03em;margin-bottom:16px}
.section-desc{font-size:16px;color:var(--muted);max-width:560px}

/* ─── Features ─── */
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin-top:48px}
.feat{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:28px;transition:all .3s;position:relative;overflow:hidden;
}
.feat::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--primary),transparent);
  opacity:0;transition:opacity .3s;
}
.feat:hover{border-color:var(--border-hover);transform:translateY(-4px)}
.feat:hover::before{opacity:1}
.feat-icon{font-size:32px;margin-bottom:16px;display:inline-block}
.feat-title{font-size:17px;font-weight:700;margin-bottom:8px}
.feat-desc{font-size:14px;color:var(--muted);line-height:1.6}

/* ─── Stats Banner ─── */
.stats-banner{
  display:grid;grid-template-columns:repeat(4,1fr);gap:16px;
  margin-top:48px;
}
.stat-card{
  text-align:center;padding:28px 16px;
  background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);
}
.stat-num{font-size:32px;font-weight:900;margin-bottom:4px}
.stat-num.c1{color:var(--primary-light)}
.stat-num.c2{color:var(--accent)}
.stat-num.c3{color:var(--green)}
.stat-num.c4{color:#f59e0b}
.stat-label{font-size:13px;color:var(--muted-2);font-weight:500}

/* ─── How It Works ─── */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:48px}
.step{
  background:var(--surface-2);border:1px solid var(--border);
  border-radius:var(--radius);padding:28px;
  position:relative;transition:border-color .3s;
}
.step:hover{border-color:var(--border-hover)}
.step-num{
  width:36px;height:36px;border-radius:12px;
  background:linear-gradient(135deg,var(--primary),#4338ca);
  color:#fff;font-weight:800;font-size:15px;
  display:flex;align-items:center;justify-content:center;
  margin-bottom:16px;
}
.step h4{font-size:16px;font-weight:700;margin-bottom:8px}
.step p{font-size:13px;color:var(--muted);line-height:1.6}

/* ─── CTA ─── */
.cta-section{padding:100px 0;text-align:center}
.cta-box{
  background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(6,182,212,.08));
  border:1px solid rgba(99,102,241,.2);
  border-radius:28px;padding:56px 32px;
  position:relative;overflow:hidden;
}
.cta-box::before{
  content:'';position:absolute;top:-50%;left:50%;transform:translateX(-50%);
  width:600px;height:600px;
  background:radial-gradient(circle,rgba(99,102,241,.15),transparent 70%);
  pointer-events:none;
}
.cta-box h2{font-size:clamp(26px,4vw,38px);font-weight:800;letter-spacing:-.03em;margin-bottom:16px;position:relative}
.cta-box p{font-size:16px;color:var(--muted);max-width:480px;margin:0 auto 32px;position:relative}
.cta-box .btn-primary{position:relative}

/* ─── Footer ─── */
footer{
  border-top:1px solid var(--border);
  padding:40px 0;text-align:center;
}
.footer-inner{max-width:1100px;margin:0 auto;padding:0 20px}
.footer-brand{font-weight:800;font-size:16px;margin-bottom:8px}
.footer-copy{font-size:13px;color:var(--muted-2)}
.footer-links{display:flex;justify-content:center;gap:24px;margin-top:16px}
.footer-links a{font-size:13px;color:var(--muted);text-decoration:none;transition:color .2s}
.footer-links a:hover{color:var(--text)}

/* ─── Responsive ─── */
@media(max-width:768px){
  .nav-links{display:none}
  .hero{padding:64px 0 48px}
  .hero-meta{gap:20px}
  .hero-stat-val{font-size:22px}
  .stats-banner{grid-template-columns:repeat(2,1fr)}
  .phone-frame{width:240px;height:480px}
  .cta-box{padding:40px 20px}
}
@media(max-width:480px){
  .hero-cta{flex-direction:column;width:100%}
  .btn-primary,.btn-secondary{width:100%;justify-content:center}
  .hero-meta{flex-direction:column;gap:12px}
  .stats-banner{grid-template-columns:1fr 1fr}
}
</style>
</head>
<body>

<!-- Ambient Orbs -->
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>

<!-- Nav -->
<nav>
  <div class="nav-inner">
    <a href="#" class="nav-logo">
      <div class="nav-logo-icon">🏢</div>
      AIFDMS
    </a>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#how-it-works">Install Guide</a>
      <a href="#download">Download</a>
    </div>
    <a href="${APK_URL}" class="nav-dl">Download APK</a>
  </div>
</nav>

<div class="page">

  <!-- Hero -->
  <section class="hero" id="hero">
    <div class="hero-badge">
      <div class="hero-badge-dot"></div>
      Live &amp; Available Now
    </div>
    <h1>Your Hostel,<br><span class="grad">One App Away</span></h1>
    <p class="hero-sub">AIFDMS is the all-in-one mobile platform for hostel residents, wardens, and kitchen staff. Meals, bills, complaints, attendance — managed effortlessly.</p>
    <div class="hero-cta">
      <a href="${APK_URL}" class="btn-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download for Android
      </a>
      <a href="#features" class="btn-secondary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Learn More
      </a>
    </div>
    <div class="hero-meta">
      <div class="hero-stat">
        <div class="hero-stat-val">v${ver}</div>
        <div class="hero-stat-label">Latest Version</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-val">Android</div>
        <div class="hero-stat-label">Platform</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-val">Free</div>
        <div class="hero-stat-label">No Charges</div>
      </div>
    </div>
  </section>

  <!-- Phone Mockup -->
  <section class="mockup-section">
    <div class="phone-frame">
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <div class="ps-greeting">Good Morning 👋</div>
        <div class="ps-title">Dashboard</div>
        <div class="ps-card">
          <div class="ps-card-icon">🍽️</div>
          <div>
            <div class="ps-card-text">Today's Lunch</div>
            <div class="ps-card-val">Dal Makhani, Roti</div>
          </div>
        </div>
        <div class="ps-card">
          <div class="ps-card-icon">💰</div>
          <div>
            <div class="ps-card-text">Pending Splits</div>
            <div class="ps-card-val">₹340 from 2 people</div>
          </div>
        </div>
        <div class="ps-card">
          <div class="ps-card-icon">📝</div>
          <div>
            <div class="ps-card-text">Active Complaints</div>
            <div class="ps-card-val">Plumbing — In Progress</div>
          </div>
        </div>
        <div class="ps-tabs">
          <span class="ps-tab active">🏠</span>
          <span class="ps-tab">🍽️</span>
          <span class="ps-tab">📝</span>
          <span class="ps-tab">⚙️</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Banner -->
  <div class="stats-banner">
    <div class="stat-card">
      <div class="stat-num c1">6+</div>
      <div class="stat-label">Core Modules</div>
    </div>
    <div class="stat-card">
      <div class="stat-num c2">3</div>
      <div class="stat-label">User Roles</div>
    </div>
    <div class="stat-card">
      <div class="stat-num c3">Real-time</div>
      <div class="stat-label">Push Notifications</div>
    </div>
    <div class="stat-card">
      <div class="stat-num c4">100%</div>
      <div class="stat-label">Free &amp; Open</div>
    </div>
  </div>

  <!-- Features -->
  <section class="section" id="features">
    <div class="section-label">⚡ Features</div>
    <div class="section-title">Everything Your Hostel Needs</div>
    <div class="section-desc">From daily meals to monthly expense settlements — AIFDMS replaces paper registers, WhatsApp groups, and manual tracking with one beautiful app.</div>
    <div class="features-grid">
      <div class="feat">
        <div class="feat-icon">🍽️</div>
        <div class="feat-title">Smart Meal System</div>
        <div class="feat-desc">Mark daily meal attendance, view weekly menus set by the warden, and rate food quality to give feedback to the kitchen.</div>
      </div>
      <div class="feat">
        <div class="feat-icon">💸</div>
        <div class="feat-title">Bill Splitting</div>
        <div class="feat-desc">Split dinner bills, grocery runs, or any group expense equally, by percentage, or custom amounts. Settlements need approval from both sides.</div>
      </div>
      <div class="feat">
        <div class="feat-icon">📷</div>
        <div class="feat-title">Photo Complaints</div>
        <div class="feat-desc">Snap a photo of broken fixtures, leaking taps, or dirty rooms. Track resolution status in real-time with warden updates.</div>
      </div>
      <div class="feat">
        <div class="feat-icon">📢</div>
        <div class="feat-title">Instant Notifications</div>
        <div class="feat-desc">Receive push alerts for warden notices, leave approvals, meal schedule changes, birthday wishes, and more.</div>
      </div>
      <div class="feat">
        <div class="feat-icon">📋</div>
        <div class="feat-title">Attendance Tracking</div>
        <div class="feat-desc">Wardens can mark daily hostel attendance, generate reports, and monitor student presence over weeks and months.</div>
      </div>
      <div class="feat">
        <div class="feat-icon">💬</div>
        <div class="feat-title">In-App Chat</div>
        <div class="feat-desc">Students and wardens can communicate directly through private messaging channels without sharing personal numbers.</div>
      </div>
      <div class="feat">
        <div class="feat-icon">🏖️</div>
        <div class="feat-title">Leave Management</div>
        <div class="feat-desc">Students submit leave requests digitally. Wardens approve or decline with a single tap and a reason note.</div>
      </div>
      <div class="feat">
        <div class="feat-icon">📊</div>
        <div class="feat-title">Budget Tracker</div>
        <div class="feat-desc">Set a monthly spending limit and track your personal and shared expenses with visual progress meters and analytics.</div>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section class="section" id="how-it-works">
    <div class="section-label">📲 Installation</div>
    <div class="section-title">Up &amp; Running in 3 Steps</div>
    <div class="section-desc">No Google Play Store needed — download and install directly from this page in under a minute.</div>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <h4>Download the APK</h4>
        <p>Tap the <strong>"Download for Android"</strong> button above. The APK file will be saved to your phone's Downloads folder.</p>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <h4>Allow Installation</h4>
        <p>Open the downloaded file. If prompted, tap <strong>Settings → Allow from this source</strong> to enable sideloading, then tap <strong>Install</strong>.</p>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <h4>Sign In &amp; Go</h4>
        <p>Launch the app, register with your hostel email, verify your account, and you're ready to manage everything on your phone.</p>
      </div>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="cta-section" id="download">
    <div class="cta-box">
      <h2>Ready to Simplify Hostel Life?</h2>
      <p>Join your fellow residents. Download the AIFDMS app now and leave the chaos of manual tracking behind.</p>
      <a href="${APK_URL}" class="btn-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download v${ver} for Android
      </a>
    </div>
  </section>

</div>

<!-- Footer -->
<footer>
  <div class="footer-inner">
    <div class="footer-brand">AIFDMS Hostel Management</div>
    <div class="footer-copy">© ${new Date().getFullYear()} All rights reserved. Built for better hostel living.</div>
    <div class="footer-links">
      <a href="#features">Features</a>
      <a href="#how-it-works">Install Guide</a>
      <a href="#download">Download</a>
    </div>
  </div>
</footer>

</body>
</html>`;
  }
}
