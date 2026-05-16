import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { mintApiKey } from '@/lib/api-keys';

function requireAdmin(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!requireAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      prefix: true,
      name: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return json(ok(keys));
}

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string().min(1).max(40)).max(40).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  env: z.enum(['live', 'test']).optional(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!requireAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const minted = mintApiKey(parsed.data.env ?? 'live');
  const record = await prisma.apiKey.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      name: parsed.data.name,
      prefix: minted.prefix,
      hashedKey: minted.hashedKey,
      scopes: (parsed.data.scopes ?? []) as never,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'api_key.created',
    entity: 'ApiKey',
    entityId: record.id,
    metadata: { prefix: minted.prefix },
  });

  // CRUCIAL: full key is only returned this one time — UI must surface it.
  return json(
    ok({
      id: record.id,
      prefix: record.prefix,
      name: record.name,
      scopes: parsed.data.scopes ?? [],
      fullKey: minted.fullKey,
    }),
    { status: 201 },
  );
}
