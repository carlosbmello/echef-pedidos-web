// src/components/layout/AppLayout.tsx
import React, { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; 
import { FiLogOut, FiGrid, FiCoffee, FiUser, FiList, FiPlusSquare, FiMenu, FiX, FiRefreshCcw } from 'react-icons/fi'; // Adicionado FiRefreshCcw
import { toast } from 'react-toastify';

const AppLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); 

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); // Estado para o botão de sync

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);

  // --- FUNÇÃO PARA FORÇAR ATUALIZAÇÃO (RESET DO APP) ---
  const handleForceUpdate = async () => {
    const confirmar = window.confirm(
      "Deseja atualizar o cardápio e o aplicativo? Isso buscará as alterações mais recentes do servidor e limpará o cache."
    );

    if (!confirmar) return;

    setIsRefreshing(true);
    toast.info("Limpando cache e reiniciando...", { autoClose: 2000 });

    try {
      // 1. Limpa caches do Service Worker
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }

      // 2. Remove o Service Worker (força baixar versão nova)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }

      // 3. Limpa dados temporários de sessão
      sessionStorage.clear();

      // 4. Limpa o banco IndexedDB (Opcional - força re-sincronizar o cardápio do zero)
      // Se quiser que ele apague o banco local, descomente a linha abaixo:
      // indexedDB.deleteDatabase("echefPedidosDb"); 

      // 5. Recarrega a página do zero
      window.location.reload();
      
    } catch (error) {
      console.error("Erro ao resetar app:", error);
      toast.error("Falha ao atualizar. Tente fechar e abrir o navegador.");
      setIsRefreshing(false);
    }
  };

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
        <div className="flex items-center justify-between pt-2">
          <Link to="/comandas" className="text-2xl font-semibold text-white hover:text-blue-300 transition-colors px-2">
            eChef <span className="font-light">Pedidos</span>
          </Link>
          <button onClick={closeSidebar} className="p-2 text-gray-400 hover:text-white md:hidden">
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

        <nav className="flex-grow overflow-y-auto custom-scrollbar-thin">
          <ul className="space-y-1.5">
            {accessibleNavLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={navLinkClasses} onClick={closeSidebar}>
                  {link.icon} 
                  <span className="truncate">{link.text}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* --- RODAPÉ DA SIDEBAR COM BOTÃO DE ATUALIZAR E SAIR --- */}
        <div className="mt-auto space-y-2 pb-2 border-t border-slate-700 pt-4">
          
          {/* BOTÃO DE ATUALIZAÇÃO (SYNC/RESET) */}
          <button
            onClick={handleForceUpdate}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out text-sm shadow-md disabled:opacity-50"
          >
            <FiRefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
            {isRefreshing ? 'Atualizando...' : 'Atualizar Sistema'}
          </button>

          {/* BOTÃO DE SAIR */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center bg-slate-700 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out text-sm"
          >
            <FiLogOut className="mr-2 h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black opacity-50 md:hidden" onClick={closeSidebar}></div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <header className="bg-white shadow-sm md:hidden sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-4">
            <Link to="/comandas" className="text-lg font-semibold text-gray-700">eChef</Link>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600 hover:text-gray-900 rounded-md">
              <FiMenu size={24} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;