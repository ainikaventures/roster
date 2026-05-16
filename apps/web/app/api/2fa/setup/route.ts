import bcrypt from 'bcryptjs';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import {
  generateBackupCodes,
  generateSecret,
  otpauthUrl,
} from '@/lib/totp';

// POST /api/2fa/setup — start enrollment. Stores an unverified secret and
// returns the otpauth URL + backup codes. Caller must verify a code via
// /api/2fa/verify before the secret is considered active.
export async function POST() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const secret = generateSecret();
  const backupCodes = generateBackupCodes();
  const hashed = backupCodes.map((c) => bcrypt.hashSync(c, 8));

  await prisma.twoFactorSecret.upsert({
    where: { userId: ctx.userId },
    update: { secret, backupCodes: hashed as never, verifiedAt: null },
    create: {
      userId: ctx.userId,
      secret,
      backupCodes: hashed as never,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: '2fa.setup_started',
    entity: 'TwoFactorSecret',
  });

  return json(
    ok({
      otpauthUrl: otpauthUrl({
        issuer: 'Roster',
        account: ctx.email,
        secret,
      }),
      secret,
      backupCodes,
    }),
  );
}
