import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { verifyTotp } from '@/lib/totp';

const Body = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const record = await prisma.twoFactorSecret.findUnique({
    where: { userId: ctx.userId },
    select: { id: true, secret: true, verifiedAt: true },
  });
  if (!record) return json(err('not_found', 'Run setup first.'), { status: 404 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid code'), { status: 400 });

  if (!verifyTotp(record.secret, parsed.data.code)) {
    return json(err('invalid_code', 'Code didn’t match.'), { status: 400 });
  }

  if (!record.verifiedAt) {
    await prisma.twoFactorSecret.update({
      where: { id: record.id },
      data: { verifiedAt: new Date() },
    });
    await audit({
      orgId: ctx.orgId,
      userId: ctx.userId,
      action: '2fa.enabled',
      entity: 'TwoFactorSecret',
    });
  }

  return json(ok({ verified: true }));
}
