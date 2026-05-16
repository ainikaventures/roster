import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

const Body = z.object({
  signatureData: z.string().min(1).max(500_000),
});

// POST /api/documents/:id/sign — capture a user's signature on a policy doc.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const doc = await prisma.document.findFirst({
    where: { id: params.id, orgId: ctx.orgId, archivedAt: null, requireSignature: true },
    select: { id: true, title: true, ownerId: true },
  });
  if (!doc) return json(err('not_found', 'Document not found or signature not required.'), {
    status: 404,
  });

  // Org-level documents are signable by every org member. Owner-scoped docs
  // can only be signed by the owner themselves.
  if (doc.ownerId && doc.ownerId !== ctx.userId) {
    return json(err('forbidden', 'You can’t sign someone else’s document.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Signature required'), { status: 400 });
  }

  const signature = await prisma.documentSignature.upsert({
    where: { documentId_userId: { documentId: doc.id, userId: ctx.userId } },
    update: { signatureData: parsed.data.signatureData, signedAt: new Date() },
    create: {
      documentId: doc.id,
      userId: ctx.userId,
      signatureData: parsed.data.signatureData,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'document.signed',
    entity: 'Document',
    entityId: doc.id,
    metadata: { title: doc.title },
  });

  return json(ok(signature));
}
