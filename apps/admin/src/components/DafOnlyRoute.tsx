import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { homePathForRole, hasComptabiliteAccess } from '@/lib/userRoles';

/** Module comptabilité : rôle DAF ou permission membre. */
export function DafOnlyRoute() {
  const user = useAuthStore((s) => s.user);
  if (!hasComptabiliteAccess(user.role, user.permComptabilite)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }
  return <Outlet />;
}
