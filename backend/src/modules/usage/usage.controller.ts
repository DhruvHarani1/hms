import {
  Body,
  Controller,
  Get,
  Query,
  Post,
  Res,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { IsInt, Max, Min } from 'class-validator';
import { UsageService } from './usage.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

class HeartbeatDto {
  @IsInt()
  @Min(0)
  @Max(600)
  seconds: number;
}

@Controller('usage')
export class UsageController {
  constructor(private readonly service: UsageService) {}

  /** Any logged-in user silently pings foreground seconds. */
  @Post('heartbeat')
  @HttpCode(200)
  heartbeat(@CurrentUser() user: AuthUser, @Body() dto: HeartbeatDto) {
    return this.service.addSeconds(user.hostelId, user.userId, dto.seconds);
  }

  private checkKey(key?: string) {
    const secret = process.env.DEV_ANALYTICS_KEY;
    if (!secret || key !== secret) throw new ForbiddenException();
  }

  /** DEVELOPER-ONLY JSON, gated by ?key=DEV_ANALYTICS_KEY (not warden-visible). */
  @Public()
  @Get('dev/summary')
  async devSummary(@Query('key') key: string, @Query('days') days?: string) {
    this.checkKey(key);
    return this.service.summaryAllHostels(Number(days) || 7);
  }

  /** DEVELOPER-ONLY HTML dashboard, openable in your browser. */
  @Public()
  @Get('dev/dashboard')
  async devDashboard(
    @Query('key') key: string,
    @Query('days') days: string,
    @Res() res: Response,
  ) {
    this.checkKey(key);
    const d = Number(days) || 7;
    const data = await this.service.summaryAllHostels(d);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.html(data, d, key));
  }

  private esc(s: any): string {
    return String(s ?? '').replace(/[<>&"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string),
    );
  }

  private fmt(min: number): string {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  private html(data: any, days: number, key: string): string {
    const rows = data.users
      .map(
        (u: any, i: number) => `<tr>
        <td>${i + 1}</td>
        <td>${this.esc(u.name)}${u.role === 'cook' ? ' 🍳' : ''}</td>
        <td>${this.esc(u.hostel)}</td>
        <td style="text-align:right">${this.fmt(u.todayMinutes)}</td>
        <td style="text-align:right;font-weight:700">${this.fmt(u.totalMinutes)}</td>
        <td style="text-align:right">${u.activeDays}</td>
        <td style="text-align:right">${this.fmt(u.avgMinutesPerActiveDay)}</td>
      </tr>`,
      )
      .join('');
    const link = (d: number) =>
      `?key=${encodeURIComponent(key)}&days=${d}`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIFDMS — Usage Analytics</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
  .wrap{max-width:920px;margin:0 auto;padding:24px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#64748b;font-size:13px;margin-bottom:16px}
  .tabs{display:flex;gap:8px;margin-bottom:16px}
  .tabs a{padding:8px 16px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;text-decoration:none;color:#0f172a;font-weight:600}
  .tabs a.on{background:#4f46e5;color:#fff;border-color:#4f46e5}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  th,td{padding:10px 12px;font-size:14px;border-bottom:1px solid #f1f5f9}
  th{background:#f8fafc;text-align:left;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  tr:last-child td{border-bottom:none}
</style></head><body><div class="wrap">
  <h1>📊 AIFDMS — App Usage</h1>
  <div class="sub">Developer analytics · last ${days} day(s) · generated ${this.esc(data.generatedAt)} · minutes of active (foreground) time</div>
  <div class="tabs">
    <a class="${days === 1 ? 'on' : ''}" href="${link(1)}">Today</a>
    <a class="${days === 7 ? 'on' : ''}" href="${link(7)}">7 days</a>
    <a class="${days === 30 ? 'on' : ''}" href="${link(30)}">30 days</a>
  </div>
  <table>
    <tr><th>#</th><th>User</th><th>Hostel</th><th>Today</th><th>Total</th><th>Active days</th><th>Avg/day</th></tr>
    ${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No usage data yet</td></tr>'}
  </table>
</div></body></html>`;
  }
}
