import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { isValidIPv4Cidr } from '@/lib/cidr';

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }
  const items = await prisma.ipAllowlistEntry.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
  });
  return json(ok(items));
}

const Body = z.object({
  cidr: z.string().min(1),
  description: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });
  if (!isValidIPv4Cidr(parsed.data.cidr)) {
    return json(err('invalid_cidr', 'Use IPv4 CIDR like 10.0.0.0/8'), { status: 400 });
  }

  const entry = await prisma.ipAllowlistEntry.create({
    data: {
      orgId: ctx.orgId,
      cidr: parsed.data.cidr,
      description: parsed.data.description ?? null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'ip_allowlist.added',
    entity: 'IpAllowlistEntry',
    entityId: entry.id,
    metadata: { cidr: entry.cidr },
  });

  return json(ok(entry), { status: 201 });
}
