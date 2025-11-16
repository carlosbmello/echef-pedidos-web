import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PedidoItemInput, BackendPedidoPayload, PedidoOfflinePayload } from '../types/pedido';
import { criarPedido as criarPedidoAPI } from '../services/pedidoService';
import { salvarPedidoParaSincronizacaoDB } from '../services/dbService';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import { FiSave, FiTrash2, FiEdit2, FiPlus, FiMinus, FiMessageSquare } from 'react-icons/fi';
import LoadingSpinner from '../components/common/LoadingSpinner';

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

  const [comandaOriginalInfo, setComandaOriginalInfo] = useState<ComandaOriginalInfoParaRevisao | null>(null);
  const [itensParaRevisao, setItensParaRevisao] = useState<ItemRevisaoState[]>([]);
  const [observacaoGeralInput, setObservacaoGeralInput] = useState<string>('');
  const [localEntregaCliente, setLocalEntregaCliente] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  useEffect(() => {
    document.title = 'Revisar Pedido - eChef';
    if (location.state) {
      const { comandaOriginal, novosItens, localEntregaCliente: localVindo } = location.state as any;
      if (comandaOriginal && novosItens !== undefined && localVindo) {
        setComandaOriginalInfo(comandaOriginal);
        setItensParaRevisao(novosItens || []);
        setLocalEntregaCliente(localVindo);
        setObservacaoGeralInput(comandaOriginal.observacao_geral || '');
      } else {
        toast.error("Dados incompletos para revisão. Retornando.");
        navigate(comandaIdFromUrl ? `/comandas/${comandaIdFromUrl}/novo-pedido` : '/comandas', { replace: true });
      }
    } else {
      toast.error("Dados para revisão não encontrados. Retornando.");
      navigate(comandaIdFromUrl ? `/comandas/${comandaIdFromUrl}/novo-pedido` : '/comandas', { replace: true });
    }
    setIsLoadingPage(false);

    const handleOnline = () => setStatusConexao('online');
    const handleOffline = () => setStatusConexao('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { document.title = 'eChef'; window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [location, comandaIdFromUrl, navigate]);

  const subtotalNovosItens = useMemo(() => itensParaRevisao.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0), [itensParaRevisao]);

  const handleAtualizarQuantidadeRevisao = useCallback((produto_id: number, obs: string, novaQuantidade: number) => {
    if (novaQuantidade < 0) return;
    if (novaQuantidade === 0) {
      setItensParaRevisao(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs)));
      toast.info("Item removido.", { autoClose: 1000 });
    } else {
      setItensParaRevisao(prev => prev.map(i => i.produto_id === produto_id && i.observacao === obs ? { ...i, quantidade: novaQuantidade } : i ));
    }
  }, []);

  const handleRemoverItemRevisao = useCallback((produto_id: number, obs: string) => {
    setItensParaRevisao(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs)));
    toast.info("Item removido.", { autoClose: 1000 });
  }, []);
  
  const handleEditarObservacaoItemRevisao = useCallback((produto_id_alvo: number, obsAntiga_alvo: string) => {
    const itemParaEditar = itensParaRevisao.find(i => i.produto_id === produto_id_alvo && i.observacao === obsAntiga_alvo); if (!itemParaEditar) { toast.error("Item não encontrado."); return; } const nomeProduto = itemParaEditar.nome_produto; const novaObs = prompt(`Observação para ${nomeProduto}:`, obsAntiga_alvo); if (novaObs !== null) { const obsNovaFmt = novaObs.trim(); if (obsNovaFmt === obsAntiga_alvo) { toast.info("Obs. não alterada."); return; } let itensAtualizados = [...itensParaRevisao]; const itemConflitante = itensAtualizados.find(i => i.produto_id === produto_id_alvo && i.observacao === obsNovaFmt && i !== itemParaEditar); if (itemConflitante) { const qtdDoEditado = itemParaEditar.quantidade; itensAtualizados = itensAtualizados.map(i => (i.produto_id === produto_id_alvo && i.observacao === obsNovaFmt) ? { ...i, quantidade: i.quantidade + qtdDoEditado } : i).filter(i => i !== itemParaEditar); toast.info("Itens agrupados."); } else { itensAtualizados = itensAtualizados.map(i => (i === itemParaEditar) ? { ...i, observacao: obsNovaFmt } : i ); toast.success("Obs. atualizada."); } setItensParaRevisao(itensAtualizados); } }, [itensParaRevisao]);

  const handleVoltarParaAdicionarItens = useCallback(() => {
    if (!comandaOriginalInfo) { navigate('/comandas', { replace: true }); return; }
    navigate(
      `/comandas/${comandaOriginalInfo.id}/novo-pedido`,
      {
        replace: true,
        state: {
          comandaDetalhes: comandaOriginalInfo,
          localEntregaCliente: localEntregaCliente,
          itensPedidoRetornandoDaRevisao: itensParaRevisao
        }
      }
    );
  }, [navigate, comandaOriginalInfo, localEntregaCliente, itensParaRevisao]);

  const handleConfirmarEEnviar = useCallback(async () => {
    setIsSubmitting(true);
    if (!user || !user.id || !comandaOriginalInfo || !localEntregaCliente) {
      toast.error("Dados essenciais ausentes (usuário, comanda ou local).");
      setIsSubmitting(false); return;
    }
    if (comandaOriginalInfo.status?.toLowerCase() !== 'aberta') {
      toast.error("A comanda não está aberta para novos pedidos.");
      setIsSubmitting(false); return;
    }

    const payloadBackend: BackendPedidoPayload = {
      comandaIdentifier: comandaOriginalInfo.numero!,
      local_cliente_entrega: localEntregaCliente.trim(),
      observacao_geral: observacaoGeralInput.trim() || null,
      itens: itensParaRevisao.map(item => ({ produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario_momento: item.preco_unitario, observacao_item: item.observacao?.trim() || null })),
    };

    try {
      if (statusConexao === 'online') {
        await criarPedidoAPI(payloadBackend);
        toast.success("Pedido enviado com sucesso!");
        navigate('/comandas', { replace: true });
      } else {
        const pedidoOffline: PedidoOfflinePayload = {
          id_local: uuidv4(), timestamp: Date.now(), tentativas_sync: 0,
          nome_cliente_comanda: comandaOriginalInfo.cliente_nome || `Comanda ${comandaOriginalInfo.numero}`,
          numero_comanda_exibicao: comandaOriginalInfo.numero!,
          comandaIdentifier: payloadBackend.comandaIdentifier, usuario_id_frontend: user.id,
          local_cliente_entrega: payloadBackend.local_cliente_entrega,
          observacao_geral: payloadBackend.observacao_geral ?? undefined,
          itens: payloadBackend.itens.map(it => ({ ...it, nome_produto: itensParaRevisao.find(i => i.produto_id === it.produto_id)?.nome_produto || "Produto Desconhecido" })),
          comanda_id_db: comandaOriginalInfo.id, statusSync: 'pendente',
        };
        await salvarPedidoParaSincronizacaoDB(pedidoOffline);
        toast.info("Pedido salvo offline. Será sincronizado quando houver conexão.");
        navigate('/comandas', { replace: true });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Falha ao processar o pedido.";
      toast.error(`Erro: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [statusConexao, user, comandaOriginalInfo, localEntregaCliente, itensParaRevisao, observacaoGeralInput, navigate]);

  if (isLoadingPage || !comandaOriginalInfo) {
    return <LoadingSpinner message="Carregando dados para revisão..." />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 bg-gray-50 min-h-full">
      <div className="flex justify-between items-center mb-6 pb-3 border-b">
        <div>
          <p className="text-lg text-gray-600">Revisão de Pedido</p>
          <h1 className="text-3xl font-bold text-gray-800">
            {comandaOriginalInfo.numero}
            {comandaOriginalInfo.cliente_nome && <span className="font-normal text-2xl"> - {comandaOriginalInfo.cliente_nome}</span>}
          </h1>
        </div>
      </div>

      {statusConexao === 'offline' && <div className="mb-4 p-3 bg-yellow-100 border-yellow-400 text-yellow-700 rounded-md text-sm">Você está offline. O pedido será salvo localmente.</div>}
      
      <div className="bg-white p-6 rounded-lg shadow-xl space-y-6">
        
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Itens a serem Adicionados:</h3>
          {itensParaRevisao.length === 0 ? (
            <p className="text-gray-500 italic py-4 text-center bg-gray-50 rounded-md">
              Nenhum novo item para adicionar. Clique em "Adicionar Mais Itens" para voltar ao cardápio.
            </p>
          ) : (
            <div className="space-y-3">
              {itensParaRevisao.map((item, index) => (
                <div key={`${item.produto_id}-${item.observacao}-${index}`} className="bg-gray-50 p-3 rounded-md border shadow-sm">
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex-grow mr-2"><p className="font-semibold text-gray-800 text-sm">{item.nome_produto}</p><p className="text-xs text-gray-500"> R$ {(item.preco_unitario).toFixed(2).replace('.', ',')} / un. </p></div>
                    <p className="font-semibold text-blue-700 text-sm"> R$ {(item.quantidade * item.preco_unitario).toFixed(2).replace('.', ',')} </p>
                  </div>
                  {item.observacao && <p className="text-xs text-indigo-700 bg-indigo-50 p-1.5 rounded my-1.5 italic"> Obs: {item.observacao} </p>}
                  <div className="flex items-center justify-end space-x-2 mt-1 border-t pt-2">
                    <button onClick={() => handleEditarObservacaoItemRevisao(item.produto_id, item.observacao || '')} className="p-1.5 text-blue-600 hover:text-blue-800" title="Editar Observação"><FiEdit2 size={18} /></button>
                    <div className="flex items-center space-x-1 bg-gray-100 rounded-full p-0.5"><button onClick={() => handleAtualizarQuantidadeRevisao(item.produto_id, item.observacao || '', item.quantidade - 1)} className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100" title="Diminuir"><FiMinus size={16} /></button><span className="font-bold text-sm w-8 text-center text-gray-800 tabular-nums">{item.quantidade}</span><button onClick={() => handleAtualizarQuantidadeRevisao(item.produto_id, item.observacao || '', item.quantidade + 1)} className="p-1 text-green-600 hover:text-green-800 rounded-full hover:bg-green-100" title="Aumentar"><FiPlus size={16} /></button></div>
                    <button onClick={() => handleRemoverItemRevisao(item.produto_id, item.observacao || '')} className="p-1.5 text-red-500 hover:text-red-700" title="Remover"><FiTrash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="border-t pt-4 mt-6 space-y-2 text-right">
            <p className="text-xl font-bold text-gray-800">
              Subtotal: 
              <span className="ml-2 text-blue-700">{subtotalNovosItens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </p>
        </div>
        
        <div className="border-t pt-4">
            <label htmlFor="observacaoGeral" className="block text-lg font-semibold text-gray-700 mb-2"><FiMessageSquare className="inline mr-2"/>Observação Geral</label>
            <textarea id="observacaoGeral" value={observacaoGeralInput} onChange={e => setObservacaoGeralInput(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm" placeholder="Ex: Tudo para viagem, alergia a pimenta..."/>
        </div>

        <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
          <button type="button" onClick={handleVoltarParaAdicionarItens} className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm" disabled={isSubmitting}>Adicionar Mais Itens</button>
          <button type="button" onClick={handleConfirmarEEnviar} disabled={isSubmitting || !comandaOriginalInfo || comandaOriginalInfo.status?.toLowerCase() !== 'aberta' || (itensParaRevisao.length === 0 && !observacaoGeralInput?.trim())} className="w-full sm:w-auto px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            {isSubmitting ? (<><div className="w-5 h-5 mr-2"><LoadingSpinner /></div><span>Enviando...</span></>) : (<><FiSave className="mr-2 h-5 w-5" /><span>Confirmar e Enviar Pedido</span></>)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RevisarPedidoPage;