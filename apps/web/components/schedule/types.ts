export type Shift = {
  id: string;
  teamId: string;
  userId: string | null;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  published: boolean;
  team: { name: string; color: string | null; branchId: string };
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type TeamMember = {
  role: 'OWNER' | 'ADMIN' | 'BRANCH_MANAGER' | 'TEAM_MANAGER' | 'EMPLOYEE';
  teamId: string | null;
  team: { id: string; name: string; color: string | null } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
};
