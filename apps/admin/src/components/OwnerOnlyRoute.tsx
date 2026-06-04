import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { homePathForRole, isOwnerUser } from '@/lib/userRoles';

/** Portail propriétaire : calendrier et réservations sur ses bateaux. */
export function OwnerOnlyRoute() {
  const role = useAuthStore((s) => s.user.role);
  const mustChangePassword = useAuthStore((s) => s.user.mustChangePassword);
  if (!isOwnerUser(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }
  if (mustChangePassword) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
