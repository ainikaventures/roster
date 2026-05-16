import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { slugify } from '@/lib/slug';

// GET /api/kb/pages?folderId=&q=
// folderId=null → root-level pages; q= → full-text search (Postgres ILIKE).
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const folderId = url.searchParams.get('folderId');
  const q = url.searchParams.get('q')?.trim();

  const where: Record<string, unknown> = {
    orgId: ctx.orgId,
    archivedAt: null,
  };
  if (folderId === 'null') where.folderId = null;
  else if (folderId) where.folderId = folderId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
    ];
  }

  const pages = await prisma.kbPage.findMany({
    where,
    orderBy: q ? { updatedAt: 'desc' } : { title: 'asc' },
    take: q ? 50 : 200,
    select: {
      id: true,
      title: true,
      slug: true,
      folderId: true,
      version: true,
      updatedAt: true,
      ...(q ? { body: true } : {}),
      author: { select: { id: true, name: true, email: true } },
      folder: { select: { id: true, name: true, slug: true } },
    },
  });

  // For search results, surface a short excerpt around the query.
  if (q) {
    return json(
      ok(
        pages.map((p) => ({
          ...p,
          body: undefined,
          excerpt: excerpt((p as { body: string }).body, q),
        })),
      ),
    );
  }

  return json(ok(pages));
}

// POST /api/kb/pages — managers create
const Body = z.object({
  folderId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(140),
  body: z.string().max(200_000).default(''),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  if (parsed.data.folderId) {
    const folder = await prisma.kbFolder.findFirst({
      where: { id: parsed.data.folderId, orgId: ctx.orgId, archivedAt: null },
      select: { id: true },
    });
    if (!folder) return json(err('not_found', 'Folder not found.'), { status: 404 });
  }

  const baseSlug = slugify(parsed.data.title) || 'page';
  let slug = baseSlug;
  let suffix = 2;
  while (
    (await prisma.kbPage.findFirst({
      where: {
        orgId: ctx.orgId,
        folderId: parsed.data.folderId ?? null,
        slug,
      },
      select: { id: true },
    }))
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const page = await prisma.kbPage.create({
    data: {
      orgId: ctx.orgId,
      folderId: parsed.data.folderId ?? null,
      title: parsed.data.title,
      slug,
      body: parsed.data.body,
      authorId: ctx.userId,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'kb.page_created',
    entity: 'KbPage',
    entityId: page.id,
  });

  return json(ok(page), { status: 201 });
}

function excerpt(body: string, q: string): string {
  const idx = body.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return body.slice(0, 200);
  const start = Math.max(0, idx - 80);
  const end = Math.min(body.length, idx + q.length + 120);
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
}
