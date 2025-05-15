// src/pages/PedidoPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCategorias as fetchCategoriasAPI,
  fetchSubcategorias as fetchSubcategoriasAPI,
  fetchProdutos as fetchProdutosAPI
} from '../services/cardapioService';
import { criarPedido as criarPedidoAPI } from '../services/pedidoService';
import {
  getCategoriasDB, getSubcategoriasDB, getProdutosDB,
  bulkPutCategoriasDB, bulkPutSubcategoriasDB, bulkPutProdutosDB,
  setConfig, getConfig,
  salvarPedidoParaSincronizacaoDB
} from '../services/dbService';
import { v4 as uuidv4 } from 'uuid';
import { Cardapio, Produto, Categoria as TipoCategoria, Subcategoria as TipoSubcategoria } from '../types/cardapio';
import { PedidoItemInput as ItemDoPedidoNoEstadoBase, PedidoOfflinePayload, ItemPedidoOffline } from '../types/pedido';
import { ComandaDetalhada } from '../types/comanda';
import { buscarComandaDetalhadaPorIdAPI } from '../services/comandasService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiArrowLeft, FiPlus, FiMinus, FiTrash2, FiEdit2, FiSend, FiShoppingBag, FiMapPin, FiChevronLeft, FiMessageSquare, FiSearch } from 'react-icons/fi';
import { toast } from 'react-toastify';

interface ItemPedidoState extends ItemDoPedidoNoEstadoBase {
  nome_produto: string;
}
interface BackendPedidoPayload { comandaIdentifier: string; local_pedido: string; observacao_geral: string | null; itens: Array<{ produto_id: number; quantidade: number; preco_unitario_momento: number; observacao_item: string | null; }>;}
interface ComandaBasicaLocationState { id: number; numero: string; cliente_nome: string | null; local_atual: string | null; status: string; total_ja_consumido: number; observacao_geral?: string | null; }

const PedidoPage: React.FC = () => {
  const { comandaId: comandaIdFromUrl } = useParams<{ comandaId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [numeroComandaExibicao, setNumeroComandaExibicao] = useState<string>("Carregando...");
  const [nomeClienteComanda, setNomeClienteComanda] = useState<string | null>(null);
  const [localPedidoInput, setLocalPedidoInput] = useState('');
  const [comandaStatusAtual, setComandaStatusAtual] = useState<string | null>(null);
  const [totalJaConsumidoState, setTotalJaConsumidoState] = useState<number>(0);
  const [idNumericoComandaOriginal, setIdNumericoComandaOriginal] = useState<number | null>(null);
  const [observacaoGeralOriginal, setObservacaoGeralOriginal] = useState<string>('');

  const [cardapio, setCardapio] = useState<Cardapio | null>(null);
  const [itensPedido, setItensPedido] = useState<ItemPedidoState[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<TipoCategoria | null>(null);
  const [subcategoriaSelecionada, setSubcategoriaSelecionada] = useState<TipoSubcategoria | null>(null);
  const [observacaoGeralInput, setObservacaoGeralInput] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  const [isLoadingCardapio, setIsLoadingCardapio] = useState(true);
  const [isLoadingComandaOrigem, setIsLoadingComandaOrigem] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');

  const carregarCardapio = useCallback(async () => { setIsLoadingCardapio(true); try { let cDB = (await getCategoriasDB()) || []; let scDB = (await getSubcategoriasDB()) || []; let pDB = (await getProdutosDB()) || []; const localVazio = cDB.length === 0 || pDB.length === 0; const ultimaSync = await getConfig('lastCardapioSync'); const agora = Date.now(); const DEZ_MIN_MS = 10 * 60 * 1000; if (statusConexao === 'online' && (localVazio || !ultimaSync || (agora - (ultimaSync || 0) > DEZ_MIN_MS))) { const [apiC, apiSC, apiP] = await Promise.all([fetchCategoriasAPI(), fetchSubcategoriasAPI(), fetchProdutosAPI()]); await Promise.all([bulkPutCategoriasDB(apiC), bulkPutSubcategoriasDB(apiSC), bulkPutProdutosDB(apiP)]); await setConfig('lastCardapioSync', Date.now()); setCardapio({ categorias: apiC, subcategorias: apiSC, produtos: apiP }); } else if (!localVazio) { setCardapio({ categorias: cDB, subcategorias: scDB, produtos: pDB }); } else if (statusConexao === 'offline' && localVazio) { toast.error("Offline: Cardápio não carregado.", {toastId: "cardapio-offline-pedido"}); setCardapio(null); } else { toast.error("Não foi possível carregar o cardápio.", {toastId: "cardapio-falha-pedido"}); setCardapio(null); } } catch (e: any) { console.error("Erro ao carregar cardápio:", e); toast.error("Falha crítica ao carregar cardápio."); setCardapio(null); } finally { setIsLoadingCardapio(false); } }, [statusConexao]);
  useEffect(() => { const dadosComandaDoLocation = location.state?.comandaBasica as ComandaBasicaLocationState | undefined; const idNumericoUrl = comandaIdFromUrl ? parseInt(comandaIdFromUrl, 10) : null; const popularDadosComandaBasicos = (dados: ComandaBasicaLocationState | ComandaDetalhada) => { setNumeroComandaExibicao(dados.numero); setNomeClienteComanda(dados.cliente_nome || null); const local = (dados as ComandaDetalhada).localizacao_cliente || dados.local_atual || ''; setLocalPedidoInput(local); setComandaStatusAtual(dados.status); setTotalJaConsumidoState(Number((dados as ComandaDetalhada).total_atual_calculado || (dados as ComandaBasicaLocationState).total_ja_consumido || 0)); setIdNumericoComandaOriginal(dados.id); const obsGeral = (dados as ComandaDetalhada).observacao_geral || (dados as ComandaBasicaLocationState)?.observacao_geral || ''; setObservacaoGeralInput(obsGeral); setObservacaoGeralOriginal(obsGeral); setIsLoadingComandaOrigem(false); }; if (dadosComandaDoLocation && idNumericoUrl && dadosComandaDoLocation.id === idNumericoUrl) { popularDadosComandaBasicos(dadosComandaDoLocation); } else if (idNumericoUrl && !isNaN(idNumericoUrl)) { setIsLoadingComandaOrigem(true); buscarComandaDetalhadaPorIdAPI(idNumericoUrl) .then(comandaCompleta => { if (comandaCompleta) popularDadosComandaBasicos(comandaCompleta); else { toast.error(`Comanda ID ${idNumericoUrl} não encontrada.`); navigate('/comandas'); } }).catch(() => { toast.error("Falha ao carregar dados da comanda."); navigate('/comandas'); }) } else { toast.error("ID da comanda inválido."); navigate('/comandas'); } carregarCardapio(); }, [comandaIdFromUrl, location.state, navigate, carregarCardapio]);
  useEffect(() => { const handleOnline = () => setStatusConexao('online'); const handleOffline = () => setStatusConexao('offline'); window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline); return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }; }, []);
  const subcategoriasDaCategoria = useMemo(() => { if (!cardapio || !cardapio.subcategorias || !categoriaSelecionada) return []; return cardapio.subcategorias.filter(sc => sc.categoria_id === categoriaSelecionada.id); }, [cardapio, categoriaSelecionada]);
  const categoriaTemSubcategorias = subcategoriasDaCategoria.length > 0;
  const produtosFiltrados = useMemo(() => { if (!cardapio || !cardapio.produtos) return []; if (!categoriaSelecionada) return []; const prods = cardapio.produtos.filter(p => { if (p.categoria_id !== categoriaSelecionada.id) return false; if (categoriaTemSubcategorias) { if (!subcategoriaSelecionada || p.subcategoria_id !== subcategoriaSelecionada.id) return false; } return p.ativo; }); if (termoBusca) { const termoLower = termoBusca.toLowerCase(); return prods.filter(p => p.nome.toLowerCase().includes(termoLower) || (p.descricao && p.descricao.toLowerCase().includes(termoLower))); } return prods; }, [cardapio, categoriaSelecionada, subcategoriaSelecionada, termoBusca, categoriaTemSubcategorias]);
  const totalPedidoAtual = useMemo(() => itensPedido.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0), [itensPedido]);
  const mostrarApenasCategorias = !categoriaSelecionada;
  const mostrarApenasSubcategorias = !!(categoriaSelecionada && categoriaTemSubcategorias && !subcategoriaSelecionada);
  const mostrarApenasProdutos = !!(categoriaSelecionada && (!categoriaTemSubcategorias || (categoriaTemSubcategorias && subcategoriaSelecionada)));
  const handleSelectCategoria = (cat: TipoCategoria | null) => { setCategoriaSelecionada(cat); setSubcategoriaSelecionada(null); setTermoBusca(''); };
  const handleSelectSubcategoria = (subcat: TipoSubcategoria | null) => { setSubcategoriaSelecionada(subcat); setTermoBusca(''); };
  const handleVoltarParaCategorias = () => handleSelectCategoria(null);
  
  const adicionarItem = (produto: Produto) => {
    if (!produto.ativo) { toast.warn(`${produto.nome} não está ativo.`); return; }
    const precoNumerico = parseFloat(produto.preco_venda);
    if (isNaN(precoNumerico)) { toast.error(`Preço inválido para ${produto.nome}`); return; }
    
    const observacaoInicial = ""; // Adiciona SEMPRE com observação vazia

    let novosItensPedido = [...itensPedido];
    const itemExistenteIndex = novosItensPedido.findIndex(i => 
        i.produto_id === produto.id && 
        i.observacao === observacaoInicial
    );

    if (itemExistenteIndex > -1) {
        const itemAtualizado = { ...novosItensPedido[itemExistenteIndex], quantidade: novosItensPedido[itemExistenteIndex].quantidade + 1 };
        novosItensPedido[itemExistenteIndex] = itemAtualizado;
    } else {
        novosItensPedido.push({
            produto_id: produto.id,
            nome_produto: produto.nome,
            quantidade: 1,
            preco_unitario: precoNumerico,
            observacao: observacaoInicial 
        });
    }
    setItensPedido(novosItensPedido);
    toast.success(`${produto.nome} adicionado!`, { autoClose: 1000 });
  };

  const editarObservacaoItem = (produto_id_alvo: number, obsAntiga_alvo: string) => {
    const itemParaEditar = itensPedido.find(i => i.produto_id === produto_id_alvo && i.observacao === obsAntiga_alvo);
    if (!itemParaEditar) { toast.error("Item não encontrado para editar observação."); return; }
    const produtoOriginal = cardapio?.produtos.find(p => p.id === produto_id_alvo);
    if (!produtoOriginal) { toast.error("Produto não encontrado no cardápio."); return; }

    const novaObs = prompt(`Observação para ${produtoOriginal.nome}:`, obsAntiga_alvo);
    if (novaObs !== null) {
      const observacaoNovaFormatada = novaObs.trim();
      if (observacaoNovaFormatada === obsAntiga_alvo) { toast.info("Observação não alterada.", { autoClose: 1000 }); return; }
      const itemConflitanteComNovaObs = itensPedido.find(i => i.produto_id === produto_id_alvo && i.observacao === observacaoNovaFormatada);
      let itensAtualizados = [...itensPedido];
      if (itemConflitanteComNovaObs) {
          const quantidadeDoItemEditado = itemParaEditar.quantidade;
          itensAtualizados = itensAtualizados.map(i => (i.produto_id === produto_id_alvo && i.observacao === observacaoNovaFormatada) ? { ...i, quantidade: i.quantidade + quantidadeDoItemEditado } : i)
                                        .filter(i => !(i.produto_id === produto_id_alvo && i.observacao === obsAntiga_alvo));
          toast.info(`Itens de '${produtoOriginal.nome}' agrupados.`, { autoClose: 2000 });
      } else {
          itensAtualizados = itensAtualizados.map(i => (i.produto_id === produto_id_alvo && i.observacao === obsAntiga_alvo) ? { ...i, observacao: observacaoNovaFormatada } : i );
          toast.success("Observação atualizada.", { autoClose: 1000 });
      }
      setItensPedido(itensAtualizados);
    }
  };
  
  const atualizarQuantidade = (produto_id: number, obs: string, q: number) => { if (q <= 0) { removerItem(produto_id, obs); } else { setItensPedido(prev => prev.map(i => i.produto_id === produto_id && i.observacao === obs ? { ...i, quantidade: q } : i)); }};
  const removerItem = (produto_id: number, obs: string) => { setItensPedido(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs))); toast.info("Item removido.",{autoClose:1000}); };
  const limparFormularioPedido = () => { setItensPedido([]); setObservacaoGeralInput(observacaoGeralOriginal); toast.info("Novos itens limpos. Obs. Geral restaurada.", {autoClose:1500}); };

  const handleEnviarPedido = async () => {
    if (!numeroComandaExibicao && !idNumericoComandaOriginal) { toast.error("Identificador da comanda não disponível."); return; }
    if (localPedidoInput.trim() === "" && itensPedido.length > 0) { toast.warn("Informe a localização."); return; }
    const localInputAtual = localPedidoInput.trim(); const obsGeralInputAtual = observacaoGeralInput.trim();
    if (itensPedido.length === 0 && localInputAtual === (location.state?.comandaBasica?.local_atual || '') && obsGeralInputAtual === observacaoGeralOriginal) { toast.info("Nenhuma alteração para enviar."); return; }
    if (comandaStatusAtual?.toLowerCase() !== 'aberta') { toast.error("Esta comanda não está aberta."); return; }
    setIsSubmitting(true);
    const identificadorParaBackend = numeroComandaExibicao || idNumericoComandaOriginal?.toString();
    if (!identificadorParaBackend) { toast.error("Falha ao obter identificador."); setIsSubmitting(false); return; }
    const payload: BackendPedidoPayload = { comandaIdentifier: identificadorParaBackend, local_pedido: localInputAtual, observacao_geral: obsGeralInputAtual || null, itens: itensPedido.map(item => ({ produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario_momento: item.preco_unitario, observacao_item: item.observacao || null, })), };
    try {
      if (statusConexao === 'online') {
        await criarPedidoAPI(payload); toast.success("Pedido enviado com sucesso!"); navigate('/comandas'); 
      } else {
        const pedidoOffline: PedidoOfflinePayload = { id_local: uuidv4(), timestamp: Date.now(), tentativas_sync: 0, nome_cliente_comanda: nomeClienteComanda || `Comanda ${numeroComandaExibicao}`, numero_comanda_exibicao: numeroComandaExibicao || 'Desconhecido', comandaIdentifier: payload.comandaIdentifier, usuario_id_frontend: user?.id || 0, local_pedido: payload.local_pedido, observacao_geral: payload.observacao_geral, itens: payload.itens.map(it => ({ produto_id: it.produto_id, quantidade: it.quantidade, preco_unitario: it.preco_unitario_momento, observacao: it.observacao_item, nome_produto: itensPedido.find(i => i.produto_id === it.produto_id)?.nome_produto || "" })), comanda_id_db: idNumericoComandaOriginal };
        await salvarPedidoParaSincronizacaoDB(pedidoOffline); toast.info("Pedido salvo offline. Será sincronizado."); navigate('/comandas');
      }
    } catch (error: any) {  console.error("Erro ao processar pedido:", error); const backendErrorMessage = error.response?.data?.message || "Falha ao processar pedido."; toast.error(backendErrorMessage); if (statusConexao === 'online' && (error.isAxiosError && !error.response)) { const pedidoOffline: PedidoOfflinePayload = { id_local: uuidv4(), timestamp: Date.now(), tentativas_sync: 0, nome_cliente_comanda: nomeClienteComanda || `Comanda ${numeroComandaExibicao}`, numero_comanda_exibicao: numeroComandaExibicao || 'Desconhecido', comandaIdentifier: payload.comandaIdentifier, usuario_id_frontend: user?.id || 0, local_pedido: payload.local_pedido, observacao_geral: payload.observacao_geral, itens: payload.itens.map(it => ({ produto_id: it.produto_id, quantidade: it.quantidade, preco_unitario: it.preco_unitario_momento, observacao: it.observacao_item, nome_produto: itensPedido.find(i => i.produto_id === it.produto_id)?.nome_produto || "" })), comanda_id_db: idNumericoComandaOriginal }; try { await salvarPedidoParaSincronizacaoDB(pedidoOffline); toast.info("Falha envio. Salvo offline."); navigate('/comandas'); } catch (dbError) { toast.error("Erro crítico: Falha ao enviar e salvar offline."); } } } 
    finally { setIsSubmitting(false); }
  };

  if (isLoadingCardapio || isLoadingComandaOrigem) { return <LoadingSpinner message={isLoadingCardapio && isLoadingComandaOrigem ? "Carregando dados..." : isLoadingCardapio ? "Carregando cardápio..." : "Carregando comanda..."} />; }
  if (!cardapio && !isLoadingCardapio && statusConexao === 'online') { return ( <div className="p-4 text-center"> <p className="text-red-500">Falha cardápio.</p> <button onClick={carregarCardapio} className="mt-2 px-3 py-1 bg-blue-500 text-white rounded">Tentar</button> </div> ); }
  if (!idNumericoComandaOriginal && !isLoadingComandaOrigem) { return <div className="p-4 text-center">Dados da comanda indisponíveis.</div>;}

  console.log("[PedidoPage] Estados de exibição para render:", { mostrarApenasCategorias, mostrarApenasSubcategorias, mostrarApenasProdutos, catSel: categoriaSelecionada?.nome, subcatSel: subcategoriaSelecionada?.nome, cardapioCarregado: !!cardapio });

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      {/* Coluna Esquerda: Cardápio */}
      <div className="w-full md:w-3/5 p-4 border-r border-gray-200 flex flex-col overflow-hidden">
        <div className='flex-shrink-0 flex justify-between items-center mb-4'>
          {subcategoriaSelecionada ? ( <button onClick={() => handleSelectSubcategoria(null)} className="text-blue-600 hover:text-blue-800 flex items-center text-sm"> <FiChevronLeft className="mr-1" /> Voltar para {categoriaSelecionada?.nome || 'Subcategorias'} </button> ) : categoriaSelecionada ? ( <button onClick={handleVoltarParaCategorias} className="text-blue-600 hover:text-blue-800 flex items-center text-sm"> <FiChevronLeft className="mr-1" /> Voltar para Categorias </button> ) : ( <button onClick={() => navigate('/comandas')} className="text-blue-600 hover:text-blue-800 flex items-center text-sm"> <FiArrowLeft className="mr-1" /> Comandas </button> )}
          <h2 className="text-lg font-semibold text-gray-700 text-right truncate"> {subcategoriaSelecionada?.nome || categoriaSelecionada?.nome || 'Cardápio'} </h2>
        </div>
        {statusConexao === 'offline' && ( <div className="mb-2 p-2 bg-yellow-100 text-yellow-700 text-xs rounded text-center flex-shrink-0"> Cardápio pode estar desatualizado. </div> )}
        <div className="mb-4 flex-shrink-0">
          {mostrarApenasCategorias && ( <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"> {cardapio && cardapio.categorias.map((cat) => ( <button key={cat.id} onClick={() => handleSelectCategoria(cat)} className="p-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-blue-500 hover:text-white rounded-lg shadow transition-colors duration-150 flex flex-col items-center justify-center h-24 min-h-[6rem]"> <span>{cat.nome}</span> </button> ))} </div> )}
          {mostrarApenasSubcategorias && ( <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"> {subcategoriasDaCategoria.map((subcat) => ( <button key={subcat.id} onClick={() => handleSelectSubcategoria(subcat)} className="p-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-indigo-500 hover:text-white rounded-lg shadow transition-colors duration-150 flex flex-col items-center justify-center h-24 min-h-[6rem]"> <span>{subcat.nome}</span> </button> ))} </div> )}
          {mostrarApenasProdutos && cardapio && ( <div className="relative mb-2"> <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiSearch className="h-4 w-4 text-gray-400" /></div> <input type="text" placeholder={`Buscar em ${subcategoriaSelecionada?.nome || categoriaSelecionada?.nome || 'produtos'}...`} value={termoBusca} onChange={e => setTermoBusca(e.target.value)} className="w-full p-2 pl-10 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"/> </div> )}
        </div>
        <div className="flex-grow overflow-y-auto -mx-4 px-4 custom-scrollbar">
            {mostrarApenasProdutos && cardapio && ( produtosFiltrados.length === 0 ? ( <p className="text-gray-500 text-center mt-8 italic"> {termoBusca ? `Nenhum produto para "${termoBusca}".` : "Nenhum produto nesta seleção."} </p> ) : ( <ul className="space-y-2 pb-4"> {produtosFiltrados.map(p => ( <li key={p.id} className={`border rounded-lg p-3 shadow-sm hover:shadow-md bg-white flex items-center justify-between transition-shadow duration-150 ${!p.ativo ? 'opacity-60 bg-gray-50' : ''}`}> <div className="flex-1 mr-3"> <h3 className="font-semibold text-sm text-gray-800">{p.nome}</h3>{p.descricao && <p className="text-xs text-gray-500 mt-0.5">{p.descricao}</p>} {!p.ativo && <p className="text-xs text-red-500 italic mt-1">Indisponível</p>} </div> <div className="flex flex-col items-end flex-shrink-0"> <span className="font-bold text-blue-600 text-sm mb-1">R$ {parseFloat(p.preco_venda).toFixed(2).replace('.', ',')}</span> <button onClick={() => adicionarItem(p)} className={`bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1 text-xs font-medium flex items-center ${!p.ativo ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' : ''}`} disabled={!p.ativo}> <FiPlus size={14} className="mr-1"/> Adicionar </button> </div> </li> ))} </ul> ) )}
            {!cardapio && !isLoadingCardapio && statusConexao === 'offline' && ( <p className="text-center text-orange-600 mt-8">Cardápio não disponível offline. Conecte-se.</p> )}
        </div>
      </div>

      {/* Coluna Direita: Resumo do Pedido */}
      <div className="w-full md:w-2/5 p-4 overflow-y-auto bg-gray-50 flex flex-col">
        <div className='flex-shrink-0'>
            <h2 className="text-xl font-semibold mb-1 flex items-center"> <FiShoppingBag className="mr-2"/> Comanda: {numeroComandaExibicao} </h2>
            {nomeClienteComanda && <p className="text-sm text-gray-600 mb-3">Cliente: {nomeClienteComanda}</p>}
            {comandaStatusAtual && <p className={`text-xs font-medium mb-3 px-2 py-0.5 rounded-full ${comandaStatusAtual.toLowerCase() === 'aberta' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Status: {comandaStatusAtual.toUpperCase()}</p>}
            <div className="mb-4"><label htmlFor="localPedido" className="block text-sm font-medium"><FiMapPin className="inline mr-1"/>Localização <span className="text-red-500">*</span></label><input type="text" id="localPedido" value={localPedidoInput} onChange={e => setLocalPedidoInput(e.target.value)} className="w-full p-2 border rounded text-sm" placeholder="Ex: Mesa 5" required /></div>
            <div className="mb-4"><label htmlFor="observacaoGeral" className="block text-sm font-medium"><FiMessageSquare className="inline mr-1"/>Obs. Geral</label><textarea id="observacaoGeral" value={observacaoGeralInput} onChange={e => setObservacaoGeralInput(e.target.value)} rows={2} className="w-full p-2 border rounded text-sm" placeholder="Ex: Alergias..." /></div>
        </div>
        
        <div className="flex-grow overflow-y-auto mb-4 border-t pt-3 custom-scrollbar">
            <p className="font-semibold mb-2">Adicionar Novos Itens:</p>
            {(!Array.isArray(itensPedido) || itensPedido.length === 0) ? ( <p className="text-gray-500 text-center mt-6 text-sm italic">Nenhum novo item adicionado.</p> )
            : ( 
              <div className="space-y-3">
                {itensPedido.map(item => (
                  <div key={`${item.produto_id}-${item.observacao}`} className="bg-white rounded-lg shadow border p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-grow mr-2">
                        <p className="font-semibold text-gray-800 text-sm leading-tight">{item.nome_produto}</p>
                        <p className="text-xs text-gray-500">
                          {/* Quantidade aqui é do item específico na lista de novos itens */}
                        </p>
                      </div>
                      <p className="font-semibold text-blue-600 text-sm whitespace-nowrap">
                        R$ {(item.quantidade * item.preco_unitario).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    {item.observacao && (
                      <p className="text-xs text-indigo-700 bg-indigo-50 p-1.5 rounded my-1.5 italic">
                        Obs: {item.observacao}
                      </p>
                    )}
                    <div className="flex items-center justify-end space-x-2 mt-2 border-t pt-2">
                      <button onClick={() => editarObservacaoItem(item.produto_id, item.observacao || '')} className="p-1.5 text-blue-600 hover:text-blue-800 transition-colors" title="Editar Observação"> <FiEdit2 size={18} /> </button>
                      <div className="flex items-center space-x-1 bg-gray-100 rounded-full p-0.5">
                        <button onClick={() => atualizarQuantidade(item.produto_id, item.observacao || '', item.quantidade - 1)} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors" title="Diminuir"> <FiMinus size={16} /> </button>
                        <span className="font-bold text-sm text-gray-800 w-8 text-center tabular-nums px-1"> {item.quantidade} </span>
                        <button onClick={() => atualizarQuantidade(item.produto_id, item.observacao || '', item.quantidade + 1)} className="text-green-600 hover:text-green-800 p-1 rounded-full hover:bg-green-100 transition-colors" title="Aumentar"> <FiPlus size={16} /> </button>
                      </div>
                      <button onClick={() => removerItem(item.produto_id, item.observacao || '')} className="p-1.5 text-red-600 hover:text-red-800 transition-colors" title="Remover Item"> <FiTrash2 size={18} /> </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
        <div className="flex-shrink-0 pt-4">
            {(itensPedido.length > 0 || localPedidoInput.trim() !== (location.state?.comandaBasica?.local_atual || '') || observacaoGeralInput.trim() !== observacaoGeralOriginal ) && ( <> {itensPedido.length > 0 && ( <div className="text-lg font-bold text-right mb-2"> Subtotal Novos Itens: R$ {totalPedidoAtual.toFixed(2).replace('.', ',')} </div> )} <div className="text-xl font-extrabold text-right mb-4 text-blue-700"> Total Geral Previsto: R$ {(totalJaConsumidoState + totalPedidoAtual).toFixed(2).replace('.', ',')} </div> <button onClick={handleEnviarPedido} disabled={isSubmitting || comandaStatusAtual?.toLowerCase() !== 'aberta'} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md shadow-sm flex items-center justify-center disabled:opacity-50"> <FiSend className="mr-2"/>{isSubmitting ? 'Processando...' : (itensPedido.length > 0 ? 'Adicionar e Enviar' : 'Atualizar Comanda')} </button> {comandaStatusAtual?.toLowerCase() !== 'aberta' && <p className="text-xs text-red-500 text-center mt-2">Comanda não está aberta.</p>} </> )}
        </div>
      </div>
    </div>
  );
};
export default PedidoPage;