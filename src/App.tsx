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
import RevisarPedidoPage from './pages/RevisarPedidoPage'; // Importação já estava correta!

// --- Importações de Layout e Proteção ---
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

import CriarComandaPage from './pages/CriarComandaPage'; 

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

// Componente auxiliar para o conteúdo principal do App
const MainAppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
  const [syncStatusInfo, setSyncStatusInfo] = useState<SyncStatusInfo>(getSyncStatus());
  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(!navigator.onLine);
  const [showPedidosSyncResultBanner, setShowPedidosSyncResultBanner] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => { console.log('APP: Evento ONLINE.'); setStatusConexao('online'); setShowOfflineBanner(false); toast.success("Conexão restaurada!", { toastId: 'conexao-status' }); };
    const handleOffline = () => { console.log('APP: Evento OFFLINE.'); setStatusConexao('offline'); setShowOfflineBanner(true); toast.warn("Você está offline.", { toastId: 'conexao-status' }); setSyncStatusInfo(prev => ({ ...prev, isSyncing: false, error: "Você está offline." })); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribeFromSyncStatus = onSyncStatusChange((status) => { console.log('APP: Callback onSyncStatusChange:', status); setSyncStatusInfo(status); if (!status.isSyncing && status.error !== "Você está offline." && navigator.onLine) { setShowOfflineBanner(false); } if (!status.isSyncing && status.lastResults?.pedidos && (status.lastResults.pedidos.sucesso > 0 || status.lastResults.pedidos.falha > 0)) { setShowPedidosSyncResultBanner(true); setTimeout(() => setShowPedidosSyncResultBanner(false), 7000); } else if (status.isSyncing || status.error) { setShowPedidosSyncResultBanner(false); } if (!status.isSyncing && !status.error && status.lastResults && status.lastResults.comandasAbertas && typeof status.lastResults.comandasAbertas === 'string' && status.lastResults.comandasAbertas.includes('sincronizadas') ) { setTimeout(() => { if (getSyncStatus().lastResults?.comandasAbertas) { toast.info(`Sinc. Comandas: ${getSyncStatus().lastResults?.comandasAbertas}`, { position: "bottom-left", toastId: "comandas-sync-result" }); } }, 1000); } });
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); unsubscribeFromSyncStatus(); };
  }, []); 

  useEffect(() => {
    if (statusConexao === 'online' && isAuthenticated) { console.log(`APP: Online e autenticado. Sincronizando...`); trySincronizarEInformar();
    } else if (statusConexao === 'offline') { console.log(`APP: Offline. Sem sync.`); }
  }, [statusConexao, isAuthenticated]);

  const renderTopBanners = () => {
    if (syncStatusInfo.isSyncing) { return <div className="bg-blue-500 text-white text-center p-1 text-xs fixed top-0 left-0 right-0 z-[100]">Sincronizando dados...</div>; }
    if (syncStatusInfo.error && syncStatusInfo.error !== "Você está offline.") { return <div className="bg-red-500 text-white text-center p-1 text-xs fixed top-0 left-0 right-0 z-[100]">{syncStatusInfo.error}</div>; }
    if (showOfflineBanner) { return <div className="bg-orange-500 text-white text-center p-1 text-xs fixed top-0 left-0 right-0 z-[100]">Você está offline.</div>; }
    if (showPedidosSyncResultBanner && syncStatusInfo.lastResults?.pedidos) { const { sucesso, falha } = syncStatusInfo.lastResults.pedidos; const corBg = falha > 0 ? 'bg-orange-600' : 'bg-green-600'; return <div className={`${corBg} p-1 text-xs fixed top-0 left-0 right-0 z-[100] text-center text-white`}>Sinc. Pedidos: {sucesso}s, {falha}f.</div>;}
    return null;
  };

  return (
    <>
      {renderTopBanners()}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route element={<ProtectedRoute allowedRoles={['garcom', 'admin', 'recepcao']} />}> {/* Ajuste roles aqui */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/comandas" replace />} />
            <Route path="/comandas" element={<ComandasPage />} />
            <Route path="/comandas/registrar" element={<CriarComandaPage />} /> 
            <Route path="/cardapio" element={<CardapioPage />} />
            <Route path="/pedidos-pendentes" element={<PedidosPendentesPage />} />
            <Route path="/comandas/:comandaId/novo-pedido" element={<PedidoPage />} />
            
            {/* ***** NOVA ROTA PARA REVISAR PEDIDO ***** */}
            <Route 
              path="/comandas/:comandaId/revisar-pedido" // :comandaId será o ID numérico
              element={<RevisarPedidoPage />} 
            />
            {/* ***************************************** */}
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? "/comandas" : "/login"} replace />} />
      </Routes>
    </>
  );
};

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