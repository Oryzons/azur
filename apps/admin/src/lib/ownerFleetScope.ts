import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useBoatsStore, type Boat } from '@/stores/boats';
import { isOwnerUser } from '@/lib/userRoles';

/** Bateaux et IDs visibles pour le portail propriétaire (fiche membre liée au compte). */
export function useOwnerFleetScope() {
  const role = useAuthStore((s) => s.user.role);
  const ownerMemberId = useAuthStore((s) => s.user.ownerMemberId ?? null);
  const storeBoats = useBoatsStore((s) => s.boats);
  const isOwner = isOwnerUser(role);

  const scopedBoats = useMemo<Boat[]>(() => {
    if (!isOwner) return storeBoats;
    if (!ownerMemberId) return [];
    return storeBoats.filter((b) => b.ownerId === ownerMemberId);
  }, [isOwner, ownerMemberId, storeBoats]);

  const ownedBoatIdSet = useMemo(() => new Set(scopedBoats.map((b) => b.id)), [scopedBoats]);

  return { isOwner, ownerMemberId, scopedBoats, ownedBoatIdSet };
}
