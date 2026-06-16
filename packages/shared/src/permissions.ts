import { UserRole } from './enums';

/** Back-office complet (gestion). */
export const DESK_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] as const;

/** Configuration sensible (paramètres check-flow, création staff). */
export const ADMIN_MANAGER_ROLES = [UserRole.ADMIN, UserRole.MANAGER] as const;

/** Tablette terrain : check-in / check-out. */
export const TABLET_AGENT_ROLES = [UserRole.AGENT] as const;

/** Tablette + test admin. */
export const TABLET_AGENT_OR_ADMIN = [
  UserRole.AGENT,
  UserRole.ADMIN,
  UserRole.MANAGER,
] as const;

/** Module comptabilité (DAF uniquement). */
export const COMPTABILITE_ROLES = [UserRole.DAF] as const;

/** Lecture calendrier / réservations (agents + bureau + propriétaires + DAF pour reporting). */
export const RESERVATIONS_READ_ROLES = [...DESK_ROLES, UserRole.AGENT, UserRole.OWNER, UserRole.DAF] as const;

/** Lecture catalogue nécessaire au reporting financier. */
export const COMPTABILITE_OR_DESK_ROLES = [...DESK_ROLES, UserRole.DAF] as const;

/** Calendrier, indisponibilités et réservations (propriétaires). */
export const OWNER_PORTAL_ROLES = [UserRole.OWNER] as const;

/** Bureau ou propriétaire. */
export const DESK_OR_OWNER_ROLES = [...DESK_ROLES, UserRole.OWNER] as const;

export function isDeskRole(role: string): boolean {
  return (DESK_ROLES as readonly string[]).includes(role);
}

export function isOwnerRole(role: string): boolean {
  return role === UserRole.OWNER;
}

export function isTabletAgentRole(role: string): boolean {
  return role === UserRole.AGENT;
}

export function isDafRole(role: string): boolean {
  return role === UserRole.DAF;
}

export function canAccessDeskApi(role: string): boolean {
  return isDeskRole(role);
}

export function canAccessComptabiliteApi(role: string, permComptabilite?: boolean): boolean {
  return isDafRole(role) || Boolean(permComptabilite);
}

export function canAccessOwnerPortal(role: string): boolean {
  return isOwnerRole(role);
}
