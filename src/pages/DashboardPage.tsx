import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { FiRefreshCcw, FiInfo } from 'react-icons/fi'; // Importe o ícone de refresh
import { toast } from 'react-toastify';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Função "Nuclear" para resetar o app e buscar tudo novo
  const handleForçarAtualizacao = async () => {
    const confirmar = window.confirm(
      "Deseja atualizar o cardápio e o aplicativo? Isso buscará as alterações mais recentes do servidor."
    );

    if (!confirmar) return;

    setIsRefreshing(true);
    toast.info("Limpando cache e atualizando...", { autoClose: 2000 });

    try {
      // 1. Limpa todos os caches do navegador (Service Worker Cache)
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }

      // 2. Unregister Service Workers (força o download da nova versão no próximo load)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }

      // 3. Limpa o SessionStorage (pode manter o LocalStorage se quiser manter o login)
      sessionStorage.clear();

      // 4. Recarrega a página forçando o download do servidor
      window.location.reload();
      
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Falha ao atualizar. Tente fechar e abrir o app.");
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-blue-600">
        <h1 className="text-2xl font-bold text-gray-800">Painel do Garçom</h1>
        <p className="mt-1 text-gray-600">
          Bem-vindo, <span className="font-semibold text-blue-600">{user?.nome || user?.login}</span>!
        </p>

        <div className="mt-8 space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100">
            <FiInfo className="text-blue-500 mt-1 flex-shrink-0" size={20} />
            <p className="text-sm text-blue-800">
              Se você não estiver vendo novos produtos ou preços alterados, use o botão abaixo para sincronizar.
            </p>
          </div>

          <button
            onClick={handleForçarAtualizacao}
            disabled={isRefreshing}
            className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${
              isRefreshing ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            <FiRefreshCcw className={`${isRefreshing ? 'animate-spin' : ''}`} size={22} />
            {isRefreshing ? 'Atualizando...' : 'SINCRONIZAR CARDÁPIO'}
          </button>
        </div>

        <div className="mt-10 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">eChef v1.0.0 - Sistema Tanque de Guerra</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;