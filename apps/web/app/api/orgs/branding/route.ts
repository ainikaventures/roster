import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

const Body = z.object({
  brandColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function PATCH(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.brandColor !== undefined) data.brandColor = parsed.data.brandColor;
  if (parsed.data.logoUrl !== undefined) data.logoUrl = parsed.data.logoUrl;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;

  const org = await prisma.organization.update({
    where: { id: ctx.orgId },
    data,
    select: { id: true, name: true, brandColor: true, logoUrl: true },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'org.branding_updated',
    entity: 'Organization',
    entityId: org.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(org));
}
