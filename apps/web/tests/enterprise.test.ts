import { describe, expect, it } from 'vitest';
import { generateSecret, totp, verifyTotp, otpauthUrl } from '@/lib/totp';
import { isValidIPv4Cidr, inCidr, inAnyCidr } from '@/lib/cidr';
import { autoAssign } from '@/lib/auto-scheduler';

describe('TOTP', () => {
  it('generates a 32-char base32 secret', () => {
    const s = generateSecret();
    expect(s).toHaveLength(32);
    expect(s).toMatch(/^[A-Z2-7]+$/);
  });

  it('round-trips: a code produced by totp() verifies via verifyTotp()', () => {
    const secret = generateSecret();
    const now = Date.now();
    const code = totp(secret, now);
    expect(verifyTotp(secret, code, now)).toBe(true);
  });

  it('tolerates ±30s drift but rejects ±90s', () => {
    const secret = generateSecret();
    const now = Date.now();
    const code = totp(secret, now);
    expect(verifyTotp(secret, code, now + 30_000)).toBe(true);
    expect(verifyTotp(secret, code, now - 30_000)).toBe(true);
    expect(verifyTotp(secret, code, now + 90_000)).toBe(false);
  });

  it('builds an otpauth url with the issuer label', () => {
    const url = otpauthUrl({
      issuer: 'Roster',
      account: 'jane@acme.test',
      secret: 'JBSWY3DPEHPK3PXP',
    });
    expect(url).toContain('otpauth://totp/Roster');
    expect(url).toContain('issuer=Roster');
  });
});

describe('CIDR', () => {
  it('rejects malformed input', () => {
    expect(isValidIPv4Cidr('not a cidr')).toBe(false);
    expect(isValidIPv4Cidr('10.0.0.0/33')).toBe(false);
    expect(isValidIPv4Cidr('10.0.0.256/24')).toBe(false);
  });

  it('admits IPs inside a /24', () => {
    expect(inCidr('10.0.0.5', '10.0.0.0/24')).toBe(true);
    expect(inCidr('10.0.1.5', '10.0.0.0/24')).toBe(false);
  });

  it('inAnyCidr with empty list = unrestricted', () => {
    expect(inAnyCidr('1.2.3.4', [])).toBe(true);
  });
});

describe('autoAssign', () => {
  it('assigns a shift to an available employee', () => {
    const result = autoAssign(
      [
        {
          id: 's1',
          startsAt: new Date('2026-05-18T09:00:00'),
          endsAt: new Date('2026-05-18T17:00:00'),
        },
      ],
      [
        {
          userId: 'u1',
          windows: [{ startMinutes: 8 * 60, endMinutes: 18 * 60, kind: 'AVAILABLE' }],
          existing: [],
        },
      ],
    );
    expect(result).toEqual([{ shiftId: 's1', userId: 'u1' }]);
  });

  it('prefers PREFERRED over plain AVAILABLE', () => {
    const result = autoAssign(
      [
        {
          id: 's1',
          startsAt: new Date('2026-05-18T09:00:00'),
          endsAt: new Date('2026-05-18T17:00:00'),
        },
      ],
      [
        {
          userId: 'available',
          windows: [{ startMinutes: 8 * 60, endMinutes: 18 * 60, kind: 'AVAILABLE' }],
          existing: [],
        },
        {
          userId: 'preferred',
          windows: [{ startMinutes: 8 * 60, endMinutes: 18 * 60, kind: 'PREFERRED' }],
          existing: [],
        },
      ],
    );
    expect(result[0]?.userId).toBe('preferred');
  });

  it('skips candidates with overlapping shifts', () => {
    const result = autoAssign(
      [
        {
          id: 's1',
          startsAt: new Date('2026-05-18T09:00:00'),
          endsAt: new Date('2026-05-18T17:00:00'),
        },
      ],
      [
        {
          userId: 'u1',
          windows: [{ startMinutes: 0, endMinutes: 24 * 60, kind: 'AVAILABLE' }],
          existing: [
            {
              startsAt: new Date('2026-05-18T12:00:00'),
              endsAt: new Date('2026-05-18T20:00:00'),
            },
          ],
        },
      ],
    );
    expect(result).toEqual([]);
  });
});
