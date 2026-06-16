export function isAgentUser(role: string | undefined | null): boolean {
  return role === 'AGENT';
}

export function isOwnerUser(role: string | undefined | null): boolean {
  return role === 'OWNER';
}

export function isDafUser(role: string | undefined | null): boolean {
  return role === 'DAF';
}

export function hasComptabiliteAccess(
  role: string | undefined | null,
  permComptabilite?: boolean | null,
): boolean {
  return isDafUser(role) || Boolean(permComptabilite);
}

export function isDeskUser(role: string | undefined | null): boolean {
  return Boolean(role) && role !== 'AGENT' && role !== 'OWNER' && role !== 'DAF';
}

export function homePathForRole(role: string | undefined | null): string {
  if (isAgentUser(role)) return '/tablette/aujourdhui';
  if (isOwnerUser(role)) return '/calendrier';
  if (isDafUser(role)) return '/comptabilite';
  return '/dashboard';
}

export function loginPathAfterAuth(role: string, mustChangePassword?: boolean): string {
  if (mustChangePassword) {
    if (isAgentUser(role)) return '/tablette/profil';
    if (isOwnerUser(role)) return '/login';
    if (isDafUser(role)) return '/login';
    if (isDeskUser(role)) return '/login';
  }
  return homePathForRole(role);
}
