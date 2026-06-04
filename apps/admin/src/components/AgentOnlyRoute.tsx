import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { homePathForRole, isAgentUser } from '@/lib/userRoles';

/** Espace /tablette/* : AGENT (+ ADMIN/MANAGER pour tests). */
export function AgentOnlyRoute() {
  const role = useAuthStore((s) => s.user.role);
  const mustChangePassword = useAuthStore((s) => s.user.mustChangePassword);
  const location = useLocation();

  const canAccessTablet = isAgentUser(role) || role === 'ADMIN' || role === 'MANAGER';
  if (!canAccessTablet) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  if (isAgentUser(role) && mustChangePassword && location.pathname !== '/tablette/profil') {
    return <Navigate to="/tablette/profil" replace />;
  }

  return <Outlet />;
}
