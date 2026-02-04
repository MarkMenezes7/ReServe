import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { UserType } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowed?: UserType[];
}

const ProtectedRoute = ({ children, allowed }: ProtectedRouteProps) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userType = localStorage.getItem('userType') as UserType | null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowed && userType && !allowed.includes(userType)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
