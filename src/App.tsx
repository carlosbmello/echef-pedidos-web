// src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Importações das Páginas ---
import LoginPage from './pages/LoginPage';
import ComandasPage from './pages/ComandasPage';
import CardapioPage from './pages/CardapioPage';
import PedidoPage from './pages/PedidoPage';
import PedidosPendentesPage from './pages/PedidosPendentesPage';

// --- Importações de Layout e Proteção ---
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

// --- Importar o serviço de sincronização ---
import { trySincronizarEInformar, onSyncStatusChange, getSyncStatus } from './services/syncService';

// Interface para o estado de sincronização
interface SyncStatusInfo {
  isSyncing: boolean;
  error: string | null;
  lastResults?: {
    comandasAbertas?: string | number;
    pedidos?: { sucesso: number; falha: number; total: number; erros: Array<{ idLocal: string; mensagem: string }> };
  };
}

// Componente auxiliar para o conteúdo principal do App (para usar o hook useAuth e gerenciar estado global da UI)
const MainAppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
  const [syncStatusInfo, setSyncStatusInfo] = useState<SyncStatusInfo>(getSyncStatus());
  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(!navigator.onLine);
  const [showPedidosSyncResultBanner, setShowPedidosSyncResultBanner] = useState<boolean>(false);


  // Efeito para listeners de conexão e status de sincronização
  useEffect(() => {
    const handleOnline = () => {
      console.log('APP: Evento ONLINE do navegador detectado.');
      setStatusConexao('online');
      setShowOfflineBanner(false); // Esconde banner de offline
      toast.success("Conexão restaurada!", { toastId: 'conexao-status' });
    };
    const handleOffline = () => {
      console.log('APP: Evento OFFLINE do navegador detectado.');
      setStatusConexao('offline');
      setShowOfflineBanner(true); // Mostra banner de offline
      toast.warn("Você está offline.", { toastId: 'conexao-status' });
      // Atualiza o estado de sincronização para refletir que está offline
      setSyncStatusInfo(prev => ({ ...prev, isSyncing: false, error: "Você está offline." }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeFromSyncStatus = onSyncStatusChange((status) => {
      console.log('APP: Callback onSyncStatusChange executado com status:', status);
      setSyncStatusInfo(status);

      // Se parou de sincronizar e não há erro de sincronização específico (ou seja, o erro não é "Você está offline")
      // E estamos online, então não precisamos mostrar o banner de offline
      if (!status.isSyncing && status.error !== "Você está offline." && navigator.onLine) {
        setShowOfflineBanner(false);
      }

      // Controlar visibilidade do banner de resultado de sincronização de pedidos
      if (!status.isSyncing && status.lastResults?.pedidos && (status.lastResults.pedidos.sucesso > 0 || status.lastResults.pedidos.falha > 0)) {
        setShowPedidosSyncResultBanner(true);
        // Esconde o banner de resultado de pedidos após alguns segundos
        setTimeout(() => setShowPedidosSyncResultBanner(false), 7000); // Exibe por 7 segundos
      } else if (status.isSyncing || status.error) { // Se começar a sincronizar ou der erro, esconde o banner de resultado
        setShowPedidosSyncResultBanner(false);
      }

      // Toast para resultado de sincronização de comandas (se houver)
      if (
        !status.isSyncing &&
        !status.error && // Só mostra se não houver erro de sincronização mais prioritário
        status.lastResults &&
        status.lastResults.comandasAbertas &&
        typeof status.lastResults.comandasAbertas === 'string' &&
        status.lastResults.comandasAbertas.includes('sincronizadas')
      ) {
        // Adiciona um pequeno delay para que este toast não sobreponha imediatamente o de pedidos
        setTimeout(() => {
            if (getSyncStatus().lastResults?.comandasAbertas) { // Re-verifica o estado atual antes de mostrar
                 toast.info(`Sinc. Comandas: ${getSyncStatus().lastResults?.comandasAbertas}`, {
                    position: "bottom-left",
                    toastId: "comandas-sync-result"
                });
            }
        }, 1000); // Delay
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeFromSyncStatus();
    };
  }, []); // Array de dependências vazio para rodar apenas na montagem/desmontagem

  // Efeito para tentar sincronizar quando ficar online ou na carga inicial se online e autenticado
  useEffect(() => {
    if (statusConexao === 'online' && isAuthenticated) {
      console.log(`APP: statusConexao é 'online' e usuário autenticado. Tentando sincronização inicial...`);
      trySincronizarEInformar();
    } else if (statusConexao === 'offline') {
      console.log(`APP: statusConexao é 'offline'. Nenhuma sincronização automática.`);
    }
  }, [statusConexao, isAuthenticated]);

  // Renderiza os banners fixos no topo
  const renderTopBanners = () => {
    if (syncStatusInfo.isSyncing) {
      return <div className="bg-blue-500 text-white text-center p-1 text-xs fixed top-0 left-0 right-0 z-[100]">Sincronizando dados...</div>;
    }
    // Prioriza erro de sincronização específico sobre o banner genérico de "offline"
    if (syncStatusInfo.error && syncStatusInfo.error !== "Você está offline.") {
      return <div className="bg-red-500 text-white text-center p-1 text-xs fixed top-0 left-0 right-0 z-[100]">{syncStatusInfo.error}</div>;
    }
    if (showOfflineBanner) {
      return <div className="bg-orange-500 text-white text-center p-1 text-xs fixed top-0 left-0 right-0 z-[100]">Você está offline.</div>;
    }
    // Banner para resultado de sincronização de pedidos (controlado por showPedidosSyncResultBanner)
    if (showPedidosSyncResultBanner && syncStatusInfo.lastResults?.pedidos) {
        const { sucesso, falha } = syncStatusInfo.lastResults.pedidos;
        const corBg = falha > 0 ? 'bg-orange-600' : 'bg-green-600'; // Cores mais escuras para contraste
        return <div className={`${corBg} p-1 text-xs fixed top-0 left-0 right-0 z-[100] text-center text-white`}>Sinc. Pedidos: {sucesso} sucesso(s), {falha} falha(s).</div>;
    }
    return null;
  };

  return (
    <>
      {renderTopBanners()}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute allowedRoles={['garcom', 'admin']} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/comandas" replace />} />
            <Route path="/comandas" element={<ComandasPage />} />
            <Route path="/cardapio" element={<CardapioPage />} />
            <Route path="/pedidos-pendentes" element={<PedidosPendentesPage />} />
            <Route path="/comandas/:comandaId/novo-pedido" element={<PedidoPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
};

// Componente App principal que envolve com Providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <MainAppContent />
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </Router>
    </AuthProvider>
  );
};

export default App;