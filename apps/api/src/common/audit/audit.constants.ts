/** Actions enregistrées dans audit_logs. */
export const AuditAction = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  REFUND: 'REFUND',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  CLEAR_ALL: 'CLEAR_ALL',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
  AUTH: 'auth',
  USER: 'user',
  RESERVATION: 'reservation',
  BOAT: 'boat',
  FLEET: 'fleet',
  MEMBER: 'member',
  ANNOUNCEMENT: 'announcement',
  EXTRA: 'extra',
  COUPON: 'coupon',
  COUPON_REDEMPTION: 'coupon_redemption',
  PRICING_PERIOD: 'pricing_period',
  PRICING_PRICE: 'pricing_price',
  SETTINGS: 'settings',
  PARTNER: 'partner',
  CONTRACT: 'contract',
} as const;

export type AuditEntityType = (typeof AuditEntity)[keyof typeof AuditEntity];
