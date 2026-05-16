'use client';

import * as React from 'react';
import { Button } from '@roster/ui';

// ---------------------------------------------------------------------------
// Lightweight signature pad: draws into a canvas with pointer events and
// exports a PNG data URL. Avoids a dependency for Phase 3.
// ---------------------------------------------------------------------------

export function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (data: string | null) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to its CSS size at 2x for crispness.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0a0a0a';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div className="mt-1.5 space-y-2">
      <canvas
        ref={canvasRef}
        className="h-32 w-full touch-none rounded-md border bg-white"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = pos(e);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext('2d');
          if (!ctx || !last.current) return;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          const canvas = canvasRef.current;
          if (canvas) onChange(canvas.toDataURL('image/png'));
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
        aria-label="Signature canvas"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{value ? 'Signature captured.' : 'Sign above with mouse or finger.'}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            onChange(null);
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
