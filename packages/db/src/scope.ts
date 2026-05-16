import type { Role } from '@prisma/client';
import { prisma } from './client';

// ---------------------------------------------------------------------------
// Scope resolution
//
// Given a user + org, returns the set of branches and teams the user can see.
// Every read query in the app should narrow by this scope.
//
// Rules (must mirror the spec):
//   EMPLOYEE        → exactly their one team (Membership.teamId)
//   TEAM_MANAGER    → teams listed in ManagerAssignment
//   BRANCH_MANAGER  → all teams under branches listed in ManagerAssignment
//   ADMIN / OWNER   → all teams in the org (no team filter)
// ---------------------------------------------------------------------------

export type AccessScope = {
  orgId: string;
  role: Role;
  // null = no team-level filter (org-wide access).
  // Empty array = explicitly no access.
  teamIds: string[] | null;
  branchIds: string[] | null;
};

export async function resolveScope(
  userId: string,
  orgId: string,
): Promise<AccessScope | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    select: { role: true, teamId: true },
  });

  if (!membership) return null;

  const { role } = membership;

  // Org-wide roles see everything in their org.
  if (role === 'OWNER' || role === 'ADMIN') {
    return { orgId, role, teamIds: null, branchIds: null };
  }

  // Employees see exactly their team.
  if (role === 'EMPLOYEE') {
    if (!membership.teamId) {
      // Misconfigured employee — no access until a team is assigned.
      return { orgId, role, teamIds: [], branchIds: [] };
    }
    const team = await prisma.team.findUnique({
      where: { id: membership.teamId },
      select: { branchId: true },
    });
    return {
      orgId,
      role,
      teamIds: [membership.teamId],
      branchIds: team ? [team.branchId] : [],
    };
  }

  // Managers — combine explicit branch and team assignments.
  const assignments = await prisma.managerAssignment.findMany({
    where: { userId },
    select: { branchId: true, teamId: true },
  });

  const assignedBranchIds = assignments
    .map((a) => a.branchId)
    .filter((v): v is string => v !== null);
  const assignedTeamIds = assignments
    .map((a) => a.teamId)
    .filter((v): v is string => v !== null);

  // Branch managers also see every team in their branches.
  let branchTeamIds: string[] = [];
  if (role === 'BRANCH_MANAGER' && assignedBranchIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { branchId: { in: assignedBranchIds } },
      select: { id: true },
    });
    branchTeamIds = teams.map((t) => t.id);
  }

  const teamIds = Array.from(new Set([...assignedTeamIds, ...branchTeamIds]));
  const branchIds = Array.from(new Set(assignedBranchIds));

  return { orgId, role, teamIds, branchIds };
}

// Convenience guards used in API handlers.

export function canSeeTeam(scope: AccessScope, teamId: string): boolean {
  if (scope.teamIds === null) return true;
  return scope.teamIds.includes(teamId);
}

export function canSeeBranch(scope: AccessScope, branchId: string): boolean {
  if (scope.branchIds === null) return true;
  return scope.branchIds.includes(branchId);
}

// Build a Prisma `where` fragment that scopes by team. Pass into queries like:
//   prisma.shift.findMany({ where: { ...teamWhere(scope), startsAt: ... } })
export function teamWhere(scope: AccessScope): { teamId?: { in: string[] } } {
  if (scope.teamIds === null) return {};
  return { teamId: { in: scope.teamIds } };
}
