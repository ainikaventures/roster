import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@roster/db';

// ---------------------------------------------------------------------------
// API key minting + verification.
//
// Format:   rstr_<env>_<prefix>_<secret>
//   - rstr_  fixed brand prefix so keys are recognizable in logs
//   - env    "live" / "test" (the slug between underscores)
//   - prefix 6 chars stored in plaintext for lookups (the part displayed in UI)
//   - secret 28 chars, only hashed in storage
//
// We bcrypt the *whole* key string at rest. To verify, the caller passes
// the full token; we look up by `prefix` and bcrypt-compare.
// ---------------------------------------------------------------------------

export const KEY_PREFIX = 'rstr';

export type MintedKey = {
  fullKey: string;
  prefix: string;
  hashedKey: string;
};

export function mintApiKey(env: 'live' | 'test' = 'live'): MintedKey {
  const prefixPart = randomBytes(4).toString('hex'); // 8 hex chars
  const secret = randomBytes(20).toString('base64url'); // ~27 chars
  const fullKey = `${KEY_PREFIX}_${env}_${prefixPart}_${secret}`;
  // bcryptjs is sync-friendly; tiny key length so cost 10 is fine.
  const hashedKey = bcrypt.hashSync(fullKey, 10);
  // Stored prefix uniquely identifies the key for the lookup in verifyApiKey.
  return { fullKey, prefix: `${KEY_PREFIX}_${env}_${prefixPart}`, hashedKey };
}

export type VerifiedKey = {
  apiKeyId: string;
  orgId: string;
  scopes: string[];
};

/**
 * Verifies an incoming Bearer token against the ApiKey table.
 * Bumps `lastUsedAt` on success. Returns null on any failure.
 */
export async function verifyApiKey(rawKey: string): Promise<VerifiedKey | null> {
  if (typeof rawKey !== 'string') return null;
  // Quick shape check.
  const m = rawKey.match(/^(rstr_[a-z]+_[a-f0-9]+)_/i);
  if (!m) return null;
  const prefix = m[1]!;

  const record = await prisma.apiKey.findUnique({
    where: { prefix },
    select: {
      id: true,
      orgId: true,
      hashedKey: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
    },
  });
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;

  const ok = await bcrypt.compare(rawKey, record.hashedKey);
  if (!ok) return null;

  await prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    apiKeyId: record.id,
    orgId: record.orgId,
    scopes: Array.isArray(record.scopes) ? (record.scopes as string[]) : [],
  };
}
