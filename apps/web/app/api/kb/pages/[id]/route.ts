import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const page = await prisma.kbPage.findFirst({
    where: { id: params.id, orgId: ctx.orgId, archivedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      body: true,
      version: true,
      folderId: true,
      updatedAt: true,
      author: { select: { id: true, name: true, email: true } },
      folder: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!page) return json(err('not_found', 'Page not found.'), { status: 404 });
  return json(ok(page));
}

const Patch = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  body: z.string().max(200_000).optional(),
  folderId: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const page = await prisma.kbPage.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, version: true },
  });
  if (!page) return json(err('not_found', 'Page not found.'), { status: 404 });

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const data: Record<string, unknown> = { version: page.version + 1 };
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.body !== undefined) data.body = parsed.data.body;
  if (parsed.data.folderId !== undefined) data.folderId = parsed.data.folderId;

  const updated = await prisma.kbPage.update({ where: { id: page.id }, data });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'kb.page_updated',
    entity: 'KbPage',
    entityId: page.id,
    metadata: { fields: Object.keys(data).filter((k) => k !== 'version') },
  });

  return json(ok(updated));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const page = await prisma.kbPage.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!page) return json(err('not_found', 'Page not found.'), { status: 404 });

  await prisma.kbPage.update({
    where: { id: page.id },
    data: { archivedAt: new Date() },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'kb.page_archived',
    entity: 'KbPage',
    entityId: page.id,
  });

  return json(ok({ id: page.id }));
}
