import { createHmac, randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — minimal, dependency-free implementation so we don't have
// to ship an extra library just for 2FA. Uses HMAC-SHA1, 6 digits, 30s step.
// Authenticator apps (Google Authenticator, 1Password, Authy) all accept it.
//
// Secrets are base32-encoded shared keys; we generate 20-byte (160-bit)
// secrets per RFC 4226 §4 best practice.
// ---------------------------------------------------------------------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += B32[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = '';
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totp(secret: string, when: number = Date.now(), step = 30): string {
  const counter = Math.floor(when / 1000 / step);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/// Accept the current step + the one before/after to tolerate clock drift.
export function verifyTotp(secret: string, code: string, when: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (const offset of [-30_000, 0, 30_000]) {
    if (totp(secret, when + offset) === code) return true;
  }
  return false;
}

/// otpauth:// URL the authenticator app scans as a QR code.
export function otpauthUrl(opts: { issuer: string; account: string; secret: string }): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/// 10 backup codes, 8 chars each. Returned plaintext once and stored hashed.
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(randomBytes(4).toString('hex'));
  }
  return codes;
}
