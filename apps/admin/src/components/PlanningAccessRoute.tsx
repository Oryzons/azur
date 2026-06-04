import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { homePathForRole, isAgentUser, isDeskUser, isOwnerUser } from '@/lib/userRoles';

/** Calendrier + réservations : back-office (admin) et portail propriétaire. */
export function PlanningAccessRoute() {
  const role = useAuthStore((s) => s.user.role);
  const mustChangePassword = useAuthStore((s) => s.user.mustChangePassword);

  if (isAgentUser(role)) {
    return <Navigate to="/tablette/aujourdhui" replace />;
  }
  if (!isDeskUser(role) && !isOwnerUser(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }
  if (isOwnerUser(role) && mustChangePassword) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
