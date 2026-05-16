// ---------------------------------------------------------------------------
// CIDR match.
//
// Supports IPv4 ranges like "10.0.0.0/8". IPv6 support can land later — for
// most deskless-team customers IPv4 office networks are the actual use case.
// ---------------------------------------------------------------------------

export function isValidIPv4Cidr(cidr: string): boolean {
  const m = cidr.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (!m) return false;
  const bits = parseInt(m[2]!, 10);
  if (bits < 0 || bits > 32) return false;
  return ipToInt(m[1]!) !== null;
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4) return null;
  for (const p of parts) {
    if (!Number.isInteger(p) || p < 0 || p > 255) return null;
  }
  return (
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
  );
}

export function inCidr(ip: string, cidr: string): boolean {
  const m = cidr.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (!m) return false;
  const network = ipToInt(m[1]!);
  const target = ipToInt(ip);
  if (network == null || target == null) return false;
  const bits = parseInt(m[2]!, 10);
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (network & mask) === (target & mask);
}

export function inAnyCidr(ip: string, cidrs: string[]): boolean {
  if (cidrs.length === 0) return true; // no allowlist = unrestricted
  return cidrs.some((c) => inCidr(ip, c));
}

/// Best-effort client IP extraction from the request headers.
/// Honors X-Forwarded-For (first hop), then X-Real-IP, then null.
export function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}
