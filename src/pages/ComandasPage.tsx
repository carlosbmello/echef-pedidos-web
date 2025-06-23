// src/pages/ComandasPage.tsx
import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarComandaDetalhadaPorNumeroAPI } from '../services/comandasService';
import { getComandaCacheByNumeroDB, ComandaCache } from '../services/dbService';
import { ComandaDetalhada, ItemPedido } from '../types/comanda'; // ItemPedido usado implicitamente
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiSearch, FiPlusCircle, FiUser, FiDollarSign, FiCalendar, FiWifiOff, FiList, FiEdit3 } from 'react-icons/fi';
import { toast } from 'react-toastify';

const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});
    } catch {
        return '?';
    }
};

const ComandasPage: React.FC = () => {
  const [numeroBusca, setNumeroBusca] = useState('');
  // Estado para o input do local, preenchido pelo garçom para este pedido específico
  const [localParaImpressaoPedidoAtual, setLocalParaImpressaoPedidoAtual] = useState('');
  const [comandaEncontrada, setComandaEncontrada] = useState<ComandaDetalhada | ComandaCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null); // Ref para o input do local

  useEffect(() => {
    inputRef.current?.focus();
    const handleOnline = () => { setStatusConexao('online'); toast.success("Conexão restaurada!", {toastId: "comandas-conexao-status"}); };
    const handleOffline = () => { setStatusConexao('offline'); toast.warn("Você está offline.", {toastId: "comandas-conexao-status"}); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const limparResultadosBusca = () => {
    setComandaEncontrada(null);
    setError(null);
    setIsOfflineResult(false);
    // Não limpar localParaImpressaoPedidoAtual aqui, pois pode ser útil se o usuário quiser tentar de novo com o mesmo local
  };

  const buscarNoCache = async (numeroComanda: string) => {
    setIsLoading(true); setIsOfflineResult(true);
    try {
      const comandaCache = await getComandaCacheByNumeroDB(numeroComanda);
      if (comandaCache) {
        setComandaEncontrada(comandaCache);
        setError(null);
        // Não preencher localParaImpressaoPedidoAtual com comandaCache.local_atual,
        // pois o valor do input do garçom é o que importa para este pedido.
      } else {
        setError(`Comanda ${numeroComanda} não encontrada no cache local.`);
        setComandaEncontrada(null);
      }
    } catch (dbErr) {
      console.error("Erro ao buscar no cache:", dbErr);
      setError("Falha ao acessar o cache local.");
      setComandaEncontrada(null);
    }
    finally { setIsLoading(false); }
  };

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const numeroComandaTrimmed = numeroBusca.trim();
    if (!numeroComandaTrimmed) {
      setError('Digite o número da comanda.');
      limparResultadosBusca();
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    limparResultadosBusca(); // Limpa resultados anteriores antes de nova busca

    if (statusConexao === 'online') {
      try {
        const comandaAPI = await buscarComandaDetalhadaPorNumeroAPI(numeroComandaTrimmed);
        if (comandaAPI) {
          setComandaEncontrada(comandaAPI);
          // Se a comanda for encontrada, focar no botão de adicionar pedido ou no campo de local, se vazio
          if (!localParaImpressaoPedidoAtual.trim()) {
            localInputRef.current?.focus();
          }
        } else {
          setError(`Comanda ${numeroComandaTrimmed} não encontrada ou não está aberta via API.`);
          inputRef.current?.select();
        }
      } catch (err: any) {
        console.error("Erro ao buscar comanda na API:", err);
        if (err.isAxiosError && !err.response) {
            toast.warn("Falha na comunicação com o servidor. Tentando buscar no cache local...", { autoClose: 2000 });
            await buscarNoCache(numeroComandaTrimmed);
        } else {
            setError(err.response?.data?.message || err.message || `Erro ao buscar comanda ${numeroComandaTrimmed}.`);
            inputRef.current?.select();
        }
      } finally { setIsLoading(false); }
    } else { // Offline
      toast.info("Buscando comanda no cache local...", { autoClose: 1500 });
      await buscarNoCache(numeroComandaTrimmed);
    }
  };

  const handleNavigateToPedido = () => {
  if (!comandaEncontrada) {
      toast.error("Nenhuma comanda selecionada para adicionar pedido.");
      return;
  }

  const idParaUrl = comandaEncontrada.id; // id numérico da comanda
  const localInformadoPeloGarcom = localParaImpressaoPedidoAtual.trim();

  if (!localInformadoPeloGarcom) {
    toast.error("Por favor, informe o 'Local (p/ Pedido)' antes de prosseguir.");
    localInputRef.current?.focus();
    return;
  }

  // Flag para controlar se a navegação deve ser impedida devido ao status
  let impedirNavegacaoPorStatus = false;

  // Verifica o status da comanda
  if ('status' in comandaEncontrada && comandaEncontrada.status) {
    // Se 'status' existe e tem um valor (presumivelmente de ComandaDetalhada)
    if (comandaEncontrada.status.toLowerCase() !== 'aberta') {
      toast.warn(`A comanda ${comandaEncontrada.numero} não está aberta. Status: ${comandaEncontrada.status}.`);
      impedirNavegacaoPorStatus = true; // Impedir navegação se não estiver aberta
    }
  } else if (isOfflineResult) {
    // Se é um resultado do cache (isOfflineResult === true) e 'status' não existe no objeto ComandaCache.
    // Decisão de negócio: o que fazer?
    // Opção A: Permitir prosseguir com um aviso
    toast.info(`Status da comanda ${comandaEncontrada.numero} (cache) não pôde ser verificado. Assumindo que está apta para novos pedidos.`);
    // Opção B: Impedir se você quiser ser mais estrito (raro para cache, geralmente se quer permitir)
    // toast.error(`Status da comanda ${comandaEncontrada.numero} (cache) não disponível. Não é possível adicionar pedido.`);
    // impedirNavegacaoPorStatus = true;
  } else {
    // Caso inesperado: não é do cache e não tem status (pode indicar um problema com o tipo ComandaDetalhada)
    // Embora o type guard `'status' in comandaEncontrada` deva pegar isso se ComandaDetalhada sempre tiver status.
    // Se ComandaDetalhada puder vir sem status, esta lógica precisaria ser ajustada.
    console.warn(`Comanda ${comandaEncontrada.numero} não possui propriedade 'status' e não é resultado do cache. Verifique os tipos.`);
    // Poderia também impedir a navegação aqui se for um estado inválido.
    // impedirNavegacaoPorStatus = true;
  }

  // Se a decisão de negócio for impedir a navegação baseado no status:
  if (impedirNavegacaoPorStatus) {
    return; // Interrompe a função aqui
  }

  const estadoParaNavegacao = {
    comandaDetalhes: { ...comandaEncontrada }, // Passa o objeto completo da comanda encontrada
    localInformadoParaImpressao: localInformadoPeloGarcom // Passa o valor que o garçom digitou
  };

  console.log("[ComandasPage] Navegando para PedidoPage com state:", JSON.stringify(estadoParaNavegacao, null, 2));
  navigate(`/comandas/${idParaUrl}/novo-pedido`, { state: estadoParaNavegacao });
};


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Buscar Comanda</h1>
      {statusConexao === 'offline' && ( <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 text-sm rounded text-center shadow"> <FiWifiOff className="inline mr-2 mb-0.5"/> Você está offline. Busca será feita no cache local. </div> )}
      <form onSubmit={handleSearch} className="mb-6 bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-1">
                <label htmlFor="numeroComanda" className="block text-sm font-medium text-gray-700 mb-1"> Número Comanda <span className="text-red-500">*</span></label>
                <input ref={inputRef} type="text" id="numeroComanda" value={numeroBusca} onChange={(e)=> setNumeroBusca(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Número..." required />
            </div>
            <div className="sm:col-span-1">
                <label htmlFor="localParaImpressao" className="block text-sm font-medium text-gray-700 mb-1"><FiEdit3 className="inline mr-1 text-gray-500 h-4 w-4 align-text-bottom" /> Local (p/ Pedido) <span className="text-red-500">*</span></label>
                <input ref={localInputRef} type="text" id="localParaImpressao" value={localParaImpressaoPedidoAtual} onChange={(e) => setLocalParaImpressaoPedidoAtual(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Mesa 7, Balcão" required />
            </div>
            <div className="sm:col-span-1">
                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-md shadow-sm flex items-center justify-center disabled:opacity-50"> <FiSearch className="mr-2" /> {isLoading ? 'Buscando...' : 'Buscar'} </button>
            </div>
        </div>
      </form>

      <div className="mt-6">
        {isLoading && <LoadingSpinner message={isOfflineResult ? "Buscando no cache local..." : "Buscando na API..."} />}
        {error && !isLoading && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow" role="alert"> <p className="font-bold">Erro</p> <p>{error}</p> </div> )}

        {comandaEncontrada && !isLoading && (
          <div className={`p-6 rounded-lg shadow-lg border-l-4 ${isOfflineResult ? 'bg-yellow-50 border-yellow-400' : 'bg-green-100 border-green-500'}`}>
            <h2 className={`text-2xl font-semibold mb-3 ${isOfflineResult ? 'text-yellow-800' : 'text-green-700'}`}> {isOfflineResult && <FiWifiOff className="inline mr-2 mb-1"/>} Comanda Encontrada {isOfflineResult ? '(Cache)' : ''}! </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-gray-700">
              <div><strong className="font-medium">Número:</strong> {comandaEncontrada.numero}</div>
              {comandaEncontrada.cliente_nome && <div className="md:col-span-2"><FiUser className="inline mr-1 text-gray-500"/><strong className="font-medium">Cliente:</strong> {comandaEncontrada.cliente_nome}</div>}
              {comandaEncontrada.local_atual && <div className="md:col-span-2"><FiEdit3 className="inline mr-1 text-gray-500"/><strong className="font-medium">Local Atual da Comanda:</strong> {comandaEncontrada.local_atual}</div>}

              {(() => {
                let total: number | null | undefined = 0;
                const valorOriginal = isOfflineResult ? (comandaEncontrada as ComandaCache).valor_total_calculado : (comandaEncontrada as ComandaDetalhada).total_atual_calculado;
                total = (typeof valorOriginal === 'string') ? parseFloat(valorOriginal) : valorOriginal; // Garantir que seja número
                const valorNumerico = Number(total) || 0;
                return (
                  <div>
                    <FiDollarSign className="inline mr-1 text-gray-500"/>
                    <strong className="font-medium">Consumo:</strong>
                    {' '}R$ {valorNumerico.toFixed(2).replace('.', ',')}
                    {isOfflineResult && valorOriginal === null && <span className="text-xs text-yellow-600 ml-1">(N/A cache)</span>}
                    {isOfflineResult && valorOriginal !== null && <span className="text-xs text-yellow-600 ml-1">(cache)</span>}
                  </div>
                );
              })()}

              {('data_abertura' in comandaEncontrada && comandaEncontrada.data_abertura) && ( <div className="md:col-span-2"><FiCalendar className="inline mr-1 text-gray-500"/><strong className="font-medium">Aberta em:</strong> {formatDateTime(comandaEncontrada.data_abertura)} {isOfflineResult && <span className="text-xs text-yellow-600 ml-1">(cache)</span>}</div> )}
              {isOfflineResult && ( <p className="text-sm text-yellow-700 md:col-span-2 italic mt-2">Detalhes do cache podem estar desatualizados. Status atual pode diferir.</p> )}
              {!isOfflineResult && 'itens' in comandaEncontrada && Array.isArray((comandaEncontrada as ComandaDetalhada).itens) && (comandaEncontrada as ComandaDetalhada).itens.length > 0 && (
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2 border-t pt-3 flex items-center"><FiList className="mr-2"/>Itens da Comanda:</h3>
                  <ul className="space-y-1 text-sm max-h-60 overflow-y-auto custom-scrollbar pr-2 bg-white p-3 rounded border">
                    {(comandaEncontrada as ComandaDetalhada).itens.map((item: ItemPedido) => (
                      <li key={item.id} className="text-gray-600 border-b border-gray-100 pb-1 last:border-b-0">
                        <div className="flex justify-between">
                          <span>{Number(item.quantidade)}x {item.produto_nome}</span>
                          <span>R$ {(Number(item.quantidade) * Number(item.preco_unitario_momento)).toFixed(2).replace('.',',')}</span>
                        </div>
                        {item.observacao_item && <span className="text-xs italic text-blue-600 block ml-4">Obs: {item.observacao_item}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-6 text-right">
              <button
                onClick={handleNavigateToPedido}
                // Habilitar o botão se uma comanda foi encontrada e não está carregando
                disabled={!comandaEncontrada || isLoading}
                className={`font-bold py-2 px-5 rounded-md shadow-sm flex items-center float-right
                            ${isOfflineResult ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
                            ${(!comandaEncontrada || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <FiPlusCircle className="mr-2" /> Adicionar Pedido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ComandasPage;