'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, CardContent, Input, Label } from '@roster/ui';

type SetupResponse = {
  otpauthUrl: string;
  secret: string;
  backupCodes: string[];
};

export function TwoFactorSetup() {
  const [stage, setStage] = React.useState<'idle' | 'pending' | 'verified'>('idle');
  const [setup, setSetup] = React.useState<SetupResponse | null>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/2fa/setup', { method: 'POST' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data as SetupResponse;
    },
    onSuccess: (data) => {
      setSetup(data);
      setStage('pending');
      setError(null);
    },
  });

  const verify = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => setStage('verified'),
    onError: (e: Error) => setError(e.message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/2fa/disable', { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => {
      setStage('idle');
      setSetup(null);
      setCode('');
    },
  });

  if (stage === 'verified') {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            2FA is on for your account.
          </p>
          <p className="text-xs text-muted-foreground">
            You&apos;ll need a one-time code from your authenticator app the next
            time you sign in.
          </p>
          <Button variant="outline" size="sm" onClick={() => disable.mutate()}>
            Turn off 2FA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === 'pending' && setup) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm">
            Scan this URL with your authenticator app or paste the secret
            manually:
          </p>
          <pre className="break-all rounded-md border bg-muted p-3 text-xs">
            {setup.otpauthUrl}
          </pre>
          <div>
            <Label htmlFor="manual">Secret</Label>
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
              {setup.secret}
            </code>
          </div>

          <details className="rounded-md border bg-muted/50 p-3 text-xs">
            <summary className="cursor-pointer font-medium">
              Backup codes (save these now)
            </summary>
            <ul className="mt-2 grid grid-cols-2 gap-1 font-mono">
              {setup.backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>

          <div>
            <Label htmlFor="code">Verify with a code from the app</Label>
            <Input
              id="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="mt-1.5 max-w-[10rem] font-mono"
              placeholder="123456"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => verify.mutate()}
              disabled={code.length !== 6 || verify.isPending}
            >
              {verify.isPending ? 'Verifying…' : 'Verify and enable'}
            </Button>
            <Button variant="ghost" onClick={() => setStage('idle')}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm">
          Add a one-time code requirement on top of your password / SSO login.
        </p>
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? 'Generating…' : 'Set up 2FA'}
        </Button>
      </CardContent>
    </Card>
  );
}
