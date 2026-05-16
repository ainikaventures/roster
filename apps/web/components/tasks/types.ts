export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt: string | null;
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  requirePhoto: boolean;
  requireSignature: boolean;
  requireNote: boolean;
  teamId: string;
  assignedUserId: string | null;
  createdAt: string;
  team: { id: string; name: string; color: string | null };
  assignee: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  completions: { id: string; completedAt: string; userId: string }[];
  _count: { completions: number };
};
