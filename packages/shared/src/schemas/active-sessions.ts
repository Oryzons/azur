import type { UserRole } from '../enums';

/** Utilisateur avec au moins une session refresh valide et activité récente. */
export type ActiveSessionUser = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  lastSeenAt: string;
  sessionCount: number;
};
