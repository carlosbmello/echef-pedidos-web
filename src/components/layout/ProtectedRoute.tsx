// src/components/layout/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

interface ProtectedRouteProps {
  allowedRoles: Array<'admin' | 'caixa' | 'garcom' | 'recepcao'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const location = useLocation();

  if (authIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner message="Verificando sua sessão..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    console.warn(`Acesso negado: Usuário ${user.login} (role: ${user.role}) tentou acessar rota para ${allowedRoles.join(', ')}`);
    // Você pode criar uma página de "Não Autorizado" ou redirecionar para um local seguro.
    // Por ora, redirecionando para o login com uma mensagem (que LoginPage não trata ainda, mas poderia).
    return <Navigate to="/login" state={{ from: location, unauthorized: true }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;