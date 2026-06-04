import { SetMetadata } from '@nestjs/common';
import {
  ADMIN_MANAGER_ROLES,
  DESK_OR_OWNER_ROLES,
  DESK_ROLES,
  OWNER_PORTAL_ROLES,
  RESERVATIONS_READ_ROLES,
  TABLET_AGENT_OR_ADMIN,
  UserRole,
} from '@bleu-calanque/shared';
import { ROLES_KEY } from './roles.decorator';

/** Back-office : ADMIN, MANAGER, STAFF — bloque AGENT par défaut. */
export const DeskOnly = () => SetMetadata(ROLES_KEY, [...DESK_ROLES]);

/** ADMIN + MANAGER (actions sensibles). */
export const AdminManagerOnly = () => SetMetadata(ROLES_KEY, [...ADMIN_MANAGER_ROLES]);

/** ADMIN uniquement. */
export const AdminOnly = () => SetMetadata(ROLES_KEY, [UserRole.ADMIN]);

/** Agents tablette (+ admins pour tests). */
export const TabletAgent = () => SetMetadata(ROLES_KEY, [...TABLET_AGENT_OR_ADMIN]);

/** Lecture réservations (calendrier tablette + bureau). */
export const ReservationsRead = () => SetMetadata(ROLES_KEY, [...RESERVATIONS_READ_ROLES]);

/** Bureau ou portail propriétaire. */
export const DeskOrOwner = () => SetMetadata(ROLES_KEY, [...DESK_OR_OWNER_ROLES]);

/** Propriétaire uniquement. */
export const OwnerOnly = () => SetMetadata(ROLES_KEY, [...OWNER_PORTAL_ROLES]);

/** Tout utilisateur connecté (profil, déconnexion). */
export const AnyAuthenticated = () =>
  SetMetadata(ROLES_KEY, [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.AGENT,
    UserRole.OWNER,
  ]);
