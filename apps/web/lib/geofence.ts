// ---------------------------------------------------------------------------
// Haversine distance for geofenced clock-in.
// Returns meters between two (lat, lng) pairs.
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);

  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return Math.round(EARTH_RADIUS_M * c);
}

export function withinFence(
  center: { lat: number; lng: number },
  radiusMeters: number,
  point: { lat: number; lng: number },
): { inside: boolean; distance: number } {
  const d = distanceMeters(center, point);
  return { inside: d <= radiusMeters, distance: d };
}
