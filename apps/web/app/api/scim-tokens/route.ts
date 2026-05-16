import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { mintScimToken } from '@/lib/scim';

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }
  const tokens = await prisma.scimToken.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      prefix: true,
      name: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return json(ok(tokens));
}

const Body = z.object({ name: z.string().trim().min(1).max(80) });

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const minted = mintScimToken();
  const token = await prisma.scimToken.create({
    data: {
      orgId: ctx.orgId,
      name: parsed.data.name,
      prefix: minted.prefix,
      hashedToken: minted.hashedToken,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'scim_token.created',
    entity: 'ScimToken',
    entityId: token.id,
  });

  return json(
    ok({ id: token.id, name: token.name, prefix: token.prefix, fullToken: minted.fullToken }),
    { status: 201 },
  );
}
