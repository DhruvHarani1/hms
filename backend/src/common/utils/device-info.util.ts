/**
 * Device-info utilities for transactional emails (login alerts, etc.).
 *
 * - parseUserAgent(): lightweight regex UA parser (no npm dep).
 * - geoFromIp(): free IP geolocation via ip-api.com.
 * - buildDeviceInfo(): combines both into a mail-ready DeviceInfo object.
 */

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  city: string;
  country: string;
  ip: string;       // partially masked (last octet → xx)
  time: string;     // formatted in IST
}

// ── User-Agent parsing ──────────────────────────────────────────────

interface ParsedUA {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(ua: string | undefined): ParsedUA {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };

  // Browser detection (order matters — Edge contains Chrome, etc.)
  let browser = 'Unknown browser';
  if (/Expo/.test(ua)) {
    browser = 'AIFDMS Hostel App';
  } else if (/Edg\/(\d+)/.test(ua)) {
    browser = `Edge ${RegExp.$1}`;
  } else if (/OPR\/(\d+)/.test(ua)) {
    browser = `Opera ${RegExp.$1}`;
  } else if (/Chrome\/(\d+)/.test(ua) && !/Chromium/.test(ua)) {
    browser = `Chrome ${RegExp.$1}`;
  } else if (/Safari\/[\d.]+/.test(ua) && /Version\/(\d+)/.test(ua)) {
    browser = `Safari ${RegExp.$1}`;
  } else if (/Firefox\/(\d+)/.test(ua)) {
    browser = `Firefox ${RegExp.$1}`;
  }

  // OS detection
  let os = 'Unknown OS';
  if (/Windows NT 10/.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X ([\d_]+)/.test(ua)) {
    os = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
  } else if (/Android ([\d.]+)/.test(ua)) {
    os = `Android ${RegExp.$1}`;
  } else if (/iPhone OS ([\d_]+)/.test(ua) || /iPad.*OS ([\d_]+)/.test(ua)) {
    os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  } else if (/CrOS/.test(ua)) {
    os = 'Chrome OS';
  }

  // Device type
  let device = 'Desktop';
  if (/iPhone/.test(ua)) {
    device = 'iPhone';
  } else if (/iPad/.test(ua)) {
    device = 'iPad';
  } else if (/Android/.test(ua)) {
    device = /Mobile/.test(ua) ? 'Android Phone' : 'Android Tablet';
  } else if (/Expo/.test(ua)) {
    device = 'Mobile App';
  }

  return { browser, os, device };
}

// ── IP geolocation (ip-api.com, free, no key, 45 req/min) ───────────

interface GeoResult {
  city: string;
  country: string;
}

const PRIVATE_IP =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|0\.0\.0\.0|localhost)/;

export async function geoFromIp(ip: string): Promise<GeoResult> {
  const fallback: GeoResult = { city: 'Unknown', country: 'Unknown' };

  if (!ip || PRIVATE_IP.test(ip)) {
    return { city: 'Local network', country: '' };
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    if (data.status !== 'success') return fallback;
    return {
      city: data.city || 'Unknown',
      country: data.country || 'Unknown',
    };
  } catch {
    return fallback;
  }
}

// ── Combine into DeviceInfo ─────────────────────────────────────────

function maskIp(ip: string): string {
  if (!ip) return 'Unknown';
  // IPv4: mask last octet
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return ip.replace(/\.\d+$/, '.xx');
  }
  // IPv6: truncate
  return ip.length > 12 ? ip.slice(0, 12) + '…' : ip;
}

function formatTimeIST(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' IST';
}

/**
 * Extract device info from an Express request object.
 * Safe to call fire-and-forget — never throws.
 */
export async function buildDeviceInfo(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): Promise<DeviceInfo> {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ??
    req.ip ??
    '';

  const ua = (typeof req.headers['user-agent'] === 'string'
    ? req.headers['user-agent']
    : undefined) ?? '';

  const parsed = parseUserAgent(ua);
  const geo = await geoFromIp(rawIp);

  return {
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    city: geo.city,
    country: geo.country,
    ip: maskIp(rawIp),
    time: formatTimeIST(new Date()),
  };
}
