import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@roster/db';

// ---------------------------------------------------------------------------
// SCIM token verification.
// Mirrors api-keys.ts but for /scim/v2 endpoints.
// ---------------------------------------------------------------------------

export function mintScimToken(): { fullToken: string; prefix: string; hashedToken: string } {
  const prefix = `scim_${randomBytes(4).toString('hex')}`;
  const secret = randomBytes(24).toString('base64url');
  const fullToken = `${prefix}_${secret}`;
  const hashedToken = bcrypt.hashSync(fullToken, 10);
  return { fullToken, prefix, hashedToken };
}

export async function verifyScimToken(rawToken: string): Promise<{ orgId: string } | null> {
  const m = rawToken.match(/^(scim_[a-f0-9]+)_/i);
  if (!m) return null;
  const record = await prisma.scimToken.findUnique({
    where: { prefix: m[1]! },
    select: { id: true, hashedToken: true, orgId: true, revokedAt: true },
  });
  if (!record || record.revokedAt) return null;
  const ok = await bcrypt.compare(rawToken, record.hashedToken);
  if (!ok) return null;
  await prisma.scimToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return { orgId: record.orgId };
}
