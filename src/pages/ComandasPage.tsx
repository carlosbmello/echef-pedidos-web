// src/pages/ComandasPage.tsx
import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarComandaDetalhadaPorNumeroAPI } from '../services/comandasService';
import { getComandaCacheByNumeroDB, ComandaCache } from '../services/dbService';
import { ComandaDetalhada, ItemPedido } from '../types/comanda'; // ItemPedido é usado implicitamente por ComandaDetalhada
import LoadingSpinner from '../components/common/LoadingSpinner';
// FiMapPin removido, formatCurrency removido (usando toLocaleString diretamente)
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
  const [localParaImpressao, setLocalParaImpressao] = useState(''); 
  const [comandaEncontrada, setComandaEncontrada] = useState<ComandaDetalhada | ComandaCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

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

  const buscarNoCache = async (numeroComanda: string) => {
    setIsLoading(true); setIsOfflineResult(true);
    try {
      const comandaCache = await getComandaCacheByNumeroDB(numeroComanda);
      if (comandaCache) {
        setComandaEncontrada(comandaCache);
        setError(null);
        setLocalParaImpressao(comandaCache.local_atual || '');
      } else {
        setError(`Comanda ${numeroComanda} não encontrada no cache local.`);
        setComandaEncontrada(null);
      }
    } catch (dbErr) { setError("Falha ao acessar o cache local."); setComandaEncontrada(null); } 
    finally { setIsLoading(false); }
  };

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const numeroComandaTrimmed = numeroBusca.trim();
    if (!numeroComandaTrimmed) { setError('Digite o número da comanda.'); setComandaEncontrada(null); return; }

    setIsLoading(true); setError(null); setComandaEncontrada(null); setIsOfflineResult(false);

    if (statusConexao === 'online') {
      try {
        const comandaAPI = await buscarComandaDetalhadaPorNumeroAPI(numeroComandaTrimmed);
        if (comandaAPI) {
          setComandaEncontrada(comandaAPI);
          if (!localParaImpressao && comandaAPI.local_atual) {
            setLocalParaImpressao(comandaAPI.local_atual);
          }
        } else {
          setError(`Comanda ${numeroComandaTrimmed} não encontrada ou não está aberta via API.`);
        }
      } catch (err: any) {
        if (err.isAxiosError && !err.response) {
            setError("Falha na comunicação. Tentando cache local...");
            await buscarNoCache(numeroComandaTrimmed);
        } else { setError(err.response?.data?.message || err.message || `Erro ao buscar comanda.`); }
      } finally { setIsLoading(false); }
    } else {
      await buscarNoCache(numeroComandaTrimmed);
    }
  };

  const handleNavigateToPedido = () => {
    if (comandaEncontrada) {
      const idParaUrl = comandaEncontrada.id; 
      const estadoParaNavegacao = { 
        comandaDetalhes: { ...comandaEncontrada }, // Passa o objeto completo
        localInformadoParaImpressao: localParaImpressao.trim() || comandaEncontrada.local_atual || null
      };
      navigate(`/comandas/${idParaUrl}/novo-pedido`, { state: estadoParaNavegacao });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Buscar Comanda</h1>
      {statusConexao === 'offline' && ( <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 text-sm rounded text-center shadow"> <FiWifiOff className="inline mr-2 mb-0.5"/> Busca no cache local. </div> )}
      <form onSubmit={handleSearch} className="mb-6 bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-1">
                <label htmlFor="numeroComanda" className="block text-sm font-medium text-gray-700 mb-1"> Número Comanda <span className="text-red-500">*</span></label>
                <input ref={inputRef} type="text" id="numeroComanda" value={numeroBusca} onChange={(e)=> setNumeroBusca(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Número..." required />
            </div>
            <div className="sm:col-span-1">
                <label htmlFor="localParaImpressao" className="block text-sm font-medium text-gray-700 mb-1"><FiEdit3 className="inline mr-1 text-gray-500 h-4 w-4 align-text-bottom" /> Local (p/ Pedido)</label>
                <input type="text" id="localParaImpressao" value={localParaImpressao} onChange={(e) => setLocalParaImpressao(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Mesa 7" />
            </div>
            <div className="sm:col-span-1">
                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-md shadow-sm flex items-center justify-center disabled:opacity-50"> <FiSearch className="mr-2" /> {isLoading ? 'Buscando...' : 'Buscar'} </button>
            </div>
        </div>
      </form>

      <div className="mt-6">
        {isLoading && <LoadingSpinner message={isOfflineResult ? "Buscando no cache..." : "Buscando na API..."} />}
        {error && !isLoading && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow" role="alert"> <p className="font-bold">Erro</p> <p>{error}</p> </div> )}
        
        {comandaEncontrada && !isLoading && (
          <div className={`p-6 rounded-lg shadow-lg border-l-4 ${isOfflineResult ? 'bg-yellow-50 border-yellow-400' : 'bg-green-100 border-green-500'}`}>
            <h2 className={`text-2xl font-semibold mb-3 ${isOfflineResult ? 'text-yellow-800' : 'text-green-700'}`}> {isOfflineResult && <FiWifiOff className="inline mr-2 mb-1"/>} Comanda Encontrada {isOfflineResult ? '(Cache)' : ''}! </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-gray-700">
              <div><strong className="font-medium">Número:</strong> {comandaEncontrada.numero}</div>
              {comandaEncontrada.cliente_nome && <div className="md:col-span-2"><FiUser className="inline mr-1 text-gray-500"/><strong className="font-medium">Cliente:</strong> {comandaEncontrada.cliente_nome}</div>}
              
              {/* Total Consumido - Lógica Ajustada */}
              {(() => {
                let total: number | null | undefined = 0;
                if (isOfflineResult) {
                  total = (comandaEncontrada as ComandaCache).valor_total_calculado;
                } else {
                  total = (comandaEncontrada as ComandaDetalhada).total_atual_calculado;
                }
                const valorNumerico = Number(total) || 0;
                return (
                  <div>
                    <FiDollarSign className="inline mr-1 text-gray-500"/>
                    <strong className="font-medium">Consumo:</strong> 
                    {' '}R$ {valorNumerico.toFixed(2).replace('.', ',')}
                    {isOfflineResult && total === null && <span className="text-xs text-yellow-600 ml-1">(N/A cache)</span>}
                    {isOfflineResult && total !== null && <span className="text-xs text-yellow-600 ml-1">(cache)</span>}
                  </div>
                );
              })()}

              {('data_abertura' in comandaEncontrada && comandaEncontrada.data_abertura) && ( <div className="md:col-span-2"><FiCalendar className="inline mr-1 text-gray-500"/><strong className="font-medium">Aberta em:</strong> {formatDateTime(comandaEncontrada.data_abertura)} {isOfflineResult && <span className="text-xs text-yellow-600 ml-1">(cache)</span>}</div> )}
              {isOfflineResult && ( <p className="text-sm text-yellow-700 md:col-span-2 italic mt-2">Detalhes do cache podem estar desatualizados.</p> )}
              {!isOfflineResult && 'itens' in comandaEncontrada && Array.isArray((comandaEncontrada as ComandaDetalhada).itens) && (comandaEncontrada as ComandaDetalhada).itens.length > 0 && (
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2 border-t pt-3 flex items-center"><FiList className="mr-2"/>Itens da Comanda:</h3>
                  <ul className="space-y-1 text-sm max-h-60 overflow-y-auto custom-scrollbar pr-2 bg-white p-3 rounded border">
                    {(comandaEncontrada as ComandaDetalhada).itens.map((item: ItemPedido) => ( // Especificar tipo ItemPedido
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
              <button onClick={handleNavigateToPedido} className={`font-bold py-2 px-5 rounded-md shadow-sm flex items-center float-right ${isOfflineResult ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`} >
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