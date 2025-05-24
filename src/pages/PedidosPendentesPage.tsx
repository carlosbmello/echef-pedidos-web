// src/pages/PedidosPendentesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { trySincronizarEInformar, onSyncStatusChange, getSyncStatus, sincronizarPedidosPendentes } from '../services/syncService'; // Adicionado sincronizarPedidosPendentes se for usar para individual
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiRefreshCw, FiAlertTriangle, FiTrash2, FiClock, FiEye, FiCheckCircle, FiSend } from 'react-icons/fi'; // Adicionado FiEye, FiXCircle, FiCheckCircle, FiSend
import { PedidoOfflinePayload, ItemPedidoOffline } from '../types/pedido';
import { getPedidosOfflineDB, deletePedidoOfflineDB, updatePedidoOfflineDB } from '../services/dbService'; // updatePedidoOfflineDB pode ser útil para sync individual
import { toast } from 'react-toastify';
import Modal from '../components/common/Modal'; // Supondo que você tenha um componente Modal

interface SyncStatusInfo {
  isSyncing: boolean;
  error: string | null;
  lastResults?: any;
}

const PedidosPendentesPage: React.FC = () => {
  const [pedidosPendentes, setPedidosPendentes] = useState<PedidoOfflinePayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusInfo>(getSyncStatus());
  const [pedidoSelecionadoParaVerItens, setPedidoSelecionadoParaVerItens] = useState<PedidoOfflinePayload | null>(null);
  const [isSyncingIndividual, setIsSyncingIndividual] = useState<string | null>(null); // Armazena o id_local do pedido sendo sincronizado individualmente

  const carregarPedidos = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const pedidos: PedidoOfflinePayload[] = await getPedidosOfflineDB();
      // Ordena para mostrar pendentes e com erro primeiro, depois por data mais antiga
      pedidos.sort((a, b) => {
        const statusOrder = (status: PedidoOfflinePayload['statusSync']) => {
            if (status === 'pendente') return 1;
            if (status === 'erro') return 2;
            if (status === 'enviando') return 3;
            return 4; // sincronizado
        };
        if (statusOrder(a.statusSync) !== statusOrder(b.statusSync)) {
            return statusOrder(a.statusSync) - statusOrder(b.statusSync);
        }
        return a.timestamp - b.timestamp; // Mais antigo primeiro
      });
      setPedidosPendentes(pedidos);
    } catch (err) {
      console.error("Erro ao carregar pedidos pendentes do DB:", err);
      setPageError("Falha ao carregar pedidos salvos localmente.");
      toast.error("Falha ao carregar pedidos salvos localmente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarPedidos();
    const unsubscribe = onSyncStatusChange((status) => {
      setSyncStatus(status);
      if (!status.isSyncing) {
        carregarPedidos(); // Recarrega a lista após sincronização global
        setIsSyncingIndividual(null); // Limpa status de sincronização individual
      }
    });
    return unsubscribe;
  }, [carregarPedidos]);

  const handleSincronizarTodos = async () => {
    if (syncStatus.isSyncing || isSyncingIndividual) {
        toast.warn("A sincronização já está em andamento.");
        return;
    }
    if (!navigator.onLine) {
        toast.error("Você está offline. Não é possível sincronizar agora.");
        return;
    }
    toast.info("Iniciando sincronização de todos os pedidos pendentes...");
    await trySincronizarEInformar();
  };

  const handleDescartarPedido = async (id_local: string) => {
    if (window.confirm(`Tem certeza que deseja descartar o pedido local ${id_local.substring(0,8)}...? Esta ação não pode ser desfeita.`)) {
      try {
        await deletePedidoOfflineDB(id_local);
        toast.success('Pedido local descartado com sucesso.');
        carregarPedidos();
      } catch (err: any) {
        console.error("Erro ao descartar pedido local:", err);
        toast.error(`Falha ao descartar o pedido local: ${err.message || 'Erro desconhecido'}`);
      }
    }
  };

  const handleTentarSincronizarIndividual = async (pedido: PedidoOfflinePayload) => {
    if (syncStatus.isSyncing || isSyncingIndividual) {
        toast.warn("Outra sincronização já está em andamento.");
        return;
    }
    if (!navigator.onLine) {
        toast.error("Você está offline. Não é possível sincronizar agora.");
        return;
    }
    
    setIsSyncingIndividual(pedido.id_local);
    toast.info(`Tentando sincronizar pedido ${pedido.id_local.substring(0,8)}...`);

    try {
        // Lógica similar à de sincronizarPedidosPendentes, mas para um único pedido
        const pedidoAtualizado: PedidoOfflinePayload = {
            ...pedido,
            statusSync: 'enviando',
            tentativas_sync: (pedido.tentativas_sync || 0) + 1,
        };
        await updatePedidoOfflineDB(pedidoAtualizado);
        setPedidosPendentes(prev => prev.map(p => p.id_local === pedido.id_local ? pedidoAtualizado : p)); // Atualiza UI imediatamente

        // Reutiliza mapPedidoOfflineToPedidoInput e criarPedido (precisam ser importados/disponíveis)
        // Esta parte precisaria da função mapPedidoOfflineToPedidoInput e criarPedido do pedidoService
        // Para simplificar, vamos chamar trySincronizarEInformar, que tentará todos, mas o efeito é similar
        // Se quiser mais granular, teria que replicar a lógica de `sincronizarPedidosPendentes` aqui.
        // Por enquanto, vamos apenas acionar a sincronização global, que pegará este pedido marcado como 'enviando'.
        // OU, idealmente, syncService teria uma função para sincronizar um ID específico.
        // *** ASSUMINDO QUE syncService.sincronizarPedidosPendentes() pode ser chamado para reavaliar ***
        const resultados = await sincronizarPedidosPendentes(); // Chama a função que itera sobre todos

        const erroDoPedido = resultados.erros.find(e => e.idLocal === pedido.id_local);
        if (resultados.sucesso > 0 && !erroDoPedido) { // Verifica se este pedido específico teve sucesso
             toast.success(`Pedido ${pedido.id_local.substring(0,8)} sincronizado com sucesso!`);
        } else if (erroDoPedido) {
             toast.error(`Falha ao sincronizar pedido ${pedido.id_local.substring(0,8)}: ${erroDoPedido.mensagem}`);
        } else if (resultados.total > 0 && resultados.sucesso === 0 && resultados.falha === 0) {
             // Pode acontecer se o pedido não estava mais no estado 'pendente' ou 'erro' com < 5 tentativas
             toast.info(`Pedido ${pedido.id_local.substring(0,8)} não necessitou de sincronização ou já foi processado.`);
        }
        // A lista será recarregada pelo onSyncStatusChange após a sincronização global terminar
    } catch (error: any) {
        toast.error(`Erro ao tentar sincronizar pedido ${pedido.id_local.substring(0,8)}: ${error.message || 'Erro desconhecido'}`);
        // Reverte o status na UI se a chamada inicial falhar (antes da API)
        const pedidoOriginal = await getPedidosOfflineDB().then(pedidos => pedidos.find(p => p.id_local === pedido.id_local));
        if(pedidoOriginal) await updatePedidoOfflineDB(pedidoOriginal);
    } finally {
        setIsSyncingIndividual(null);
        // carregarPedidos(); // O onSyncStatusChange deve cuidar disso, mas pode forçar aqui se necessário.
    }
  };


  if (isLoading && pedidosPendentes.length === 0 && !pageError) {
    return <LoadingSpinner message="Carregando pedidos pendentes..." />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Pedidos Pendentes</h1>
        <button
          onClick={handleSincronizarTodos}
          disabled={syncStatus.isSyncing || isSyncingIndividual !== null || !navigator.onLine}
          className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${syncStatus.isSyncing ? 'animate-pulse' : ''}`}
        >
          <FiRefreshCw className={`mr-2 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
          {syncStatus.isSyncing ? 'Sincronizando...' : (navigator.onLine ? 'Sincronizar Todos' : 'Offline')}
        </button>
      </div>

      {pageError && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md shadow"><p>{pageError}</p></div>}
      
      {/* Feedback de Sincronização (pode ser removido se os banners globais do App.tsx forem suficientes) */}
      {/* ... (blocos de syncStatus.error e syncStatus.lastResults já existentes) ... */}

      {pedidosPendentes.length === 0 && !isLoading && (
        <div className="text-center py-10">
          <FiCheckCircle className="mx-auto text-green-500 text-5xl mb-3" />
          <p className="text-gray-600 text-lg">Nenhum pedido pendente de sincronização.</p>
        </div>
      )}

      <div className="space-y-4">
        {pedidosPendentes.map((pedido) => (
          <div key={pedido.id_local} className={`p-4 rounded-lg shadow-lg border-l-4 relative ${
            pedido.statusSync === 'pendente' ? 'border-yellow-400 bg-yellow-50 hover:shadow-yellow-200/50' :
            pedido.statusSync === 'enviando' || isSyncingIndividual === pedido.id_local ? 'border-blue-400 bg-blue-50 animate-pulse hover:shadow-blue-200/50' :
            pedido.statusSync === 'erro' ? 'border-red-400 bg-red-50 hover:shadow-red-200/50' :
            pedido.statusSync === 'sincronizado' ? 'border-green-400 bg-green-50 hover:shadow-green-200/50' :
            'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
              <div className="flex-grow">
                <p className="text-xs text-gray-500 mb-1">ID: <span className="font-mono">{pedido.id_local.substring(0,8)}</span></p>
                <p className="font-semibold text-gray-800 text-lg">Comanda {pedido.numero_comanda_exibicao}</p>
                <p className="text-sm text-gray-600">Local: {pedido.local_pedido || 'N/A'}</p>
                <p className="text-xs text-gray-500 mt-1">Criado em: {new Date(pedido.timestamp).toLocaleString('pt-BR')}</p>
                <p className="text-sm mt-2">
                  Status:
                  {pedido.statusSync === 'pendente' && <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><FiClock className="mr-1.5 h-4 w-4"/> Pendente</span>}
                  {(pedido.statusSync === 'enviando' || isSyncingIndividual === pedido.id_local) && <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><FiRefreshCw className="mr-1.5 h-4 w-4 animate-spin"/> Enviando...</span>}
                  {pedido.statusSync === 'erro' && <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><FiAlertTriangle className="mr-1.5 h-4 w-4"/> Falhou (Tentativas: {pedido.tentativas_sync || 0})</span>}
                  {pedido.statusSync === 'sincronizado' && <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><FiCheckCircle className="mr-1.5 h-4 w-4"/> Sincronizado</span>}
                </p>
                {pedido.statusSync === 'erro' && pedido.mensagemErroSync && (
                  <p className="text-xs text-red-700 bg-red-100 p-2 mt-2 rounded max-w-md">Erro: {pedido.mensagemErroSync}</p>
                )}
              </div>
              <div className="flex flex-col sm:items-end space-y-2 mt-3 sm:mt-0 flex-shrink-0">
                <button
                  onClick={() => setPedidoSelecionadoParaVerItens(pedido)}
                  className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-md flex items-center w-full sm:w-auto justify-center"
                >
                  <FiEye className="mr-2"/> Ver Itens
                </button>
                {(pedido.statusSync === 'pendente' || pedido.statusSync === 'erro') && (
                    <button
                        onClick={() => handleTentarSincronizarIndividual(pedido)}
                        disabled={syncStatus.isSyncing || isSyncingIndividual !== null || !navigator.onLine}
                        className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md flex items-center disabled:opacity-50 w-full sm:w-auto justify-center"
                    >
                        <FiSend className="mr-2"/> Sincronizar Este
                    </button>
                )}
                <button
                  onClick={() => handleDescartarPedido(pedido.id_local)}
                  className="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md flex items-center w-full sm:w-auto justify-center"
                >
                  <FiTrash2 className="mr-2"/> Descartar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para Ver Itens */}
      {pedidoSelecionadoParaVerItens && (
        <Modal
          titulo={`Itens do Pedido (Comanda ${pedidoSelecionadoParaVerItens.numero_comanda_exibicao} - ID: ${pedidoSelecionadoParaVerItens.id_local.substring(0,8)})`}
          onClose={() => setPedidoSelecionadoParaVerItens(null)}
        >
          <div className="mt-2 text-sm text-gray-700 space-y-2">
            {pedidoSelecionadoParaVerItens.itens.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                    {pedidoSelecionadoParaVerItens.itens.map((item: ItemPedidoOffline, index: number) => (
                    <li key={`${item.produto_id}-${index}`}>
                        <span className="font-semibold">{item.quantidade}x {item.nome_produto}</span>
                        <span> (R$ {item.preco_unitario_momento.toFixed(2).replace('.', ',')})</span>
                        {item.observacao_item && <p className="text-xs italic text-gray-500 ml-2">Obs: {item.observacao_item}</p>}
                    </li>
                    ))}
                </ul>
            ) : (
                <p>Nenhum item neste pedido.</p>
            )}
            {pedidoSelecionadoParaVerItens.observacao_geral && (
                <div className="mt-3 pt-3 border-t">
                    <p className="font-semibold">Observação Geral:</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{pedidoSelecionadoParaVerItens.observacao_geral}</p>
                </div>
            )}
          </div>
          <div className="mt-4 text-right">
            <button
              type="button"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={() => setPedidoSelecionadoParaVerItens(null)}
            >
              Fechar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PedidosPendentesPage;