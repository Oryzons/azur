import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { homePathForRole, isDeskUser } from '@/lib/userRoles';

/** Back-office : tout sauf AGENT pur. */
export function DeskOnlyRoute() {
  const role = useAuthStore((s) => s.user.role);
  if (!isDeskUser(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }
  return <Outlet />;
}
