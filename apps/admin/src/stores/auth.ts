import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invalidatePlanningStores } from '@/lib/invalidatePlanningStores';

export interface AuthUserSlice {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
  role: string;
  ownerMemberId?: string | null;
  isActive: boolean;
  mustChangePassword?: boolean;
  permComptabilite?: boolean;
}

interface AuthTokensPayload {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSlice;
}

interface AuthState extends AuthTokensPayload {
  setSession: (t: AuthTokensPayload) => void;
  clear: () => void;
}

const empty: AuthTokensPayload = {
  accessToken: '',
  refreshToken: '',
  user: { id: '', email: '', firstName: '', lastName: '', role: 'STAFF', isActive: true, avatarUrl: null },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...empty,
      setSession: (t: AuthTokensPayload) =>
        set({
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          user: t.user,
        }),
      clear: () => {
        invalidatePlanningStores();
        set({ ...empty });
      },
    }),
    {
      name: 'bleu-calanque-auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
    },
  ),
);
