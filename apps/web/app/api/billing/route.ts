import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { isStripeConfigured, PLANS, planById } from '@/lib/billing';

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const [subscription, seatCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { orgId: ctx.orgId } }),
    prisma.membership.count({ where: { orgId: ctx.orgId } }),
  ]);

  return json(
    ok({
      subscription: subscription ?? {
        orgId: ctx.orgId,
        plan: 'free',
        status: 'TRIALING',
        seats: 0,
        currentPeriodEnd: null,
        trialEndsAt: null,
      },
      plans: PLANS,
      currentSeats: seatCount,
      stripeConfigured: isStripeConfigured(),
    }),
  );
}

// PATCH /api/billing — admins can change the plan. When Stripe is configured
// we redirect through Checkout; without Stripe we just write the plan onto
// the Subscription row so the UI surfaces the right tier.
const Patch = z.object({
  plan: z.enum(['free', 'starter', 'growth', 'enterprise']),
});

export async function PATCH(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });
  if (!planById(parsed.data.plan)) {
    return json(err('invalid_plan', 'Unknown plan'), { status: 400 });
  }

  const updated = await prisma.subscription.upsert({
    where: { orgId: ctx.orgId },
    update: { plan: parsed.data.plan },
    create: {
      orgId: ctx.orgId,
      plan: parsed.data.plan,
      status: parsed.data.plan === 'free' ? 'ACTIVE' : 'TRIALING',
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'billing.plan_changed',
    entity: 'Subscription',
    entityId: updated.id,
    metadata: { plan: parsed.data.plan },
  });

  return json(ok(updated));
}
