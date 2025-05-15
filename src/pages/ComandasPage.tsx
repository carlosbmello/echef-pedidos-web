// src/pages/ComandasPage.tsx
import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarComandaDetalhadaPorNumeroAPI } from '../services/comandasService';
import { getComandaCacheByNumeroDB, ComandaCache } from '../services/dbService';
import { ComandaDetalhada, ItemPedido } from '../types/comanda';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiSearch, FiPlusCircle, FiUser, FiDollarSign, FiCalendar, FiWifiOff, FiList } from 'react-icons/fi';
import { toast } from 'react-toastify';

const ComandasPage: React.FC = () => {
  const [numeroBusca, setNumeroBusca] = useState('');
  const [comandaEncontrada, setComandaEncontrada] = useState<ComandaDetalhada | ComandaCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleOnline = () => { setStatusConexao('online'); toast.success("Conexão restaurada!", {toastId: "comandas-page-conexao"}); };
    const handleOffline = () => { setStatusConexao('offline'); toast.warn("Você está offline.", {toastId: "comandas-page-conexao"}); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const buscarNoCacheLocal = async (numeroComanda: string) => {
    setIsLoading(true);
    setIsOfflineResult(true);
    setError(null);
    setComandaEncontrada(null);
    console.log("[ComandasPage] buscarNoCacheLocal: Buscando no cache nº:", numeroComanda);
    try {
      const comandaCache = await getComandaCacheByNumeroDB(numeroComanda);
      if (comandaCache) {
        setComandaEncontrada(comandaCache);
        console.log("[ComandasPage] buscarNoCacheLocal: Encontrada no cache:", comandaCache);
      } else {
        setError(`Comanda ${numeroComanda} não encontrada no cache local.`);
      }
    } catch (dbErr) {
      console.error("[ComandasPage] buscarNoCacheLocal: Erro:", dbErr);
      setError("Falha ao acessar o cache local.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const numeroComandaTrimmed = numeroBusca.trim();
    if (!numeroComandaTrimmed) { setError('Digite o número da comanda.'); setComandaEncontrada(null); return; }

    setIsLoading(true);
    setError(null);
    setComandaEncontrada(null);
    setIsOfflineResult(false);

    if (statusConexao === 'online') {
      console.log(`[ComandasPage] handleSearchSubmit (Online): Buscando comanda API nº: '${numeroComandaTrimmed}'`);
      try {
        const comandaAPI = await buscarComandaDetalhadaPorNumeroAPI(numeroComandaTrimmed);
        console.log("[ComandasPage] handleSearchSubmit (Online): Resultado da API:", JSON.stringify(comandaAPI, null, 2));
        if (comandaAPI) {
          setComandaEncontrada(comandaAPI);
        } else {
          setError(`Comanda ${numeroComandaTrimmed} não encontrada via API.`);
        }
      } catch (err: any) {
        console.error("[ComandasPage] handleSearchSubmit (Online): Erro API:", err);
        if (err.isAxiosError && !err.response) { // Erro de rede
            setError("Falha na comunicação. Tentando cache local...");
            await buscarNoCacheLocal(numeroComandaTrimmed);
        } else { // Outro erro da API (404, 500, etc.)
             setError(err.response?.data?.message || err.message || `Erro ao buscar comanda.`);
        }
      } finally {
        setIsLoading(false);
      }
    } else { // Offline
      console.log("[ComandasPage] handleSearchSubmit (Offline): Buscando no cache nº:", numeroComandaTrimmed);
      await buscarNoCacheLocal(numeroComandaTrimmed);
    }
  };

  const handleNavigateToPedidoPage = () => {
    if (comandaEncontrada && comandaEncontrada.id) {
      const idParaUrl = comandaEncontrada.id;
      const estadoParaNavegacao = {
        comandaBasica: {
            id: comandaEncontrada.id,
            numero: comandaEncontrada.numero,
            cliente_nome: comandaEncontrada.cliente_nome || null,
            local_atual: (comandaEncontrada as ComandaDetalhada).localizacao_cliente || (comandaEncontrada as ComandaCache).local_atual || '',
            status: comandaEncontrada.status,
            total_ja_consumido: Number((comandaEncontrada as ComandaDetalhada).total_atual_calculado || (comandaEncontrada as ComandaCache).valor_total_calculado || 0),
        }
      };
      console.log(`[ComandasPage] handleNavigateToPedidoPage: Navegando. ID URL: ${idParaUrl}, Estado:`, estadoParaNavegacao);
      navigate(`/comandas/${idParaUrl}/novo-pedido`, { state: estadoParaNavegacao });
    } else {
      toast.error("Selecione uma comanda válida para prosseguir.");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Buscar Comanda</h1>
      {statusConexao === 'offline' && ( <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 text-sm rounded text-center shadow"> <FiWifiOff className="inline mr-2 mb-0.5"/> Você está offline. Busca no cache local. </div> )}
      <form onSubmit={handleSearchSubmit} className="mb-6 bg-white p-6 rounded-lg shadow-md flex flex-col sm:flex-row sm:items-end sm:space-x-4">
        <div className="flex-grow mb-4 sm:mb-0">
          <label htmlFor="numeroComanda" className="block text-sm font-medium text-gray-700 mb-1"> Número da Comanda </label>
          <input ref={inputRef} type="text" id="numeroComanda" value={numeroBusca} onChange={(e) => setNumeroBusca(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Digite o número..." required />
        </div>
        <button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-md shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" >
          <FiSearch className="mr-2" /> {isLoading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      <div className="mt-6">
        {isLoading && <LoadingSpinner message={isOfflineResult ? "Buscando no cache..." : "Buscando na API..."} />}
        {error && !isLoading && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow" role="alert"> <p className="font-bold">Erro</p> <p>{error}</p> </div> )}
        
        {comandaEncontrada && !isLoading && (
          <div className={`p-6 rounded-lg shadow-lg border-l-4 ${isOfflineResult ? 'bg-yellow-50 border-yellow-400' : 'bg-green-100 border-green-500'}`}>
            <h2 className={`text-2xl font-semibold mb-3 ${isOfflineResult ? 'text-yellow-800' : 'text-green-700'}`}> {isOfflineResult && <FiWifiOff className="inline mr-2 mb-1"/>} Comanda Encontrada {isOfflineResult ? '(Cache Local)' : ''}! </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-gray-700 mb-4">
              <div><strong className="font-medium">Número:</strong> {comandaEncontrada.numero}</div>
              {/* Local removido daqui */}
              {comandaEncontrada.cliente_nome && <div className="md:col-span-2"><FiUser className="inline mr-1 text-gray-500"/><strong className="font-medium">Cliente:</strong> {comandaEncontrada.cliente_nome}</div>}
              
              {( ('total_atual_calculado' in comandaEncontrada && comandaEncontrada.total_atual_calculado != null) ||
                 ('valor_total_calculado' in comandaEncontrada && comandaEncontrada.valor_total_calculado != null && isOfflineResult) ) ? (
                <div><FiDollarSign className="inline mr-1 text-gray-500"/><strong className="font-medium">Consumo:</strong> R$ {(Number((comandaEncontrada as ComandaDetalhada).total_atual_calculado || (comandaEncontrada as ComandaCache).valor_total_calculado) || 0).toFixed(2).replace('.', ',')} {isOfflineResult && <span className="text-xs text-yellow-600 ml-1">(cache)</span>}</div>
              ) : ( <div><FiDollarSign className="inline mr-1 text-gray-500"/><strong className="font-medium">Consumo:</strong> {isOfflineResult ? 'N/A (cache)' : 'R$ 0,00'}</div> )}

              {('data_abertura' in comandaEncontrada && comandaEncontrada.data_abertura) && ( <div className="md:col-span-2"><FiCalendar className="inline mr-1 text-gray-500"/><strong className="font-medium">Aberta em:</strong> {new Date(comandaEncontrada.data_abertura).toLocaleString('pt-BR')} {isOfflineResult && <span className="text-xs text-yellow-600 ml-1">(cache)</span>}</div> )}
              {isOfflineResult && ( <p className="text-sm text-yellow-700 md:col-span-2 italic mt-2">Detalhes do cache podem estar desatualizados.</p> )}
            </div>

            {!isOfflineResult && 'itens' in comandaEncontrada && Array.isArray((comandaEncontrada as ComandaDetalhada).itens) && (comandaEncontrada as ComandaDetalhada).itens.length > 0 && (
              <div className="md:col-span-2 mt-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-2 border-t pt-3 flex items-center"><FiList className="mr-2"/>Itens Atuais da Comanda:</h3>
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

            <div className="mt-6 text-right">
              <button onClick={handleNavigateToPedidoPage} disabled={isOfflineResult && !(comandaEncontrada as ComandaCache)?.id} className={`font-bold py-2 px-5 rounded-md shadow-sm flex items-center float-right ${isOfflineResult && !(comandaEncontrada as ComandaCache)?.id ? 'bg-gray-400 cursor-not-allowed' : (isOfflineResult ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white')}`} >
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