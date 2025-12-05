import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// --- Imports de Serviços ---
import {
  fetchCategorias as fetchCategoriasAPI,
  fetchSubcategorias as fetchSubcategoriasAPI,
  fetchProdutos as fetchProdutosAPI,
  fetchGruposDeOpcoes as fetchGruposDeOpcoesAPI
} from '../services/cardapioService';
import {
  getCategoriasDB, getSubcategoriasDB, getProdutosDB,
  bulkPutCategoriasDB, bulkPutSubcategoriasDB, bulkPutProdutosDB,
  setConfig, getConfig,
  getGruposDeOpcoesDB, bulkPutGruposDeOpcoesDB
} from '../services/dbService';
import { buscarComandaDetalhadaPorIdAPI } from '../services/comandasService';

// --- Imports de Tipos ---
import { Cardapio, Produto, Categoria as TipoCategoria, Subcategoria as TipoSubcategoria, GrupoOpcoes, OpcaoItem } from '../types/cardapio';
import { PedidoItemInput as ItemDoPedidoNoEstadoBase } from '../types/pedido';
import { ComandaDetalhada } from '../types/comanda';

// --- Imports de Componentes e UI ---
import LoadingSpinner from '../components/common/LoadingSpinner';
import OpcoesProdutoModal from '../components/common/OpcoesProdutoModal';
import { FiArrowLeft, FiPlus, FiChevronLeft, FiSearch, FiClipboard, FiXCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';


interface ItemPedidoState extends ItemDoPedidoNoEstadoBase {
  nome_produto: string;
}

const PedidoPage: React.FC = () => {
  const { comandaId: comandaIdFromUrl } = useParams<{ comandaId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // --- Estados do Componente ---
  const [nomeClienteComanda, setNomeClienteComanda] = useState<string | null>(null);
  const [comandaStatusAtual, setComandaStatusAtual] = useState<string | null>(null);
  const [idNumericoDaComanda, setIdNumericoDaComanda] = useState<number | null>(null);
  const [localEntregaCliente, setLocalEntregaCliente] = useState<string | null>(null);
  const [dadosComandaOriginal, setDadosComandaOriginal] = useState<ComandaDetalhada | null>(null);
  
  const [cardapio, setCardapio] = useState<Cardapio | null>(null);
  const [itensPedido, setItensPedido] = useState<ItemPedidoState[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<TipoCategoria | null>(null);
  const [subcategoriaSelecionada, setSubcategoriaSelecionada] = useState<TipoSubcategoria | null>(null);
  const [termoBusca, setTermoBusca] = useState('');

  const [isLoadingCardapio, setIsLoadingCardapio] = useState(true);
  const [isLoadingComanda, setIsLoadingComanda] = useState(true);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');

  const [gruposDeOpcoes, setGruposDeOpcoes] = useState<GrupoOpcoes[]>([]);
  const [produtoParaOpcoes, setProdutoParaOpcoes] = useState<Produto | null>(null);
  const [isModalOpcoesOpen, setIsModalOpcoesOpen] = useState(false);

  // --- Lógica de Carregamento de Dados ---
  const carregarCardapio = useCallback(async () => {
    setIsLoadingCardapio(true);
    try {
      let cDB = (await getCategoriasDB()) || []; 
      let scDB = (await getSubcategoriasDB()) || []; 
      let pDB = (await getProdutosDB()) || [];
      let gDB = (await getGruposDeOpcoesDB()) || [];

      const localVazio = cDB.length === 0 || pDB.length === 0;
      const ultimaSync = await getConfig('lastCardapioSync'); 
      const agora = Date.now(); 
      const DEZ_MIN_MS = 10 * 60 * 1000;
      
      if (statusConexao === 'online' && (localVazio || !ultimaSync || (agora - (ultimaSync || 0) > DEZ_MIN_MS))) {
        toast.info("Sincronizando cardápio...", { autoClose: 1000, toastId: "sync-cardapio" });
        const [apiC, apiSC, apiP, apiG] = await Promise.all([
          fetchCategoriasAPI(), 
          fetchSubcategoriasAPI(), 
          fetchProdutosAPI(),
          fetchGruposDeOpcoesAPI()
        ]);
        await Promise.all([
          bulkPutCategoriasDB(apiC), 
          bulkPutSubcategoriasDB(apiSC), 
          bulkPutProdutosDB(apiP), 
          bulkPutGruposDeOpcoesDB(apiG)
        ]);
        await setConfig('lastCardapioSync', Date.now());
        setCardapio({ categorias: apiC, subcategorias: apiSC, produtos: apiP });
        setGruposDeOpcoes(apiG);
      } else if (!localVazio) { 
        setCardapio({ categorias: cDB, subcategorias: scDB, produtos: pDB }); 
        setGruposDeOpcoes(gDB);
      } else { 
        setCardapio(null); 
        setGruposDeOpcoes([]);
        toast.error("Cardápio indisponível. Verifique a conexão."); 
      }
    } catch (e: any) { 
      console.error("Erro ao carregar cardápio:", e); 
      toast.error("Falha crítica ao carregar cardápio."); 
      setCardapio(null); 
      setGruposDeOpcoes([]);
    } finally { 
      setIsLoadingCardapio(false); 
    }
  }, [statusConexao]);

  useEffect(() => {
    const dadosComandaDoLocation = location.state?.comandaDetalhes;
    const localVindoDaComanda = location.state?.localEntregaCliente;
    const itensVindosDaRevisao = location.state?.itensPedidoRetornandoDaRevisao;
    const idNumericoUrl = comandaIdFromUrl ? parseInt(comandaIdFromUrl, 10) : null;
    
    document.title = `Pedido Comanda ${dadosComandaDoLocation?.numero || comandaIdFromUrl || ''} - eChef`;

    if (!localVindoDaComanda) {
      toast.error("Local de entrega não informado. Retornando."); 
      navigate('/comandas', { replace: true }); 
      return;
    }
    setLocalEntregaCliente(localVindoDaComanda);

    const popularDados = (dados: ComandaDetalhada) => {
      setNomeClienteComanda(dados.cliente_nome || null);
      setComandaStatusAtual(dados.status);
      setIdNumericoDaComanda(dados.id);
      setDadosComandaOriginal(dados);
      setIsLoadingComanda(false);
    };

    if (itensVindosDaRevisao) {
      setItensPedido(itensVindosDaRevisao);
    }
    
    if (dadosComandaDoLocation) {
      popularDados(dadosComandaDoLocation);
    } else if (idNumericoUrl) {
      setIsLoadingComanda(true);
      buscarComandaDetalhadaPorIdAPI(idNumericoUrl)
        .then(cd => cd ? popularDados(cd) : navigate('/comandas', {replace: true}))
        .finally(() => setIsLoadingComanda(false));
    } else {
      toast.error("ID da comanda inválido."); 
      navigate('/comandas', {replace: true});
    }

    carregarCardapio();
    return () => { document.title = 'eChef'; };
  }, [comandaIdFromUrl, location.state, navigate, carregarCardapio]);

  useEffect(() => { 
    const handleOnline = () => setStatusConexao('online'); 
    const handleOffline = () => setStatusConexao('offline'); 
    window.addEventListener('online', handleOnline); 
    window.addEventListener('offline', handleOffline); 
    return () => { 
      window.removeEventListener('online', handleOnline); 
      window.removeEventListener('offline', handleOffline); 
    }; 
  }, []);

  const subcategoriasDaCategoria = useMemo(() => { if (!cardapio || !categoriaSelecionada) return []; return cardapio.subcategorias.filter(sc => sc.categoria_id === categoriaSelecionada.id); }, [cardapio, categoriaSelecionada]);
  const categoriaTemSubcategorias = subcategoriasDaCategoria.length > 0;
  const produtosFiltrados = useMemo(() => { if (!cardapio || !categoriaSelecionada) return []; const prods = cardapio.produtos.filter(p => p.categoria_id === categoriaSelecionada.id && (!categoriaTemSubcategorias || (subcategoriaSelecionada && p.subcategoria_id === subcategoriaSelecionada.id)) && p.ativo); if (termoBusca) { const termoLower = termoBusca.toLowerCase(); return prods.filter(p => p.nome.toLowerCase().includes(termoLower) || (p.descricao && p.descricao.toLowerCase().includes(termoLower))); } return prods; }, [cardapio, categoriaSelecionada, subcategoriaSelecionada, termoBusca, categoriaTemSubcategorias]);

  const grupoParaProdutoSelecionado = useMemo(() => {
    if (!produtoParaOpcoes || !produtoParaOpcoes.grupo_opcoes_id) return null;
    return gruposDeOpcoes.find(g => g.id === produtoParaOpcoes.grupo_opcoes_id);
  }, [produtoParaOpcoes, gruposDeOpcoes]);

  const mostrarApenasCategorias = !categoriaSelecionada;
  const mostrarApenasSubcategorias = !!(categoriaSelecionada && categoriaTemSubcategorias && !subcategoriaSelecionada);
  const mostrarApenasProdutos = !!(categoriaSelecionada && (!categoriaTemSubcategorias || subcategoriaSelecionada));

  const handleSelectCategoria = (cat: TipoCategoria | null) => { setCategoriaSelecionada(cat); setSubcategoriaSelecionada(null); setTermoBusca(''); };
  const handleSelectSubcategoria = (subcat: TipoSubcategoria | null) => { setSubcategoriaSelecionada(subcat); setTermoBusca(''); };
  const handleVoltarParaCategorias = () => handleSelectCategoria(null);

  const adicionarItem = (produto: Produto) => {
    if (!produto.ativo) return;

    if (produto.grupo_opcoes_id && gruposDeOpcoes.some(g => g.id === produto.grupo_opcoes_id)) {
      setProdutoParaOpcoes(produto);
      setIsModalOpcoesOpen(true);
      return;
    }
    
    const precoNumerico = parseFloat(produto.preco_venda as any);
    if (isNaN(precoNumerico)) return;
    
    const adicionarItemComObs = (obs: string | null) => {
      const obsFinal = obs ? obs.trim() : "";
      const itemExistente = itensPedido.find(i => i.produto_id === produto.id && i.observacao === obsFinal);
      if (itemExistente) {
        setItensPedido(itensPedido.map(i => i.produto_id === produto.id && i.observacao === obsFinal ? { ...i, quantidade: i.quantidade + 1 } : i));
      } else {
        setItensPedido([...itensPedido, { produto_id: produto.id, nome_produto: produto.nome, quantidade: 1, preco_unitario: precoNumerico, observacao: obsFinal }]);
      }
      toast.success(`${produto.nome} adicionado!`, { autoClose: 1000 });
    };

    if (produto.permite_observacao) {
      const obs = prompt(`Observação para ${produto.nome}:`, "");
      if (obs === null) return;
      adicionarItemComObs(obs);
    } else {
      adicionarItemComObs("");
    }
  };

  const handleConfirmarOpcoes = (opcoesSelecionadas: OpcaoItem[], observacaoAdicional: string) => {
    if (!produtoParaOpcoes) return;

    const obsOpcoes = opcoesSelecionadas.map(s => s.nome).join(', ');
    const obsFinal = [obsOpcoes, observacaoAdicional.trim()].filter(Boolean).join('; ');

    // [CORREÇÃO]: Calcular o total dos adicionais
    const totalAdicionais = opcoesSelecionadas.reduce((acc, op) => acc + Number(op.valor_adicional || 0), 0);
    
    // [CORREÇÃO]: Preço Unitário Final = Preço Base + Adicionais
    const precoBase = parseFloat(produtoParaOpcoes.preco_venda as any);
    const precoFinal = precoBase + totalAdicionais;
    
    const itemExistente = itensPedido.find(i => i.produto_id === produtoParaOpcoes.id && i.observacao === obsFinal);
    
    if (itemExistente) {
      // Se já existe igual (mesmas opções), soma a quantidade
      // Nota: O preço unitário deve ser o mesmo, então não precisa atualizar
      setItensPedido(prev => prev.map(i => i === itemExistente ? { ...i, quantidade: i.quantidade + 1 } : i));
    } else {
      // Se é novo, adiciona com o PREÇO FINAL CALCULADO
      setItensPedido(prev => [...prev, { 
          produto_id: produtoParaOpcoes.id, 
          nome_produto: produtoParaOpcoes.nome, 
          quantidade: 1, 
          preco_unitario: precoFinal, // <--- AQUI ESTAVA O ERRO, AGORA VAI O PREÇO CHEIO
          observacao: obsFinal 
      }]);
    }
    toast.success(`${produtoParaOpcoes.nome} adicionado!`, { autoClose: 1000 });
  };

  const handleProsseguirParaRevisao = () => {
    if (itensPedido.length === 0) { 
      toast.info("Adicione itens ao pedido para continuar."); 
      return; 
    }
    if (comandaStatusAtual?.toLowerCase() !== 'aberta') { 
      toast.error(`A comanda não está aberta.`); 
      return; 
    }
    
    const estadoParaRevisao = {
        comandaOriginal: dadosComandaOriginal,
        novosItens: itensPedido,
        localEntregaCliente: localEntregaCliente
    };
    navigate(`/comandas/${idNumericoDaComanda}/revisar-pedido`, { state: estadoParaRevisao });
  };

  if (isLoadingCardapio || isLoadingComanda) { 
    return <LoadingSpinner message={isLoadingComanda ? "Carregando comanda..." : "Carregando cardápio..."} />; 
  }
  
  return (
    <div className="p-4 h-[calc(100vh-4rem)] bg-white flex flex-col relative">
      <div className='flex-shrink-0 flex justify-between items-center mb-4 pb-3 border-b'>
        {categoriaSelecionada ? (
          <button onClick={handleVoltarParaCategorias} className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium">
            <FiChevronLeft className="mr-1 h-5 w-5" /> Voltar
          </button>
        ) : (
          <button onClick={() => navigate('/comandas')} className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium">
            <FiArrowLeft className="mr-1 h-5 w-5" /> Comandas
          </button>
        )}
        <h2 className="text-lg font-semibold text-gray-700 mx-4">
          {subcategoriaSelecionada?.nome || categoriaSelecionada?.nome || 'Cardápio'}
        </h2>
        <span className="text-sm text-gray-600 font-medium truncate" title={nomeClienteComanda || ''}>
          {nomeClienteComanda || ''}
        </span>
      </div>
      
      {statusConexao === 'offline' && <div className="flex-shrink-0 mb-2 p-2 bg-yellow-100 text-yellow-700 text-xs rounded text-center">Cardápio pode estar desatualizado (cache).</div>}
      
      <div className="mb-4 flex-shrink-0">
        {(mostrarApenasCategorias || mostrarApenasSubcategorias) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
           {(mostrarApenasCategorias ? cardapio?.categorias ?? [] : subcategoriasDaCategoria).map((item) => (
              <button key={item.id} onClick={() => mostrarApenasCategorias ? handleSelectCategoria(item as TipoCategoria) : handleSelectSubcategoria(item as TipoSubcategoria)} className="px-4 py-2 text-sm font-semibold text-gray-800 bg-white border-2 border-gray-200 rounded-lg shadow-sm hover:border-blue-500 hover:bg-blue-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-150">{item.nome}</button>
            ))}
          </div>
        )}
        {mostrarApenasProdutos && (
          <div className="relative mb-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiSearch className="h-4 w-4 text-gray-400" /></div>
            <input type="text" placeholder={`Buscar em ${subcategoriaSelecionada?.nome || categoriaSelecionada?.nome || 'produtos'}...`} value={termoBusca} onChange={e => setTermoBusca(e.target.value)} className="w-full p-2 pl-10 pr-10 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"/>
            {termoBusca && (<button onClick={() => setTermoBusca('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"><FiXCircle className="h-4 w-4" /></button>)}
          </div>
        )}
      </div>
      
      <div className="flex-grow overflow-y-auto -mx-4 px-4 custom-scrollbar">
          {mostrarApenasProdutos && cardapio && ( produtosFiltrados.length === 0 ? ( <p className="text-gray-500 text-center mt-8 italic"> {termoBusca ? `Nenhum produto encontrado para "${termoBusca}".` : "Nenhum produto nesta seleção."} </p> ) : ( 
          <ul className="space-y-2 pb-4"> 
            {produtosFiltrados.map(p => ( 
              <li key={p.id} className={`border rounded-lg p-3 shadow-sm hover:shadow-md bg-white flex items-center justify-between gap-3 ${!p.ativo ? 'opacity-60 bg-gray-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate" title={p.nome}>{p.nome}</p>
                  <p className="hidden md:block text-xs text-gray-500 mt-0.5 truncate">{p.descricao}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-bold text-blue-600 text-sm whitespace-nowrap">R$ {parseFloat(p.preco_venda as string).toFixed(2).replace('.', ',')}</span>
                  <button onClick={() => adicionarItem(p)} disabled={!p.ativo} className={`bg-green-500 hover:bg-green-600 text-white rounded-md px-4 py-2 text-sm font-bold flex items-center shadow-sm ${!p.ativo ? 'bg-gray-400 cursor-not-allowed' : ''}`}><FiPlus size={14} className="mr-1"/> Add</button>
                </div>
              </li>
            ))} 
          </ul> 
          ) )}
      </div>

      {itensPedido.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <button onClick={handleProsseguirParaRevisao} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full shadow-lg flex items-center animate-pulse">
            <FiClipboard className="mr-2 h-6 w-6"/>
            Revisar Pedido ({itensPedido.length})
          </button>
        </div>
      )}

      {grupoParaProdutoSelecionado && (
        <OpcoesProdutoModal
          isOpen={isModalOpcoesOpen}
          onClose={() => setIsModalOpcoesOpen(false)}
          onConfirm={handleConfirmarOpcoes}
          grupo={grupoParaProdutoSelecionado}
          nomeProduto={produtoParaOpcoes?.nome || ''}
        />
      )}
    </div>
  );
};

export default PedidoPage;