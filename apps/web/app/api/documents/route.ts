import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { putObject } from '@/lib/storage';

// ---------------------------------------------------------------------------
// GET /api/documents?ownerId=&kind=
// - Employees: see org-level (ownerId null) docs + their own.
// - Managers: also see docs owned by people in their scope.
// ---------------------------------------------------------------------------

const Query = z.object({
  ownerId: z.string().min(1).optional(),
  kind: z.enum(['POLICY', 'CONTRACT', 'CERTIFICATION', 'ID', 'HANDBOOK', 'OTHER']).optional(),
  mine: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    ownerId: url.searchParams.get('ownerId') ?? undefined,
    kind: url.searchParams.get('kind') ?? undefined,
    mine: url.searchParams.get('mine') ?? undefined,
  });
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  let ownerFilter: Record<string, unknown>;
  if (parsed.data.mine) {
    ownerFilter = { OR: [{ ownerId: ctx.userId }, { ownerId: null }] };
  } else if (parsed.data.ownerId) {
    if (parsed.data.ownerId !== ctx.userId && !isManager(ctx.scope.role)) {
      return json(err('forbidden', 'You can only see your own docs.'), { status: 403 });
    }
    ownerFilter = { ownerId: parsed.data.ownerId };
  } else if (!isManager(ctx.scope.role)) {
    ownerFilter = { OR: [{ ownerId: ctx.userId }, { ownerId: null }] };
  } else {
    // Managers — restrict to owners they can see (scope-resolved memberships).
    if (ctx.scope.teamIds === null) {
      ownerFilter = {}; // org-wide
    } else if (ctx.scope.teamIds.length === 0) {
      ownerFilter = { ownerId: null };
    } else {
      const members = await prisma.membership.findMany({
        where: { orgId: ctx.orgId, teamId: { in: ctx.scope.teamIds } },
        select: { userId: true },
      });
      const ids = members.map((m) => m.userId);
      ownerFilter = { OR: [{ ownerId: null }, { ownerId: { in: ids } }] };
    }
  }

  const documents = await prisma.document.findMany({
    where: {
      orgId: ctx.orgId,
      archivedAt: null,
      ...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
      ...ownerFilter,
    },
    orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      fileUrl: true,
      mimeType: true,
      fileSize: true,
      expiresAt: true,
      requireSignature: true,
      ownerId: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      signatures: {
        where: { userId: ctx.userId },
        select: { id: true, signedAt: true },
      },
      _count: { select: { signatures: true } },
    },
  });

  return json(ok(documents));
}

// ---------------------------------------------------------------------------
// POST /api/documents — multipart upload. Managers only for org / others'
// docs; employees can upload their own personal docs.
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const form = await req.formData();
  const file = form.get('file');
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim() || null;
  const kindRaw = String(form.get('kind') ?? 'OTHER');
  const ownerIdRaw = (form.get('ownerId') as string | null)?.trim();
  const expiresAtRaw = form.get('expiresAt') as string | null;
  const requireSignature = String(form.get('requireSignature') ?? 'false') === 'true';

  if (!title) return json(err('invalid_input', 'Title required'), { status: 400 });
  if (!(file instanceof File)) {
    return json(err('invalid_input', 'File required'), { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return json(err('too_large', 'File must be under 20 MB'), { status: 413 });
  }
  const kind = (
    ['POLICY', 'CONTRACT', 'CERTIFICATION', 'ID', 'HANDBOOK', 'OTHER'] as const
  ).includes(kindRaw as never)
    ? (kindRaw as 'POLICY' | 'CONTRACT' | 'CERTIFICATION' | 'ID' | 'HANDBOOK' | 'OTHER')
    : 'OTHER';

  const ownerId = ownerIdRaw && ownerIdRaw !== 'null' ? ownerIdRaw : null;

  // Permission rules:
  // - org-level (ownerId null) → managers only
  // - other people's docs       → managers, with scope check
  // - own docs                  → anyone
  if (!ownerId && !isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Only managers can upload org docs.'), { status: 403 });
  }
  if (ownerId && ownerId !== ctx.userId) {
    if (!isManager(ctx.scope.role)) {
      return json(err('forbidden', 'Not allowed.'), { status: 403 });
    }
    const m = await prisma.membership.findFirst({
      where: { userId: ownerId, orgId: ctx.orgId },
      select: { teamId: true },
    });
    if (!m) return json(err('not_found', 'User not in org.'), { status: 404 });
    if (ctx.scope.teamIds !== null && m.teamId && !ctx.scope.teamIds.includes(m.teamId)) {
      return json(err('forbidden', 'Out of scope.'), { status: 403 });
    }
  }

  const body = Buffer.from(await file.arrayBuffer());
  const put = await putObject({
    orgId: ctx.orgId,
    kind: 'documents',
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    body,
  });

  const document = await prisma.document.create({
    data: {
      orgId: ctx.orgId,
      ownerId,
      createdById: ctx.userId,
      title,
      description,
      kind,
      fileUrl: put.url,
      fileSize: put.bytes,
      mimeType: file.type || 'application/octet-stream',
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
      requireSignature: !ownerId ? requireSignature : false,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'document.uploaded',
    entity: 'Document',
    entityId: document.id,
    metadata: { kind: document.kind, ownerId: document.ownerId, bytes: put.bytes },
  });

  return json(ok(document), { status: 201 });
}
