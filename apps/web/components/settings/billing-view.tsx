'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@roster/ui';

type Plan = {
  id: 'free' | 'starter' | 'growth' | 'enterprise';
  name: string;
  pricePerSeat: number;
  features: string[];
};

type BillingState = {
  subscription: {
    plan: string;
    status: string;
    seats: number;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  };
  plans: Plan[];
  currentSeats: number;
  stripeConfigured: boolean;
};

export function BillingView() {
  const qc = useQueryClient();
  const state = useQuery({
    queryKey: ['billing'],
    queryFn: async (): Promise<BillingState> => {
      const res = await fetch('/api/billing');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const setPlan = useMutation({
    mutationFn: async (plan: Plan['id']) => {
      const res = await fetch('/api/billing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });

  if (!state.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const { subscription, plans, currentSeats, stripeConfigured } = state.data;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            {plans.find((p) => p.id === subscription.plan)?.name ?? subscription.plan} ·{' '}
            {subscription.status.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-baseline gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Seats in use</div>
            <div className="text-xl font-semibold tabular-nums">{currentSeats}</div>
          </div>
          {!stripeConfigured && (
            <Badge variant="outline" className="text-xs">
              Stripe not configured (dev mode)
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const current = plan.id === subscription.plan;
          return (
            <Card
              key={plan.id}
              className={cn(current && 'ring-2 ring-primary')}
            >
              <CardHeader>
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <CardDescription>
                  ${plan.pricePerSeat}/seat/mo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-xs">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={current ? 'outline' : 'default'}
                  size="sm"
                  className="w-full"
                  disabled={current || setPlan.isPending}
                  onClick={() => setPlan.mutate(plan.id)}
                >
                  {current ? 'Current plan' : `Switch to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
