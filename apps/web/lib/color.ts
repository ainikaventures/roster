// ---------------------------------------------------------------------------
// Convert a `#RRGGBB` hex value into the `H S% L%` triplet used by
// Tailwind / shadcn-style CSS custom properties (e.g. `hsl(var(--primary))`).
// ---------------------------------------------------------------------------

export function hexToHsl(hex: string): string | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;

  const int = parseInt(m[1]!, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = h * 60;
    if (h < 0) h += 360;
  }

  return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}
