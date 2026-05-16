import { prisma } from '@roster/db';
import { verifyScimToken } from '@/lib/scim';

// ---------------------------------------------------------------------------
// SCIM v2 Users — minimal implementation.
//
// Supports:
//   GET  /scim/v2/Users           list members (paginated)
//   POST /scim/v2/Users           create a user (or no-op if email exists)
//
// The IdP authenticates via `Authorization: Bearer scim_*`. Phase 8 ships
// the schema + endpoints; deactivation via PATCH and GroupSync arrive when
// a customer requests them.
// ---------------------------------------------------------------------------

async function authorize(req: Request): Promise<{ orgId: string } | Response> {
  const header = req.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  const verified = await verifyScimToken(header.slice(7).trim());
  if (!verified) return new Response('Unauthorized', { status: 401 });
  return verified;
}

function scimUser(member: {
  user: { id: string; name: string | null; email: string };
  role: string;
}) {
  const [first, ...rest] = (member.user.name ?? '').split(' ');
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: member.user.id,
    userName: member.user.email,
    name: {
      givenName: first ?? '',
      familyName: rest.join(' '),
    },
    emails: [{ value: member.user.email, primary: true }],
    active: true,
    'urn:roster:role': member.role,
  };
}

export async function GET(req: Request) {
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const startIndex = Math.max(1, parseInt(url.searchParams.get('startIndex') ?? '1', 10));
  const count = Math.min(100, Math.max(1, parseInt(url.searchParams.get('count') ?? '50', 10)));

  const where = { orgId: auth.orgId };
  const [total, items] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({
      where,
      skip: startIndex - 1,
      take: count,
      select: { role: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return Response.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: total,
    startIndex,
    itemsPerPage: items.length,
    Resources: items.map(scimUser),
  });
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;

  const body = (await req.json().catch(() => null)) as
    | {
        userName?: string;
        emails?: { value: string; primary?: boolean }[];
        name?: { givenName?: string; familyName?: string };
      }
    | null;
  const email =
    body?.userName ??
    body?.emails?.find((e) => e.primary)?.value ??
    body?.emails?.[0]?.value;
  if (!email) {
    return Response.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'userName or emails required',
      },
      { status: 400 },
    );
  }

  const fullName = [body?.name?.givenName, body?.name?.familyName].filter(Boolean).join(' ') || null;

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: fullName ?? undefined },
    create: { email, name: fullName },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: auth.orgId } },
    update: {},
    create: { userId: user.id, orgId: auth.orgId, role: 'EMPLOYEE' },
  });

  await prisma.auditLog.create({
    data: {
      orgId: auth.orgId,
      userId: null,
      action: 'scim.user_provisioned',
      entity: 'User',
      entityId: user.id,
      metadata: { email },
    },
  });

  return Response.json(
    scimUser({ user: { id: user.id, name: user.name ?? null, email }, role: 'EMPLOYEE' }),
    { status: 201 },
  );
}
