import React from 'react';
import { useAuth } from '../hooks/useAuth';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800">Dashboard Garçom</h1>
      <p className="mt-2 text-gray-600">Bem-vindo, {user?.nome || user?.login}!</p>
      {/* Aqui podem ir atalhos, notificações, etc. */}
    </div>
  );
};
export default DashboardPage;