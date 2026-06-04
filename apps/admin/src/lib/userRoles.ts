export function isAgentUser(role: string | undefined | null): boolean {
  return role === 'AGENT';
}

export function isOwnerUser(role: string | undefined | null): boolean {
  return role === 'OWNER';
}

export function isDeskUser(role: string | undefined | null): boolean {
  return Boolean(role) && role !== 'AGENT' && role !== 'OWNER';
}

export function homePathForRole(role: string | undefined | null): string {
  if (isAgentUser(role)) return '/tablette/aujourdhui';
  if (isOwnerUser(role)) return '/calendrier';
  return '/dashboard';
}

export function loginPathAfterAuth(role: string, mustChangePassword?: boolean): string {
  if (mustChangePassword) {
    if (isAgentUser(role)) return '/tablette/profil';
    if (isOwnerUser(role)) return '/login';
  }
  return homePathForRole(role);
}
