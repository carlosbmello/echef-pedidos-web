import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  fetchCategorias as fetchCategoriasAPI,
  fetchSubcategorias as fetchSubcategoriasAPI,
  fetchProdutos as fetchProdutosAPI
} from '../services/cardapioService';
import {
  getCategoriasDB, getSubcategoriasDB, getProdutosDB,
  bulkPutCategoriasDB, bulkPutSubcategoriasDB, bulkPutProdutosDB,
  setConfig, getConfig
} from '../services/dbService';
import { Cardapio, Produto, Categoria as TipoCategoria, Subcategoria as TipoSubcategoria } from '../types/cardapio';
import { PedidoItemInput as ItemDoPedidoNoEstadoBase } from '../types/pedido';
import { ComandaDetalhada } from '../types/comanda';
import { buscarComandaDetalhadaPorIdAPI } from '../services/comandasService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiArrowLeft, FiPlus, FiMinus, FiTrash2, FiEdit2, FiShoppingBag, FiChevronLeft, FiMessageSquare, FiSearch, FiClipboard, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-toastify';

interface ItemPedidoState extends ItemDoPedidoNoEstadoBase {
  nome_produto: string;
}

const PedidoPage: React.FC = () => {
  const { comandaId: comandaIdFromUrl } = useParams<{ comandaId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [numeroComandaExibicao, setNumeroComandaExibicao] = useState<string>("Carregando...");
  const [nomeClienteComanda, setNomeClienteComanda] = useState<string | null>(null);
  const [comandaStatusAtual, setComandaStatusAtual] = useState<string | null>(null);
  const [totalJaConsumidoState, setTotalJaConsumidoState] = useState<number>(0);
  const [idNumericoDaComanda, setIdNumericoDaComanda] = useState<number | null>(null);
  const [localEntregaCliente, setLocalEntregaCliente] = useState<string | null>(null);
  const [observacaoGeralOriginalDaComanda, setObservacaoGeralOriginalDaComanda] = useState<string>('');
  
  const [cardapio, setCardapio] = useState<Cardapio | null>(null);
  const [itensPedido, setItensPedido] = useState<ItemPedidoState[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<TipoCategoria | null>(null);
  const [subcategoriaSelecionada, setSubcategoriaSelecionada] = useState<TipoSubcategoria | null>(null);
  const [observacaoGeralInput, setObservacaoGeralInput] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  const [isLoadingCardapio, setIsLoadingCardapio] = useState(true);
  const [isLoadingComanda, setIsLoadingComanda] = useState(true);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');

  const carregarCardapio = useCallback(async () => {
    setIsLoadingCardapio(true);
    try {
      let cDB = (await getCategoriasDB()) || [];
      let scDB = (await getSubcategoriasDB()) || [];
      let pDB = (await getProdutosDB()) || [];
      const localVazio = cDB.length === 0 || pDB.length === 0;
      const ultimaSync = await getConfig('lastCardapioSync');
      const agora = Date.now();
      const DEZ_MIN_MS = 10 * 60 * 1000;

      if (statusConexao === 'online' && (localVazio || !ultimaSync || (agora - (ultimaSync || 0) > DEZ_MIN_MS))) {
        toast.info("Sincronizando cardápio...", { autoClose: 1000, toastId: "sync-cardapio" });
        const [apiC, apiSC, apiP] = await Promise.all([fetchCategoriasAPI(), fetchSubcategoriasAPI(), fetchProdutosAPI()]);
        await Promise.all([bulkPutCategoriasDB(apiC), bulkPutSubcategoriasDB(apiSC), bulkPutProdutosDB(apiP)]);
        await setConfig('lastCardapioSync', Date.now());
        setCardapio({ categorias: apiC, subcategorias: apiSC, produtos: apiP });
        toast.success("Cardápio sincronizado!", { autoClose: 1000, toastId: "sync-cardapio-ok" });
      } else if (!localVazio) {
        setCardapio({ categorias: cDB, subcategorias: scDB, produtos: pDB });
      } else if (statusConexao === 'offline' && localVazio) {
        toast.error("Offline: Cardápio não disponível no cache local.", { toastId: "cardapio-offline-pedido" });
        setCardapio(null);
      } else {
        toast.error("Não foi possível carregar o cardápio. Verifique sua conexão.", { toastId: "cardapio-falha-pedido" });
        setCardapio(null);
      }
    } catch (e: any) {
      console.error("Erro ao carregar cardápio:", e);
      toast.error("Falha crítica ao carregar cardápio.");
      setCardapio(null);
    } finally {
      setIsLoadingCardapio(false);
    }
  }, [statusConexao]);

  useEffect(() => {
    const dadosComandaDoLocation = location.state?.comandaDetalhes as ComandaDetalhada | undefined;
    const localVindoDaComanda = location.state?.localEntregaCliente as string | null | undefined;
    const itensRetornandoDaRevisao = location.state?.itensPedidoRetornandoDaRevisao as ItemPedidoState[] | undefined;
    const obsGeralRetornandoDaRevisao = location.state?.observacaoGeralRetornandoDaRevisao as string | undefined;
    const idNumericoUrl = comandaIdFromUrl ? parseInt(comandaIdFromUrl, 10) : null;

    if (!localVindoDaComanda || localVindoDaComanda.trim() === "") {
        toast.error("Local para entrega do pedido não foi informado. Retornando para busca.");
        navigate('/comandas', { replace: true });
        return;
    }
    setLocalEntregaCliente(localVindoDaComanda);

    const popularDadosComanda = (dados: ComandaDetalhada) => {
      setNumeroComandaExibicao(dados.numero);
      setNomeClienteComanda(dados.cliente_nome || null);
      setObservacaoGeralInput(obsGeralRetornandoDaRevisao !== undefined ? obsGeralRetornandoDaRevisao : (dados.observacao_geral || ''));
      setObservacaoGeralOriginalDaComanda(dados.observacao_geral || '');
      setComandaStatusAtual(dados.status);
      const totalConsumidoOriginal = (typeof dados.total_atual_calculado === 'string') ? parseFloat(dados.total_atual_calculado) : dados.total_atual_calculado;
      setTotalJaConsumidoState(Number(totalConsumidoOriginal) || 0);
      setIdNumericoDaComanda(dados.id);
      setIsLoadingComanda(false);
    };

    if (itensRetornandoDaRevisao) {
        setItensPedido(itensRetornandoDaRevisao);
        if (dadosComandaDoLocation && idNumericoUrl && dadosComandaDoLocation.id === idNumericoUrl) {
            popularDadosComanda(dadosComandaDoLocation);
        } else if (idNumericoUrl && !isNaN(idNumericoUrl)) {
             setIsLoadingComanda(true);
             buscarComandaDetalhadaPorIdAPI(idNumericoUrl).then(cd => {
                 if(cd) popularDadosComanda(cd); else {toast.error("Erro ao recarregar dados da comanda."); navigate('/comandas');}
             }).catch(()=> {toast.error("Falha ao buscar comanda para retorno da revisão."); navigate('/comandas');}).finally(()=> setIsLoadingComanda(false));
        }
    } else if (dadosComandaDoLocation && idNumericoUrl && dadosComandaDoLocation.id === idNumericoUrl) {
      popularDadosComanda(dadosComandaDoLocation);
    } else if (idNumericoUrl && !isNaN(idNumericoUrl)) {
      setIsLoadingComanda(true);
      buscarComandaDetalhadaPorIdAPI(idNumericoUrl)
        .then(comandaCompleta => {
          if (comandaCompleta) { popularDadosComanda(comandaCompleta); }
          else { toast.error(`Comanda ID ${idNumericoUrl} não encontrada.`); navigate('/comandas', {replace: true}); }
        })
        .catch(() => { toast.error("Falha ao carregar dados da comanda."); navigate('/comandas', {replace: true}); })
        .finally(() => setIsLoadingComanda(false));
    } else { 
      toast.error("ID da comanda inválido.");
      navigate('/comandas', {replace: true}); 
    }

    carregarCardapio();
  }, [comandaIdFromUrl, location.state, navigate, carregarCardapio]);

  useEffect(() => { const handleOnline = () => setStatusConexao('online'); const handleOffline = () => setStatusConexao('offline'); window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline); return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }; }, []);

  const subcategoriasDaCategoria = useMemo(() => { if (!cardapio || !cardapio.subcategorias || !Array.isArray(cardapio.subcategorias) || !categoriaSelecionada) return []; return cardapio.subcategorias.filter(sc => sc.categoria_id === categoriaSelecionada.id); }, [cardapio, categoriaSelecionada]);
  const categoriaTemSubcategorias = subcategoriasDaCategoria.length > 0;
  
  const produtosFiltrados = useMemo(() => {
      if (!cardapio || !cardapio.produtos || !Array.isArray(cardapio.produtos) || !categoriaSelecionada) return [];
      const prods = cardapio.produtos.filter(p => {
          if (p.categoria_id !== categoriaSelecionada.id) return false;
          if (categoriaTemSubcategorias) {
              if (!subcategoriaSelecionada || p.subcategoria_id !== subcategoriaSelecionada.id) return false;
          }
          return p.ativo;
      });
      if (termoBusca) {
          const termoLower = termoBusca.toLowerCase();
          return prods.filter(p => p.nome.toLowerCase().includes(termoLower) || (p.descricao && p.descricao.toLowerCase().includes(termoLower)));
      }
      return prods;
  }, [cardapio, categoriaSelecionada, subcategoriaSelecionada, termoBusca, categoriaTemSubcategorias]);

  const mostrarApenasCategorias = !categoriaSelecionada;
  const mostrarApenasSubcategorias = !!(categoriaSelecionada && categoriaTemSubcategorias && !subcategoriaSelecionada);
  const mostrarApenasProdutos = !!(categoriaSelecionada && (!categoriaTemSubcategorias || (categoriaTemSubcategorias && subcategoriaSelecionada)));

  const handleSelectCategoria = (cat: TipoCategoria | null) => { setCategoriaSelecionada(cat); setSubcategoriaSelecionada(null); setTermoBusca(''); };
  const handleSelectSubcategoria = (subcat: TipoSubcategoria | null) => { setSubcategoriaSelecionada(subcat); setTermoBusca(''); };
  const handleVoltarParaCategorias = () => handleSelectCategoria(null);

  const adicionarItem = (produto: Produto) => { if (!produto.ativo) { toast.warn(`${produto.nome} não está ativo.`); return; } const precoNumerico = parseFloat(produto.preco_venda as any); if (isNaN(precoNumerico)) { toast.error(`Preço inválido para ${produto.nome}`); return; } const adicionarItemComObs = (obs: string | null) => { const observacaoFinal = obs !== null ? obs.trim() : ""; const itemExistente = itensPedido.find(i => i.produto_id === produto.id && i.observacao === observacaoFinal); if (itemExistente) { setItensPedido(itensPedido.map(i => i.produto_id === produto.id && i.observacao === observacaoFinal ? { ...i, quantidade: i.quantidade + 1 } : i)); } else { setItensPedido([...itensPedido, { produto_id: produto.id, nome_produto: produto.nome, quantidade: 1, preco_unitario: precoNumerico, observacao: observacaoFinal }]); } toast.success(`${produto.nome} adicionado!`, { autoClose: 1000 }); }; if (produto.permite_observacao) { const obs = prompt(`Observação para ${produto.nome}:`, ""); if(obs === null) return; adicionarItemComObs(obs); } else { adicionarItemComObs(""); } };
  const atualizarQuantidade = (produto_id: number, obs: string, q: number) => { if (q <= 0) { removerItem(produto_id, obs); } else { setItensPedido(prev => prev.map(i => i.produto_id === produto_id && i.observacao === obs ? { ...i, quantidade: q } : i)); }};
  const removerItem = (produto_id: number, obs: string) => { setItensPedido(prev => prev.filter(i => !(i.produto_id === produto_id && i.observacao === obs))); toast.info("Item removido.",{autoClose:1000}); };
  const editarObservacaoItem = (produto_id_alvo: number, obsAntiga_alvo: string) => { const itemParaEditar = itensPedido.find(i => i.produto_id === produto_id_alvo && i.observacao === obsAntiga_alvo); if (!itemParaEditar) { toast.error("Item não encontrado para editar."); return; } const produtoOriginal = cardapio?.produtos.find(p => p.id === produto_id_alvo); if (!produtoOriginal) { toast.error("Produto original não encontrado no cardápio."); return; } const novaObs = prompt(`Observação para ${produtoOriginal.nome}:`, obsAntiga_alvo); if (novaObs !== null) { const obsNovaFmt = novaObs.trim(); if (obsNovaFmt === obsAntiga_alvo) { toast.info("Observação não alterada."); return; } const itemConflitante = itensPedido.find(i => i.produto_id === produto_id_alvo && i.observacao === obsNovaFmt && i !== itemParaEditar); let itensAtualizados = [...itensPedido]; if (itemConflitante) { const qtdDoEditado = itemParaEditar.quantidade; itensAtualizados = itensAtualizados.map(i => (i.produto_id === produto_id_alvo && i.observacao === obsNovaFmt) ? { ...i, quantidade: i.quantidade + qtdDoEditado } : i).filter(i => i !== itemParaEditar); toast.info("Itens com mesma observação agrupados."); } else { itensAtualizados = itensAtualizados.map(i => (i === itemParaEditar) ? { ...i, observacao: obsNovaFmt } : i ); toast.success("Observação do item atualizada."); } setItensPedido(itensAtualizados); } };

  const handleProsseguirParaRevisao = () => {
    const obsGeralAtualTrimmed = typeof observacaoGeralInput === 'string' ? observacaoGeralInput.trim() : "";
    if (itensPedido.length === 0 && !obsGeralAtualTrimmed) { toast.info("Adicione itens ou uma observação geral ao pedido."); return; }
    if (comandaStatusAtual?.toLowerCase() !== 'aberta') { toast.error(`A comanda ${numeroComandaExibicao} não está aberta. Status: ${comandaStatusAtual}`); return; }
    if (!localEntregaCliente || localEntregaCliente.trim() === "") {
        toast.error("Erro crítico: Local para entrega do pedido não definido. Por favor, volte e tente novamente.");
        return;
    }

    const dadosComandaOriginalParaRevisao = {
        id: idNumericoDaComanda,
        numero: numeroComandaExibicao,
        cliente_nome: nomeClienteComanda,
        status: comandaStatusAtual,
        total_ja_consumido: totalJaConsumidoState,
        local_atual: (location.state?.comandaDetalhes as ComandaDetalhada)?.local_atual || null,
        observacao_geral: observacaoGeralOriginalDaComanda
    };

    const estadoParaRevisao = {
        comandaOriginal: dadosComandaOriginalParaRevisao,
        novosItens: itensPedido,
        observacaoGeralPedidoAtual: obsGeralAtualTrimmed || null,
        localEntregaCliente: localEntregaCliente // Passando o dado com o nome correto
    };

    navigate(
      `/comandas/${idNumericoDaComanda}/revisar-pedido`,
      { state: estadoParaRevisao }
    );
  };

   if (isLoadingCardapio || isLoadingComanda) { return <LoadingSpinner message={isLoadingCardapio ? "Carregando cardápio..." : "Carregando dados da comanda..."} />; }
   if (!cardapio && !isLoadingCardapio) { return ( <div className="p-4 text-center"> <p className="text-red-500">Falha ao carregar cardápio. {statusConexao === 'offline' && "Você está offline."}</p> <button onClick={carregarCardapio} className="mt-2 px-3 py-1 bg-blue-500 text-white rounded">Tentar Novamente</button> </div> ); }
   if (!idNumericoDaComanda && !isLoadingComanda) { return <div className="p-4 text-center text-red-500">Dados da comanda não puderam ser carregados.</div>;}
   if (!localEntregaCliente && !isLoadingComanda) { return <div className="p-4 text-center text-red-500">Local para entrega não foi definido. Volte e informe na busca.</div>;}

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      <div className="w-full md:w-3/5 p-4 border-r border-gray-200 flex flex-col overflow-hidden">
        <div className='flex-shrink-0 flex justify-between items-center mb-4'>
          {subcategoriaSelecionada ? ( <button onClick={() => handleSelectSubcategoria(null)} className="text-blue-600 hover:text-blue-800 flex items-center text-sm"> <FiChevronLeft className="mr-1" /> Voltar para {categoriaSelecionada?.nome || 'Subcategorias'} </button> ) : categoriaSelecionada ? ( <button onClick={handleVoltarParaCategorias} className="text-blue-600 hover:text-blue-800 flex items-center text-sm"> <FiChevronLeft className="mr-1" /> Voltar para Categorias </button> ) : ( <button onClick={() => navigate('/comandas')} className="text-blue-600 hover:text-blue-800 flex items-center text-sm"> <FiArrowLeft className="mr-1" /> Voltar para Busca de Comandas </button> )}
          <h2 className="text-lg font-semibold text-gray-700 text-right truncate"> {subcategoriaSelecionada?.nome || categoriaSelecionada?.nome || 'Cardápio'} </h2>
        </div>
        {statusConexao === 'offline' && ( <div className="mb-2 p-2 bg-yellow-100 text-yellow-700 text-xs rounded text-center flex-shrink-0"> Cardápio pode estar desatualizado (cache local). </div> )}
        <div className="mb-4 flex-shrink-0">
          {mostrarApenasCategorias && cardapio && cardapio.categorias && ( <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"> {cardapio.categorias.map((cat) => ( <button key={cat.id} onClick={() => handleSelectCategoria(cat)} className="p-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-blue-500 hover:text-white rounded-lg shadow transition-colors duration-150 flex flex-col items-center justify-center h-24 min-h-[6rem]"> <span>{cat.nome}</span> </button> ))} </div> )}
          {mostrarApenasSubcategorias && subcategoriasDaCategoria && ( <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"> {subcategoriasDaCategoria.map((subcat) => ( <button key={subcat.id} onClick={() => handleSelectSubcategoria(subcat)} className="p-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-indigo-500 hover:text-white rounded-lg shadow transition-colors duration-150 flex flex-col items-center justify-center h-24 min-h-[6rem]"> <span>{subcat.nome}</span> </button> ))} </div> )}
          {mostrarApenasProdutos && ( <div className="relative mb-2"> <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiSearch className="h-4 w-4 text-gray-400" /></div> <input type="text" placeholder={`Buscar em ${subcategoriaSelecionada?.nome || categoriaSelecionada?.nome || 'produtos'}...`} value={termoBusca} onChange={e => setTermoBusca(e.target.value)} className="w-full p-2 pl-10 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"/> </div> )}
        </div>
        <div className="flex-grow overflow-y-auto -mx-4 px-4 custom-scrollbar">
            {mostrarApenasProdutos && cardapio && ( produtosFiltrados.length === 0 ? ( <p className="text-gray-500 text-center mt-8 italic"> {termoBusca ? `Nenhum produto encontrado para "${termoBusca}".` : "Nenhum produto nesta seleção."} </p> ) : ( <ul className="space-y-2 pb-4"> {produtosFiltrados.map(p => ( <li key={p.id} className={`border rounded-lg p-2 shadow-sm hover:shadow-md bg-white flex items-center justify-between ${!p.ativo ? 'opacity-60 bg-gray-50' : ''}`}> <div className="flex-1 mr-2 overflow-hidden"> <h3 className="font-semibold text-sm text-gray-800 truncate">{p.nome}</h3> {p.descricao && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.descricao}</p>} {!p.ativo && <p className="text-xs text-red-500 italic mt-1">Indisponível</p>} </div> <div className="flex flex-col items-end flex-shrink-0 ml-2"> <span className="font-bold text-blue-600 text-xs mb-1">R$ {parseFloat(p.preco_venda as string).toFixed(2).replace('.', ',')}</span> <button onClick={() => adicionarItem(p)} className={`bg-green-500 hover:bg-green-600 text-white rounded px-2 py-1 text-xs font-medium flex items-center ${!p.ativo ? 'bg-gray-400 cursor-not-allowed' : ''}`} disabled={!p.ativo}> <FiPlus size={12} className="mr-0.5"/> Add </button> </div> </li> ))} </ul> ) )}
        </div>
      </div>

      <div className="w-full md:w-2/5 p-4 overflow-y-auto bg-gray-50 flex flex-col">
         <div className='flex-shrink-0'>
            <h2 className="text-xl font-semibold mb-1 flex items-center"> <FiShoppingBag className="mr-2"/> Comanda: {numeroComandaExibicao} </h2>
            {nomeClienteComanda && <p className="text-sm text-gray-600">Cliente: {nomeClienteComanda}</p>}
            {localEntregaCliente && <p className="text-sm text-gray-600 mb-1 flex items-center"><FiMapPin className="mr-1 text-gray-500"/>Local p/ Entrega: <span className='font-medium ml-1'>{localEntregaCliente}</span></p>}
            {comandaStatusAtual && <p className={`text-xs font-medium mb-3 inline-block px-2 py-0.5 rounded-full ${comandaStatusAtual.toLowerCase() === 'aberta' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Status Comanda: {comandaStatusAtual.toUpperCase()}</p>}
            <div className="my-4"><label htmlFor="observacaoGeral" className="block text-sm font-medium"><FiMessageSquare className="inline mr-1"/>Observação Geral (Pedido Atual)</label><textarea id="observacaoGeral" value={observacaoGeralInput} onChange={e => setObservacaoGeralInput(e.target.value)} rows={2} className="w-full p-2 border rounded text-sm shadow-sm" placeholder="Ex: Sem cebola, alergia a camarão..." /></div>
        </div>
        <div className="flex-grow overflow-y-auto mb-4 border-t pt-3 custom-scrollbar">
            <p className="font-semibold mb-2">Novos Itens Adicionados:</p>
            {(!Array.isArray(itensPedido) || itensPedido.length === 0) ? ( <p className="text-gray-500 text-center mt-6 text-sm italic">Nenhum novo item adicionado.</p> )
            : ( <div className="space-y-3"> {itensPedido.map(item => ( <div key={`${item.produto_id}-${item.observacao}`} className="bg-white rounded-lg shadow border p-3"> <div className="flex justify-between items-start mb-1"> <div className="flex-grow mr-2"> <p className="font-semibold text-gray-800 text-sm leading-tight">{item.nome_produto}</p> <p className="text-xs text-gray-500"> R$ {(item.preco_unitario).toFixed(2).replace('.', ',')} / un. </p> </div> <p className="font-semibold text-blue-600 text-sm whitespace-nowrap"> R$ {(item.quantidade * item.preco_unitario).toFixed(2).replace('.', ',')} </p> </div> {item.observacao && ( <p className="text-xs text-indigo-700 bg-indigo-50 p-1.5 rounded my-1.5 italic"> Obs: {item.observacao} </p> )} <div className="flex items-center justify-end space-x-2 mt-2 border-t pt-2"> <button onClick={() => editarObservacaoItem(item.produto_id, item.observacao || '')} className="p-1.5 text-blue-600 hover:text-blue-800 transition-colors" title="Editar Observação"> <FiEdit2 size={18} /> </button> <div className="flex items-center space-x-1 bg-gray-100 rounded-full p-0.5"> <button onClick={() => atualizarQuantidade(item.produto_id, item.observacao || '', item.quantidade - 1)} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors" title="Diminuir"> <FiMinus size={16} /> </button> <span className="font-bold text-sm text-gray-800 w-8 text-center tabular-nums px-1"> {item.quantidade} </span> <button onClick={() => atualizarQuantidade(item.produto_id, item.observacao || '', item.quantidade + 1)} className="text-green-600 hover:text-green-800 p-1 rounded-full hover:bg-green-100 transition-colors" title="Aumentar"> <FiPlus size={16} /> </button> </div> <button onClick={() => removerItem(item.produto_id, item.observacao || '')} className="p-1.5 text-red-600 hover:text-red-800 transition-colors" title="Remover Item"> <FiTrash2 size={18} /> </button> </div> </div> ))} </div> )}
        </div>
        <div className="flex-shrink-0 pt-4 border-t">
            {(itensPedido.length > 0 || observacaoGeralInput.trim() !== observacaoGeralOriginalDaComanda ) && (
              <button onClick={handleProsseguirParaRevisao} disabled={comandaStatusAtual?.toLowerCase() !== 'aberta'} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                <FiClipboard className="mr-2"/> Revisar Pedido ({itensPedido.length} novo(s))
              </button>
            )}
            {comandaStatusAtual?.toLowerCase() !== 'aberta' && (itensPedido.length > 0 || observacaoGeralInput.trim() !== observacaoGeralOriginalDaComanda) && <p className="text-xs text-red-500 text-center mt-2">A comanda não está aberta para novos pedidos.</p>}
        </div>
      </div>
    </div>
  );
};
export default PedidoPage;