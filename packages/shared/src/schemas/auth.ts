import { z } from 'zod';
import { UserRole } from '../enums';
import { optionalImageUrlSchema } from '../validation/media';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Au moins 8 caractères'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  phone?: string | null;
  birthDate?: string | null; // ISO
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  isActive: boolean;
  /** Fiche Member OWNER liée (portail propriétaire). */
  ownerMemberId?: string | null;
  /** Forcer un changement de mot de passe (ex: première connexion). */
  mustChangePassword?: boolean;
  /** Accès module Comptabilité (fiche membre ou rôle DAF). */
  permComptabilite?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Au moins 8 caractères'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const createStaffUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Au moins 8 caractères'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(UserRole).optional().default(UserRole.STAFF),
  mustChangePassword: z.boolean().optional().default(true),
});
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;

export const createOwnerUserSchema = z.object({
  memberId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8, 'Au moins 8 caractères'),
  mustChangePassword: z.boolean().optional().default(true),
});
export type CreateOwnerUserInput = z.infer<typeof createOwnerUserSchema>;

export const resetOwnerPortalPasswordSchema = z.object({
  password: z.string().min(8, 'Au moins 8 caractères'),
  mustChangePassword: z.boolean().optional().default(true),
});
export type ResetOwnerPortalPasswordInput = z.infer<typeof resetOwnerPortalPasswordSchema>;

export const updateProfileSchema = z.object({
  civility: z.string().max(16).optional().nullable(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().max(32).optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  nationality: z.string().max(64).optional().nullable(),
  address: z.string().max(256).optional().nullable(),
  city: z.string().max(128).optional().nullable(),
  postalCode: z.string().max(32).optional().nullable(),
  country: z.string().max(64).optional().nullable(),
  company: z.string().max(128).optional().nullable(),
  avatarUrl: optionalImageUrlSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
