import { prisma } from '@roster/db';
import { ctxOr401, err, json, ok } from '@/lib/api';

// POST /api/announcements/:id/read — record an authenticated read receipt.
// Idempotent: subsequent calls don't change the original readAt.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const announcement = await prisma.announcement.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!announcement) {
    return json(err('not_found', 'Announcement not found.'), { status: 404 });
  }

  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: params.id, userId: ctx.userId } },
    update: {},
    create: { announcementId: params.id, userId: ctx.userId },
  });

  return json(ok({ id: params.id }));
}
