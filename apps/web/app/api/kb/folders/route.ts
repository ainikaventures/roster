import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { slugify } from '@/lib/slug';

// GET /api/kb/folders — flat list of every folder (the client builds the tree).
export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const folders = await prisma.kbFolder.findMany({
    where: { orgId: ctx.orgId, archivedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      parentId: true,
      name: true,
      slug: true,
      _count: { select: { pages: true, children: true } },
    },
  });

  return json(ok(folders));
}

// POST /api/kb/folders — managers create
const Body = z.object({
  parentId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  if (parsed.data.parentId) {
    const parent = await prisma.kbFolder.findFirst({
      where: { id: parsed.data.parentId, orgId: ctx.orgId, archivedAt: null },
      select: { id: true },
    });
    if (!parent) return json(err('not_found', 'Parent folder missing.'), { status: 404 });
  }

  const baseSlug = slugify(parsed.data.name) || 'folder';
  let slug = baseSlug;
  let suffix = 2;
  // Ensure uniqueness within parent.
  while (
    (await prisma.kbFolder.findFirst({
      where: {
        orgId: ctx.orgId,
        parentId: parsed.data.parentId ?? null,
        slug,
      },
      select: { id: true },
    }))
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const folder = await prisma.kbFolder.create({
    data: {
      orgId: ctx.orgId,
      parentId: parsed.data.parentId ?? null,
      name: parsed.data.name,
      slug,
      createdById: ctx.userId,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'kb.folder_created',
    entity: 'KbFolder',
    entityId: folder.id,
  });

  return json(ok(folder), { status: 201 });
}
