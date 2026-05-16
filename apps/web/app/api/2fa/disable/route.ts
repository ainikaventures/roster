import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

// DELETE /api/2fa — remove the user's 2FA secret. We also block this if the
// org enforces 2FA — admins can't accidentally lock themselves out under
// enforcement; they have to relax the org policy first.
export async function DELETE() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { require2fa: true },
  });
  if (org?.require2fa) {
    return json(
      err('policy_blocked', 'Your org requires 2FA. Disable enforcement first.'),
      { status: 403 },
    );
  }

  await prisma.twoFactorSecret.deleteMany({ where: { userId: ctx.userId } });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: '2fa.disabled',
    entity: 'TwoFactorSecret',
  });

  return json(ok({ disabled: true }));
}
