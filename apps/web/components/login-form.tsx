'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { Button, Input, Label } from '@roster/ui';

export function LoginForm({
  googleEnabled,
  emailEnabled,
}: {
  googleEnabled: boolean;
  emailEnabled: boolean;
}) {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  if (!googleEnabled && !emailEnabled) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        No auth providers are configured yet. Add <code>GOOGLE_CLIENT_ID</code> /{' '}
        <code>EMAIL_SERVER</code> to your <code>.env</code> and restart the dev
        server.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {googleEnabled && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => signIn('google', { callbackUrl: '/app' })}
        >
          Continue with Google
        </Button>
      )}

      {googleEnabled && emailEnabled && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
      )}

      {emailEnabled && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            await signIn('email', { email, callbackUrl: '/app', redirect: false });
            setSubmitting(false);
            setSent(true);
          }}
        >
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={submitting || !email} className="w-full">
            {submitting ? 'Sending link…' : 'Email me a sign-in link'}
          </Button>
          {sent && (
            <p className="text-sm text-muted-foreground">
              Check your inbox for a sign-in link.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
