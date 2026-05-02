import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../features/hooks';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const roleRedirects: Record<string, string> = {
      customer: '/',
      pharmacist: '/pharmacist',
      senior_pharmacist: '/pharmacist',
      delivery_partner: '/delivery',
      warehouse_staff: '/warehouse',
      admin_super: '/admin',
      admin_operations: '/admin',
      admin_finance: '/admin',
      admin_content: '/admin',
      admin_support: '/admin',
    };

    return <Navigate to={roleRedirects[user.role] || '/'} replace />;
  }

  return <>{children}</>;
}
