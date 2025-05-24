// src/pages/RevisarPedidoPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// ComandaDetalhada não é usada diretamente se comandaOriginalInfo tem seu próprio tipo.
// import { ComandaDetalhada } from '../types/comanda'; 
import { PedidoItemInput, BackendPedidoPayload, PedidoOfflinePayload } from '../types/pedido'; // Removido ItemPedidoOffline se não usado diretamente
import { criarPedido as criarPedidoAPI } from '../services/pedidoService';
import { salvarPedidoParaSincronizacaoDB } from '../services/dbService';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
// FiMapPin, FiMessageSquare removidos. FiShoppingBag também se não usado.
import { FiArrowLeft, FiSave, FiTrash2, FiEdit2, FiPlus, FiMinus, FiShoppingBag } from 'react-icons/fi'; 
import LoadingSpinner from '../components/common/LoadingSpinner';

interface ItemRevisaoState extends PedidoItemInput {
  nome_produto: string;
}

interface ComandaOriginalInfoParaRevisao { // Tipo para os dados básicos da comanda
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
  const [observacaoGeralPedido, setObservacaoGeralPedido] = useState<string>('');
  const [localParaImpressao, setLocalParaImpressao] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  useEffect(() => {
    if (location.state) {
      const { 
        comandaOriginal, novosItens, 
        observacaoGeralPedidoAtual, localInformadoParaImpressao 
      } = location.state as { 
        comandaOriginal: ComandaOriginalInfoParaRevisao, novosItens: ItemRevisaoState[], 
        observacaoGeralPedidoAtual: string | null, localInformadoParaImpressao: string | null 
      };
      if (comandaOriginal && novosItens !== undefined && observacaoGeralPedidoAtual !== undefined && localInformadoParaImpressao !== undefined) {
        setComandaOriginalInfo(comandaOriginal);
        setItensParaRevisao(novosItens || []);
        setObservacaoGeralPedido(observacaoGeralPedidoAtual || '');
        setLocalParaImpressao(localInformadoParaImpressao);
      } else {
        toast.error("Dados incompletos para revisão."); navigate(comandaIdFromUrl ? `/comandas/${comandaIdFromUrl}/novo-pedido` : '/comandas', { replace: true });
      }
    } else {
      toast.error("Dados para revisão não encontrados."); navigate(comandaIdFromUrl ? `/comandas/${comandaIdFromUrl}/novo-pedido` : '/comandas', { replace: true });
    }
    setIsLoadingPage(false);
    const handleOnline = () => setStatusConexao('online'); const handleOffline = () => setStatusConexao('offline');
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [location.state, comandaIdFromUrl, navigate]);

  const subtotalNovosItens = useMemo(() => itensParaRevisao.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0), [itensParaRevisao]);
  const totalGeralPrevisto = useMemo(() => (comandaOriginalInfo?.total_ja_consumido || 0) + subtotalNovosItens, [comandaOriginalInfo, subtotalNovosItens]);

  const handleAtualizarQuantidadeRevisao = useCallback((produto_id: number, obs: string, novaQuantidade: number) => { if (novaQuantidade < 0) return; if (novaQuantidade === 0) { setItensParaRevisao(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs))); toast.info("Item removido.", {autoClose: 1000}); } else { setItensParaRevisao(prev => prev.map(i => i.produto_id === produto_id && i.observacao === obs ? { ...i, quantidade: novaQuantidade } : i )); } }, []);
  const handleRemoverItemRevisao = useCallback((produto_id: number, obs: string) => { setItensParaRevisao(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs))); toast.info("Item removido.", {autoClose: 1000}); }, []);
  const handleEditarObservacaoItemRevisao = useCallback((produto_id_alvo: number, obsAntiga_alvo: string) => { const itemParaEditar = itensParaRevisao.find(i => i.produto_id === produto_id_alvo && i.observacao === obsAntiga_alvo); if (!itemParaEditar) { toast.error("Item não encontrado."); return; } const nomeProduto = itemParaEditar.nome_produto; const novaObs = prompt(`Observação para ${nomeProduto}:`, obsAntiga_alvo); if (novaObs !== null) { const obsNovaFmt = novaObs.trim(); if (obsNovaFmt === obsAntiga_alvo) { toast.info("Obs. não alterada."); return; } const itemConflitante = itensParaRevisao.find(i => i.produto_id === produto_id_alvo && i.observacao === obsNovaFmt && i !== itemParaEditar); let itensAtualizados = [...itensParaRevisao]; const itemSendoEditado = itensAtualizados.find(i => i.produto_id === produto_id_alvo && i.observacao === obsAntiga_alvo); if (itemConflitante) { const qtdDoEditado = itemSendoEditado ? itemSendoEditado.quantidade : 0; itensAtualizados = itensAtualizados.map(i => (i.produto_id === produto_id_alvo && i.observacao === obsNovaFmt) ? { ...i, quantidade: i.quantidade + qtdDoEditado } : i).filter(i => i !== itemSendoEditado ); toast.info("Itens agrupados."); } else { itensAtualizados = itensAtualizados.map(i => (i === itemSendoEditado) ? { ...i, observacao: obsNovaFmt } : i ); toast.success("Obs. atualizada."); } setItensParaRevisao(itensAtualizados); } }, [itensParaRevisao]);
  const handleVoltarParaAdicionarItens = useCallback(() => { if (!comandaOriginalInfo) { navigate('/comandas', {replace: true}); return; } navigate( `/comandas/${comandaOriginalInfo.id}/novo-pedido`, { replace: true, state: { comandaDetalhes: comandaOriginalInfo, localInformadoParaImpressao: localParaImpressao, itensPedidoRetornandoDaRevisao: itensParaRevisao, observacaoGeralRetornandoDaRevisao: observacaoGeralPedido } } ); }, [navigate, comandaOriginalInfo, localParaImpressao, itensParaRevisao, observacaoGeralPedido]);
  const handleConfirmarEEnviar = useCallback(async () => { if (!comandaOriginalInfo || localParaImpressao === null ) { toast.error("Dados incompletos."); return; } if (comandaOriginalInfo.status?.toLowerCase() !== 'aberta') { toast.error("Comanda não está aberta."); return; } if (itensParaRevisao.length === 0 && !(observacaoGeralPedido?.trim()) && localParaImpressao === comandaOriginalInfo.local_atual) { toast.info("Nenhuma alteração."); return; } setIsSubmitting(true); const payload: BackendPedidoPayload = { comandaIdentifier: comandaOriginalInfo.numero!, local_pedido: localParaImpressao.trim(), observacao_geral: observacaoGeralPedido?.trim() || null, itens: itensParaRevisao.map(item => ({ produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario_momento: item.preco_unitario, observacao_item: item.observacao?.trim() || null, })), }; try { if (statusConexao === 'online') { await criarPedidoAPI(payload); toast.success("Pedido enviado!"); navigate('/comandas', { replace: true }); } else { const pedidoOffline: PedidoOfflinePayload = { id_local: uuidv4(), timestamp: Date.now(), tentativas_sync: 0, nome_cliente_comanda: comandaOriginalInfo.cliente_nome || `Comanda ${comandaOriginalInfo.numero}`, numero_comanda_exibicao: comandaOriginalInfo.numero!, comandaIdentifier: payload.comandaIdentifier, usuario_id_frontend: user?.id || 0, local_pedido: payload.local_pedido, observacao_geral: payload.observacao_geral === null ? undefined : payload.observacao_geral, itens: payload.itens.map(it => ({ produto_id: it.produto_id, quantidade: it.quantidade, preco_unitario_momento: it.preco_unitario_momento, observacao_item: it.observacao_item, nome_produto: itensParaRevisao.find(i => i.produto_id === it.produto_id)?.nome_produto || "" })), comanda_id_db: comandaOriginalInfo.id, statusSync: 'pendente', }; await salvarPedidoParaSincronizacaoDB(pedidoOffline); toast.info("Pedido salvo offline."); navigate('/comandas', { replace: true }); } } catch (error: any) { const errorMessage = error.response?.data?.message || "Falha ao enviar."; toast.error(errorMessage); } finally { setIsSubmitting(false); } }, [comandaOriginalInfo, localParaImpressao, itensParaRevisao, observacaoGeralPedido, statusConexao, navigate, user?.id]);

  if (isLoadingPage || !comandaOriginalInfo) { return <LoadingSpinner message="Carregando dados para revisão..." />; }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6 pb-3 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Revisar Pedido - Comanda {comandaOriginalInfo.numero}</h1>
        <button onClick={handleVoltarParaAdicionarItens} className="flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"> <FiArrowLeft className="mr-2 h-5 w-5" /> Voltar e Editar Itens </button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-xl space-y-6">
        <div className="p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center"><FiShoppingBag className="mr-2 text-blue-600"/> Detalhes da Comanda</h3>
            <p className="text-sm text-gray-600"><strong>Cliente:</strong> {comandaOriginalInfo.cliente_nome || 'Não informado'}</p>
            <p className="text-sm text-gray-600"><strong>Local para Entrega:</strong> {localParaImpressao || comandaOriginalInfo.local_atual || 'Não informado'}</p>
            {observacaoGeralPedido && <p className="text-sm text-gray-600 mt-1"><strong>Observação Geral do Pedido:</strong> <span className="italic">{observacaoGeralPedido}</span></p>}
            <p className="text-sm text-gray-600"><strong>Status da Comanda:</strong> <span className={`font-medium ${comandaOriginalInfo.status?.toLowerCase() === 'aberta' ? 'text-green-600' : 'text-red-600'}`}>{comandaOriginalInfo.status?.toUpperCase()}</span></p>
        </div>
        <div className="border-t pt-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Novos Itens a Adicionar:</h3>
          {itensParaRevisao.length === 0 ? ( <p className="text-gray-500 italic py-4 text-center">Nenhum novo item neste pedido.</p> ) : (
            <div className="space-y-3"> {itensParaRevisao.map((item, index) => ( <div key={`${item.produto_id}-${item.observacao}-${index}`} className="bg-gray-50 p-3 rounded-md border shadow-sm hover:shadow-md"> <div className="flex justify-between items-start mb-1.5"> <div className="flex-grow mr-2"> <p className="font-semibold text-gray-800 text-sm">{item.nome_produto}</p> <p className="text-xs text-gray-500"> R$ {(item.preco_unitario).toFixed(2).replace('.', ',')} / un. </p> </div> <p className="font-semibold text-blue-700 text-sm"> R$ {(item.quantidade * item.preco_unitario).toFixed(2).replace('.', ',')} </p> </div> {item.observacao && ( <p className="text-xs text-indigo-700 bg-indigo-50 p-1.5 rounded my-1.5 italic"> Obs: {item.observacao} </p> )} <div className="flex items-center justify-end space-x-2 mt-1 border-t pt-2"> <button onClick={() => handleEditarObservacaoItemRevisao(item.produto_id, item.observacao || '')} className="p-1.5 text-blue-600 hover:text-blue-800" title="Editar Observação"><FiEdit2 size={18} /></button> <div className="flex items-center space-x-1 bg-gray-100 rounded-full p-0.5"> <button onClick={() => handleAtualizarQuantidadeRevisao(item.produto_id, item.observacao || '', item.quantidade - 1)} className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100" title="Diminuir"><FiMinus size={16} /></button> <span className="font-bold text-sm w-8 text-center text-gray-800 tabular-nums">{item.quantidade}</span> <button onClick={() => handleAtualizarQuantidadeRevisao(item.produto_id, item.observacao || '', item.quantidade + 1)} className="p-1 text-green-600 hover:text-green-800 rounded-full hover:bg-green-100" title="Aumentar"><FiPlus size={16} /></button> </div> <button onClick={() => handleRemoverItemRevisao(item.produto_id, item.observacao || '')} className="p-1.5 text-red-500 hover:text-red-700" title="Remover"><FiTrash2 size={18} /></button> </div> </div> ))} </div>
          )}
        </div>
        <div className="border-t pt-4 mt-6 space-y-2 text-right">
            {comandaOriginalInfo.total_ja_consumido !== undefined && comandaOriginalInfo.total_ja_consumido > 0 && ( <p className="text-md text-gray-600"> Total Consumido Anteriormente: <span className="font-semibold">{comandaOriginalInfo.total_ja_consumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> </p> )}
            {itensParaRevisao.length > 0 && ( <p className="text-lg font-semibold text-gray-800"> Subtotal Novos Itens: <span className="font-semibold">{subtotalNovosItens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> </p> )}
            <p className="text-2xl font-bold text-blue-700"> Total Geral Previsto: <span className="font-semibold">{totalGeralPrevisto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> </p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
          <button type="button" onClick={handleVoltarParaAdicionarItens} className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm" disabled={isSubmitting}> Voltar e Editar </button>
          <button type="button" onClick={handleConfirmarEEnviar} disabled={isSubmitting || !comandaOriginalInfo || comandaOriginalInfo.status?.toLowerCase() !== 'aberta' || (itensParaRevisao.length === 0 && !(observacaoGeralPedido?.trim()))} className="w-full sm:w-auto px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"> {isSubmitting ? <span className="mr-2"><LoadingSpinner message="" /></span> : <FiSave className="mr-2 h-5 w-5" />} {isSubmitting ? 'Enviando...' : 'Confirmar e Enviar Pedido'} </button>
        </div>
        {comandaOriginalInfo && comandaOriginalInfo.status?.toLowerCase() !== 'aberta' && (itensParaRevisao.length > 0 || !!(observacaoGeralPedido?.trim())) && <p className="text-xs text-red-500 text-center mt-2">A comanda original não está aberta.</p>}
      </div>
    </div>
  );
};
export default RevisarPedidoPage;