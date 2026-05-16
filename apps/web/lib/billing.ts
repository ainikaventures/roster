// ---------------------------------------------------------------------------
// Billing abstraction.
//
// Phase 7 ships the schema + the high-level functions the rest of the app
// calls. When STRIPE_SECRET_KEY is configured, these stubs will plug into
// the Stripe SDK. Until then, they let the UI render a "current plan" view
// and a trial period without crashing.
// ---------------------------------------------------------------------------

const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

export type Plan = {
  id: 'free' | 'starter' | 'growth' | 'enterprise';
  name: string;
  pricePerSeat: number; // USD/month
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    pricePerSeat: 0,
    features: ['Up to 5 employees', 'Basic scheduling', 'Email support'],
  },
  {
    id: 'starter',
    name: 'Starter',
    pricePerSeat: 4,
    features: ['Unlimited employees', 'Time clock + GPS', 'Chat'],
  },
  {
    id: 'growth',
    name: 'Growth',
    pricePerSeat: 8,
    features: ['Everything in Starter', 'Forms + onboarding', 'KB + training', 'Payroll export'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    pricePerSeat: 14,
    features: ['Everything in Growth', 'API + webhooks', 'SSO (later)', 'Priority support'],
  },
];

export function planById(id: string): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}

export function isStripeConfigured(): boolean {
  return stripeConfigured;
}

// Server-side stub for opening the Stripe customer portal. Real SDK call
// plugs in here once env vars are set.
export async function createBillingPortalUrl(_args: {
  orgId: string;
  returnUrl: string;
}): Promise<string | null> {
  if (!stripeConfigured) return null;
  // TODO: wire @stripe/stripe-node when STRIPE_SECRET_KEY is configured.
  return null;
}
