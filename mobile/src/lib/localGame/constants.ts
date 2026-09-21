export const GAME_TCP_PORT = 51999;
export const DISCOVERY_UDP_PORT = 51998;
export const DISCOVERY_PROTO = 'aifdms-discovery';
export const DISCOVERY_BROADCAST_INTERVAL_MS = 1500;
export const DISCOVERY_STALE_MS = 4000;

/**
 * True if `ip` looks like a real local-network address (WiFi or phone hotspot),
 * as opposed to empty/loopback/cellular-only. Used to block hosting a local
 * game when neither WiFi nor hotspot is actually on.
 */
export function isLikelyLanIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  if (ip === '0.0.0.0' || ip.startsWith('127.')) return false;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
