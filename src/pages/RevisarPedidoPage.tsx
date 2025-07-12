// src/pages/RevisarPedidoPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PedidoItemInput, BackendPedidoPayload, PedidoOfflinePayload } from '../types/pedido';
import { criarPedido as criarPedidoAPI } from '../services/pedidoService';
import { salvarPedidoParaSincronizacaoDB } from '../services/dbService';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiSave, FiTrash2, FiEdit2, FiPlus, FiMinus, FiShoppingBag, FiMapPin } from 'react-icons/fi';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Tipos locais para clareza
interface ItemRevisaoState extends PedidoItemInput {
  nome_produto: string;
}

interface ComandaOriginalInfoParaRevisao {
  id: number | null;
  numero: string | null;
  cliente_nome: string | null;
  status: string | null;
  total_ja_consumido: number;
  local_atual: string | null;
  observacao_geral: string | null;
}

const RevisarPedidoPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { comandaId: comandaIdFromUrl } = useParams<{ comandaId: string }>();
  const { user } = useAuth();

  // --- Estados do Componente ---
  const [comandaOriginalInfo, setComandaOriginalInfo] = useState<ComandaOriginalInfoParaRevisao | null>(null);
  const [itensParaRevisao, setItensParaRevisao] = useState<ItemRevisaoState[]>([]);
  const [observacaoGeralPedido, setObservacaoGeralPedido] = useState<string>('');
  const [localEntregaCliente, setLocalEntregaCliente] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  // Efeito para inicializar a página com os dados recebidos da página anterior
  useEffect(() => {
    if (location.state) {
      const { comandaOriginal, novosItens, observacaoGeralPedidoAtual, localEntregaCliente: localVindoDaEdicao } = location.state as any;

      if (comandaOriginal && novosItens !== undefined && localVindoDaEdicao) {
        setComandaOriginalInfo(comandaOriginal);
        setItensParaRevisao(novosItens || []);
        setObservacaoGeralPedido(observacaoGeralPedidoAtual || '');
        setLocalEntregaCliente(localVindoDaEdicao);
      } else {
        toast.error("Dados incompletos para revisão. Retornando.");
        navigate(comandaIdFromUrl ? `/comandas/${comandaIdFromUrl}/novo-pedido` : '/comandas', { replace: true });
      }
    } else {
      toast.error("Dados para revisão não encontrados. Retornando.");
      navigate(comandaIdFromUrl ? `/comandas/${comandaIdFromUrl}/novo-pedido` : '/comandas', { replace: true });
    }
    setIsLoadingPage(false);

    // Listeners para status de conexão online/offline
    const handleOnline = () => setStatusConexao('online');
    const handleOffline = () => setStatusConexao('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [location, comandaIdFromUrl, navigate]);

  // Cálculos de totais
  const subtotalNovosItens = useMemo(() => itensParaRevisao.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0), [itensParaRevisao]);
  const totalGeralPrevisto = useMemo(() => (comandaOriginalInfo?.total_ja_consumido || 0) + subtotalNovosItens, [comandaOriginalInfo, subtotalNovosItens]);

  // Funções para manipular os itens na tela de revisão
  const handleAtualizarQuantidadeRevisao = useCallback((produto_id: number, obs: string, novaQuantidade: number) => {
    if (novaQuantidade < 0) return;
    if (novaQuantidade === 0) {
      setItensParaRevisao(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs)));
      toast.info("Item removido.", { autoClose: 1000 });
    } else {
      setItensParaRevisao(prev => prev.map(i => i.produto_id === produto_id && i.observacao === obs ? { ...i, quantidade: novaQuantidade } : i));
    }
  }, []);

  const handleRemoverItemRevisao = useCallback((produto_id: number, obs: string) => {
    setItensParaRevisao(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs)));
    toast.info("Item removido.", { autoClose: 1000 });
  }, []);
  
  const handleEditarObservacaoItemRevisao = useCallback((produto_id_alvo: number, obsAntiga_alvo: string) => {
    // ... (lógica completa de edição de observação)
  }, [itensParaRevisao]);

  // Função para voltar à tela de edição, levando os dados atuais
  const handleVoltarParaAdicionarItens = useCallback(() => {
    if (!comandaOriginalInfo) { navigate('/comandas', { replace: true }); return; }
    navigate(
      `/comandas/${comandaOriginalInfo.id}/novo-pedido`,
      {
        replace: true,
        state: {
          comandaDetalhes: comandaOriginalInfo,
          localEntregaCliente: localEntregaCliente,
          itensPedidoRetornandoDaRevisao: itensParaRevisao,
          observacaoGeralRetornandoDaRevisao: observacaoGeralPedido
        }
      }
    );
  }, [navigate, comandaOriginalInfo, localEntregaCliente, itensParaRevisao, observacaoGeralPedido]);

  // Função principal para confirmar e enviar o pedido
  const handleConfirmarEEnviar = useCallback(async () => {
    setIsSubmitting(true);

    if (!user || !user.id || !comandaOriginalInfo || !localEntregaCliente) {
      toast.error("Dados essenciais ausentes (usuário, comanda ou local).");
      setIsSubmitting(false);
      return;
    }

    if (comandaOriginalInfo.status?.toLowerCase() !== 'aberta') {
      toast.error("A comanda não está aberta para novos pedidos.");
      setIsSubmitting(false);
      return;
    }

    const payloadBackend: BackendPedidoPayload = {
      comandaIdentifier: comandaOriginalInfo.numero!,
      local_cliente_entrega: localEntregaCliente.trim(),
      observacao_geral: observacaoGeralPedido?.trim() || null,
      itens: itensParaRevisao.map(item => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario_momento: item.preco_unitario,
        observacao_item: item.observacao?.trim() || null,
      })),
    };

    try {
      if (statusConexao === 'online') {
        await criarPedidoAPI(payloadBackend);
        toast.success("Pedido enviado com sucesso!");
        navigate('/comandas', { replace: true });
      } else {
        const pedidoOffline: PedidoOfflinePayload = {
          id_local: uuidv4(),
          timestamp: Date.now(),
          tentativas_sync: 0,
          nome_cliente_comanda: comandaOriginalInfo.cliente_nome || `Comanda ${comandaOriginalInfo.numero}`,
          numero_comanda_exibicao: comandaOriginalInfo.numero!,
          comandaIdentifier: payloadBackend.comandaIdentifier,
          usuario_id_frontend: user.id,
          local_pedido: payloadBackend.local_cliente_entrega,
          observacao_geral: payloadBackend.observacao_geral ?? undefined,
          itens: payloadBackend.itens.map(it => ({
            ...it,
            nome_produto: itensParaRevisao.find(i => i.produto_id === it.produto_id)?.nome_produto || "Produto Desconhecido",
          })),
          comanda_id_db: comandaOriginalInfo.id,
          statusSync: 'pendente',
        };
        await salvarPedidoParaSincronizacaoDB(pedidoOffline);
        toast.info("Pedido salvo offline. Será sincronizado quando houver conexão.");
        navigate('/comandas', { replace: true });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || (error.message || "Falha ao processar o pedido.");
      toast.error(`Erro: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [statusConexao, user, comandaOriginalInfo, localEntregaCliente, itensParaRevisao, observacaoGeralPedido, navigate]);

  if (isLoadingPage || !comandaOriginalInfo) {
    return <LoadingSpinner message="Carregando dados para revisão..." />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Cabeçalho da página */}
      <div className="flex justify-between items-center mb-6 pb-3 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Revisar Pedido - Comanda {comandaOriginalInfo.numero}</h1>
        <button onClick={handleVoltarParaAdicionarItens} disabled={isSubmitting} className="flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm disabled:opacity-50">
          <FiArrowLeft className="mr-2 h-5 w-5" /> Voltar e Editar
        </button>
      </div>

      {/* Feedback de Conexão */}
      {statusConexao === 'offline' && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md text-sm">
          Você está offline. O pedido será salvo localmente e sincronizado.
        </div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow-xl space-y-6">
        {/* Detalhes da Comanda */}
        <div className="p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center"><FiShoppingBag className="mr-2 text-blue-600"/> Detalhes da Comanda</h3>
            <p className="text-sm text-gray-600"><strong>Cliente:</strong> {comandaOriginalInfo.cliente_nome || 'Não informado'}</p>
            <p className="text-sm text-gray-600 flex items-center"><FiMapPin className="mr-1 text-gray-500"/>
              <strong>Local de Entrega:</strong> <span className="font-medium ml-1">{localEntregaCliente || 'Não informado'}</span>
            </p>
            {observacaoGeralPedido && <p className="text-sm text-gray-600 mt-1"><strong>Observação Geral do Pedido:</strong> <span className="italic">{observacaoGeralPedido}</span></p>}
            <p className="text-sm text-gray-600"><strong>Status da Comanda:</strong> <span className={`font-medium ${comandaOriginalInfo.status?.toLowerCase() === 'aberta' ? 'text-green-600' : 'text-red-600'}`}>{comandaOriginalInfo.status?.toUpperCase()}</span></p>
        </div>

        {/* Lista de Novos Itens */}
        <div className="border-t pt-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Novos Itens a Adicionar:</h3>
          {itensParaRevisao.length === 0 ? ( 
            <p className="text-gray-500 italic py-4 text-center">Nenhum novo item neste pedido.</p> 
          ) : (
            <div className="space-y-3">
              {itensParaRevisao.map((item, index) => (
                <div key={`${item.produto_id}-${item.observacao}-${index}`} className="bg-gray-50 p-3 rounded-md border shadow-sm">
                  {/* ... conteúdo do item ... */}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Totais */}
        <div className="border-t pt-4 mt-6 space-y-2 text-right">
          {/* ... conteúdo dos totais ... */}
        </div>

        {/* Botões de Ação */}
        <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
          <button type="button" onClick={handleVoltarParaAdicionarItens} className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm" disabled={isSubmitting}>
            Voltar e Editar
          </button>
          
          <button 
    type="button" 
    onClick={handleConfirmarEEnviar} 
    disabled={
      isSubmitting || 
      !comandaOriginalInfo || 
      comandaOriginalInfo.status?.toLowerCase() !== 'aberta' || 
      (itensParaRevisao.length === 0 && !observacaoGeralPedido?.trim())
    } 
    className="w-full sm:w-auto px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
>
    {isSubmitting ? (
      <>
        <LoadingSpinner size="small" />
        <span className="ml-2">Enviando...</span>
      </>
    ) : (
      <>
        <FiSave className="mr-2 h-5 w-5" />
        <span>Confirmar e Enviar Pedido</span>
      </>
    )}
</button>
        </div>
      </div>
    </div>
  );
};

export default RevisarPedidoPage;