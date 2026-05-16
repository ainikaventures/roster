import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { withinFence } from '@/lib/geofence';

const Body = z.object({
  teamId: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  selfieData: z.string().max(2_000_000).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/time/clock-in
//
// Phase 6 additions: optional GPS coords + base64 selfie. When the team has
// `geofenceRadius` set, the server enforces the radius — refusing the
// clock-in if the user is outside the fence. When the team requires a
// selfie, a missing capture is also a hard error.
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  const open = await prisma.timeEntry.findFirst({
    where: { userId: ctx.userId, orgId: ctx.orgId, clockedOut: null },
    select: { id: true },
  });
  if (open) {
    return json(err('already_clocked_in', 'You’re already clocked in.'), { status: 409 });
  }

  // Determine team.
  let teamId = parsed.data.teamId;
  if (!teamId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: ctx.userId, orgId: ctx.orgId } },
      select: { teamId: true },
    });
    teamId = membership?.teamId ?? undefined;
  }
  if (!teamId) {
    return json(err('no_team', 'No team to clock into. Pass teamId.'), { status: 400 });
  }
  if (ctx.scope.teamIds !== null && !ctx.scope.teamIds.includes(teamId)) {
    return json(err('forbidden', 'You can’t clock into that team.'), { status: 403 });
  }

  // Fetch the team to enforce geofence / selfie requirements.
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      lat: true,
      lng: true,
      geofenceRadius: true,
      requireSelfieClockIn: true,
    },
  });
  if (!team) return json(err('not_found', 'Team not found.'), { status: 404 });

  let clockedInDistance: number | null = null;
  if (team.lat != null && team.lng != null && team.geofenceRadius) {
    if (parsed.data.lat == null || parsed.data.lng == null) {
      return json(err('location_required', 'This team requires GPS to clock in.'), {
        status: 400,
      });
    }
    const result = withinFence(
      { lat: team.lat, lng: team.lng },
      team.geofenceRadius,
      { lat: parsed.data.lat, lng: parsed.data.lng },
    );
    if (!result.inside) {
      return json(
        err(
          'out_of_geofence',
          `You’re ${result.distance}m from the team site (allowed: ${team.geofenceRadius}m).`,
        ),
        { status: 403 },
      );
    }
    clockedInDistance = result.distance;
  }

  if (team.requireSelfieClockIn && !parsed.data.selfieData) {
    return json(err('selfie_required', 'This team requires a selfie to clock in.'), {
      status: 400,
    });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      orgId: ctx.orgId,
      teamId,
      userId: ctx.userId,
      clockedIn: new Date(),
      clockedInLat: parsed.data.lat ?? null,
      clockedInLng: parsed.data.lng ?? null,
      clockedInDistance,
      clockedInSelfie: parsed.data.selfieData ?? null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'time.clocked_in',
    entity: 'TimeEntry',
    entityId: entry.id,
    metadata: {
      teamId,
      withGps: parsed.data.lat != null && parsed.data.lng != null,
      withSelfie: !!parsed.data.selfieData,
      distance: clockedInDistance,
    },
  });

  return json(ok(entry));
}
