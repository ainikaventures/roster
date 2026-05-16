import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }
  const config = await prisma.samlConfig.findUnique({
    where: { orgId: ctx.orgId },
  });
  return json(ok({ config }));
}

// PUT /api/sso/saml — upsert config. SAML handshake plugs in via
// @node-saml/passport-saml once the env vars + this config are present.
const Body = z.object({
  idpEntityId: z.string().min(1).max(500),
  idpSsoUrl: z.string().url(),
  idpX509Cert: z.string().min(1).max(20_000),
  enforce: z.boolean().default(false),
  defaultRole: z.enum(['OWNER', 'ADMIN', 'BRANCH_MANAGER', 'TEAM_MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
});

export async function PUT(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const config = await prisma.samlConfig.upsert({
    where: { orgId: ctx.orgId },
    update: {
      idpEntityId: parsed.data.idpEntityId,
      idpSsoUrl: parsed.data.idpSsoUrl,
      idpX509Cert: parsed.data.idpX509Cert,
      enforce: parsed.data.enforce,
      defaultRole: parsed.data.defaultRole,
    },
    create: {
      orgId: ctx.orgId,
      idpEntityId: parsed.data.idpEntityId,
      idpSsoUrl: parsed.data.idpSsoUrl,
      idpX509Cert: parsed.data.idpX509Cert,
      enforce: parsed.data.enforce,
      defaultRole: parsed.data.defaultRole,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'sso.config_updated',
    entity: 'SamlConfig',
    entityId: config.id,
    metadata: { enforce: parsed.data.enforce },
  });

  return json(ok(config));
}

export async function DELETE() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }
  await prisma.samlConfig.deleteMany({ where: { orgId: ctx.orgId } });
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'sso.config_removed',
    entity: 'SamlConfig',
  });
  return json(ok({ removed: true }));
}
