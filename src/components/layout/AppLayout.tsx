// src/components/layout/AppLayout.tsx
import React from 'react';
import { Outlet, Link, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { FiLogOut, FiGrid, FiCoffee, FiUser, FiList } from 'react-icons/fi'; // Adicionado FiClipboard

const AppLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login'); // Redireciona para login após o logout
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out ${
      isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white p-5 space-y-6 flex flex-col shadow-lg">
        <div className="text-center py-4">
          <Link to="/comandas" className="text-2xl font-semibold text-white hover:text-blue-300 transition-colors">
            eChef <span className="font-light">Pedidos</span>
          </Link>
          {user && (
            <p className="text-xs text-gray-400 mt-1">
              <FiUser className="inline mr-1 mb-0.5" />
              {user.nome} ({user.role})
            </p>
          )}
        </div>

        <nav className="flex-grow">
          <ul className="space-y-2">
            <li>
              <NavLink to="/comandas" className={navLinkClasses}>
                <FiGrid className="mr-3 h-5 w-5" /> Comandas
              </NavLink>
            </li>
            <li>
              <NavLink to="/cardapio" className={navLinkClasses}>
                <FiCoffee className="mr-3 h-5 w-5" /> Cardápio
              </NavLink>
            </li>
            <li>
      <NavLink to="/pedidos-pendentes" className={navLinkClasses}>
        <FiList className="mr-3 h-5 w-5" /> Pedidos Pendentes
      </NavLink>
    </li>
          </ul>
        </nav>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          >
            <FiLogOut className="mr-2 h-5 w-5" /> Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <Outlet /> {/* Onde o conteúdo da rota atual será renderizado */}
      </main>
    </div>
  );
};

export default AppLayout;