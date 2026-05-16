'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button, Card, CardContent, Input, Label } from '@roster/ui';

export function PayrollExport({
  teams,
}: {
  teams: { id: string; name: string; color: string | null }[];
}) {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [teamId, setTeamId] = React.useState('');
  const [approvedOnly, setApprovedOnly] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);

  async function download() {
    if (!from || !to) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        from: new Date(from).toISOString(),
        to: new Date(`${to}T23:59:59`).toISOString(),
      });
      if (teamId) params.set('teamId', teamId);
      if (approvedOnly) params.set('approvedOnly', 'true');

      const res = await fetch(`/api/payroll/export?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roster-payroll-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        {teams.length > 1 && (
          <div>
            <Label htmlFor="team">Team</Label>
            <select
              id="team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All teams in scope</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={(e) => setApprovedOnly(e.target.checked)}
          />
          Approved entries only
        </label>

        <Button onClick={download} disabled={downloading || !from || !to}>
          <Download className="mr-1.5 h-4 w-4" />
          {downloading ? 'Generating…' : 'Download CSV'}
        </Button>
      </CardContent>
    </Card>
  );
}
