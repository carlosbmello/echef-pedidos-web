// src/components/layout/AppLayout.tsx
import React, { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Ou o caminho correto: ../../contexts/AuthContext
import { FiLogOut, FiGrid, FiCoffee, FiUser, FiList, FiPlusSquare, FiMenu, FiX } from 'react-icons/fi';

const AppLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Para fechar o menu ao mudar de rota

  // Estado para controlar a visibilidade da sidebar no mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Função para fechar a sidebar (usada em cliques de link e overlay)
  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // Fecha a sidebar quando a rota muda
  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);


  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out text-sm font-medium ${
      isActive 
        ? 'bg-blue-600 text-white shadow-lg' 
        : 'text-gray-300 hover:bg-slate-700 hover:text-white'
    }`;

  const navLinks = [
    { to: "/comandas", icon: <FiGrid className="mr-3 h-5 w-5 flex-shrink-0" />, text: "Comandas", allowedRoles: ['garcom', 'admin', 'recepcao'] },
    { 
      to: "/comandas/registrar", 
      icon: <FiPlusSquare className="mr-3 h-5 w-5 flex-shrink-0" />, 
      text: "Registrar Comanda", 
      allowedRoles: ['admin', 'recepcao', 'garcom'] 
    },
    { to: "/cardapio", icon: <FiCoffee className="mr-3 h-5 w-5 flex-shrink-0" />, text: "Cardápio", allowedRoles: ['garcom', 'admin', 'recepcao'] },
    { to: "/pedidos-pendentes", icon: <FiList className="mr-3 h-5 w-5 flex-shrink-0" />, text: "Pedidos Pendentes", allowedRoles: ['garcom', 'admin', 'recepcao'] },
  ];

  const accessibleNavLinks = user ? navLinks.filter(link => 
    !link.allowedRoles || link.allowedRoles.includes(user.role)
  ) : [];

  return (
    <div className="flex h-screen bg-gray-100 font-sans antialiased">
      {/* Sidebar */}
      <aside 
        className={`
          bg-slate-800 text-white p-4 space-y-6 flex flex-col shadow-xl
          transform transition-transform duration-300 ease-in-out 
          fixed inset-y-0 left-0 z-30 w-64 
          md:relative md:translate-x-0 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Menu Lateral"
      >
        {/* Header da Sidebar com Logo e Botão de Fechar (mobile) */}
        <div className="flex items-center justify-between pt-2">
          <Link to="/comandas" className="text-2xl font-semibold text-white hover:text-blue-300 transition-colors px-2">
            eChef <span className="font-light">Pedidos</span>
          </Link>
          <button 
            onClick={closeSidebar} 
            className="p-2 text-gray-400 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <FiX size={24} />
          </button>
        </div>

        {user && (
            <div className="px-2 py-2 border-t border-b border-slate-700">
                <p className="text-sm text-gray-300 flex items-center">
                    <FiUser className="inline mr-2 mb-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{user.nome}</span>
                </p>
                <p className="text-xs text-gray-500 ml-6 capitalize">{user.role}</p>
            </div>
        )}

        <nav className="flex-grow overflow-y-auto custom-scrollbar-thin"> {/* Adicionado custom-scrollbar-thin se tiver muitos links */}
          <ul className="space-y-1.5">
            {accessibleNavLinks.map((link) => (
              <li key={link.to}>
                <NavLink 
                  to={link.to} 
                  className={navLinkClasses}
                  onClick={closeSidebar} // Fecha sidebar ao clicar no link
                >
                  {link.icon} 
                  <span className="truncate">{link.text}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pb-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          >
            <FiLogOut className="mr-2 h-5 w-5 flex-shrink-0" /> Sair
          </button>
        </div>
      </aside>

      {/* Overlay para fechar sidebar no mobile ao clicar fora */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black opacity-50 md:hidden" 
          onClick={closeSidebar}
          aria-hidden="true"
        ></div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col overflow-x-hidden"> {/* Adicionado overflow-x-hidden */}
        {/* Header do Conteúdo Principal (Onde o botão hambúrguer fica no mobile) */}
        <header className="bg-white shadow-sm md:hidden sticky top-0 z-10 flex-shrink-0"> {/* Apenas visível no mobile e fixo */}
          <div className="flex items-center justify-between h-16 px-4">
            {/* Pode colocar um logo menor ou título aqui se quiser */}
            <Link to="/comandas" className="text-lg font-semibold text-gray-700">
              eChef
            </Link>
            <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2 text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-label="Abrir menu"
            >
              <FiMenu size={24} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;