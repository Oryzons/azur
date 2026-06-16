export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  /** Compte tablette check-in / check-out uniquement. */
  AGENT = 'AGENT',
  /** Portail propriétaire : ses bateaux, indisponibilités et réservations associées. */
  OWNER = 'OWNER',
  /** Comptabilité : module financier uniquement. */
  DAF = 'DAF',
}

export const CHECK_FLOW_KIND_VALUES = ['CHECK_IN', 'CHECK_OUT'] as const;
export type CheckFlowKind = (typeof CHECK_FLOW_KIND_VALUES)[number];

export const CHECK_QUESTION_TYPE_VALUES = ['TEXT', 'BOOLEAN', 'SELECT', 'PHOTO', 'FUEL_GAUGE'] as const;
export type CheckQuestionType = (typeof CHECK_QUESTION_TYPE_VALUES)[number];
