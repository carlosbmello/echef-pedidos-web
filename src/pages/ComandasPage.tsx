// src/pages/ComandasPage.tsx

import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarComandaDetalhadaPorNumeroAPI } from '../services/comandasService';
import { getComandaCacheByNumeroDB, ComandaCache } from '../services/dbService';
import { ComandaDetalhada, ItemPedido } from '../types/comanda';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiSearch, FiPlusCircle, FiUser, FiDollarSign, FiCalendar, FiWifiOff, FiList, FiEdit3, FiArrowLeft } from 'react-icons/fi';
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
  const [localEntregaCliente, setLocalEntregaCliente] = useState('');
  const [comandaEncontrada, setComandaEncontrada] = useState<ComandaDetalhada | ComandaCache | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);
  const [statusConexao, setStatusConexao] = useState<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline');

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!comandaEncontrada) {
      inputRef.current?.focus();
    }
    const handleOnline = () => { setStatusConexao('online'); toast.success("Conexão restaurada!", {toastId: "comandas-conexao-status"}); };
    const handleOffline = () => { setStatusConexao('offline'); toast.warn("Você está offline.", {toastId: "comandas-conexao-status"}); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [comandaEncontrada]); 

  const limparResultadosBusca = () => {
    setComandaEncontrada(null);
    setError(null);
    setIsOfflineResult(false);
    setNumeroBusca(''); 
  };

  const buscarNoCache = async (numeroComanda: string) => {
    setIsLoading(true); setIsOfflineResult(true);
    try {
      const comandaCache = await getComandaCacheByNumeroDB(numeroComanda);
      if (comandaCache) {
        setComandaEncontrada(comandaCache); setError(null);
      } else {
        setError(`Comanda ${numeroComanda} não encontrada no cache local.`); setComandaEncontrada(null);
      }
    } catch (dbErr) {
      console.error("Erro ao buscar no cache:", dbErr);
      setError("Falha ao acessar o cache local."); setComandaEncontrada(null);
    }
    finally { setIsLoading(false); }
  };

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const numeroComandaTrimmed = numeroBusca.trim();
    if (!numeroComandaTrimmed) { setError('Digite o número da comanda.'); limparResultadosBusca(); inputRef.current?.focus(); return; }
    if (!localEntregaCliente.trim()) { setError('Digite o local do pedido.'); limparResultadosBusca(); localInputRef.current?.focus(); return; }
    
    setIsLoading(true);
    limparResultadosBusca();

    if (statusConexao === 'online') {
      try {
        const comandaAPI = await buscarComandaDetalhadaPorNumeroAPI(numeroComandaTrimmed);
        if (comandaAPI) {
          setComandaEncontrada(comandaAPI);
        } else {
          setError(`Comanda ${numeroComandaTrimmed} não encontrada ou não está aberta.`); inputRef.current?.select();
        }
      } catch (err: any) {
        if (err.isAxiosError && !err.response) {
            toast.warn("Falha de comunicação. Tentando no cache...", { autoClose: 2000 });
            await buscarNoCache(numeroComandaTrimmed);
        } else {
            setError(err.response?.data?.message || err.message || `Erro ao buscar comanda.`); inputRef.current?.select();
        }
      } finally { setIsLoading(false); }
    } else {
      toast.info("Buscando no cache local...", { autoClose: 1500 });
      await buscarNoCache(numeroComandaTrimmed);
    }
  };

  const handleNavigateToPedido = () => {
    if (!comandaEncontrada) { toast.error("Nenhuma comanda selecionada."); return; }
    if (!localEntregaCliente.trim()) { toast.error("Local do cliente não foi definido para este pedido."); return; }
    if ('status' in comandaEncontrada && comandaEncontrada.status?.toLowerCase() !== 'aberta') {
        toast.warn(`A comanda ${comandaEncontrada.numero} não está aberta.`); return;
    }
    
    const estadoParaNavegacao = {
      comandaDetalhes: { ...comandaEncontrada },
      localEntregaCliente: localEntregaCliente.trim()
    };
    
    navigate(`/comandas/${comandaEncontrada.id}/novo-pedido`, { state: estadoParaNavegacao });
  };

  return (
    <div className="container mx-auto p-4">
      {/* --- RENDERIZAÇÃO CONDICIONAL --- */}
      {!comandaEncontrada ? (
        // TELA 1: FORMULÁRIO DE BUSCA
        <>
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Buscar Comanda</h1>
          {statusConexao === 'offline' && ( <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 text-sm rounded text-center shadow"> <FiWifiOff className="inline mr-2 mb-0.5"/> Você está offline. Busca no cache local. </div> )}
          
          <form onSubmit={handleSearch} className="mb-6 bg-white p-6 rounded-lg shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="sm:col-span-1">
                    <label htmlFor="numeroComanda" className="block text-sm font-medium text-gray-700 mb-1"> Número Comanda <span className="text-red-500">*</span></label>
                    {/* [ATUALIZAÇÃO] Input Numérico para Busca */}
                    <input 
                      ref={inputRef} 
                      type="number"           
                      inputMode="numeric"     
                      pattern="[0-9]*"        
                      id="numeroComanda" 
                      value={numeroBusca} 
                      onChange={(e)=> setNumeroBusca(e.target.value)} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-lg" 
                      placeholder="Número..." 
                      required 
                    />
                </div>
                <div className="sm:col-span-1">
                    <label htmlFor="localEntrega" className="block text-sm font-medium text-gray-700 mb-1"><FiEdit3 className="inline mr-1 text-gray-500 h-4 w-4 align-text-bottom" /> Local (p/ Pedido) <span className="text-red-500">*</span></label>
                    <input ref={localInputRef} type="text" id="localEntrega" value={localEntregaCliente} onChange={(e) => setLocalEntregaCliente(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-lg" placeholder="Ex: Mesa 7, Balcão" required />
                </div>
                <div className="sm:col-span-1">
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-md shadow-sm flex items-center justify-center disabled:opacity-50"> <FiSearch className="mr-2" /> {isLoading ? 'Buscando...' : 'Buscar'} </button>
                </div>
            </div>
          </form>
        </>
      ) : (
        // TELA 2: RESULTADO DA BUSCA (Permanece a mesma)
        <div>
          <div className="flex justify-between items-center mb-6">
            <button onClick={limparResultadosBusca} className="flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm">
              <FiArrowLeft className="mr-2 h-5 w-5" /> Buscar Outra Comanda
            </button>
            <button onClick={handleNavigateToPedido} disabled={isLoading} className="font-bold py-2.5 px-6 rounded-md shadow-sm flex items-center bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
              <FiPlusCircle className="mr-2" /> Adicionar Pedido
            </button>
          </div>

          <div className={`p-6 rounded-lg shadow-lg border-l-4 ${isOfflineResult ? 'bg-yellow-50 border-yellow-400' : 'bg-green-50 bg-opacity-60 border-green-500'}`}>
            <h2 className={`text-2xl font-semibold mb-4 ${isOfflineResult ? 'text-yellow-800' : 'text-gray-800'}`}>
              {isOfflineResult && <FiWifiOff className="inline mr-2 mb-1"/>} Detalhes da Comanda {comandaEncontrada.numero} {isOfflineResult ? '(Cache)' : ''}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-gray-700">
              {comandaEncontrada.cliente_nome && <div><FiUser className="inline mr-2 text-gray-500"/><strong className="font-medium">Cliente:</strong> {comandaEncontrada.cliente_nome}</div>}
              <div><FiEdit3 className="inline mr-2 text-gray-500"/><strong className="font-medium">Local do Cliente:</strong> {localEntregaCliente}</div>
              
              {('status' in comandaEncontrada && comandaEncontrada.status) && <div className={`font-medium ${comandaEncontrada.status === 'aberta' ? 'text-green-600' : 'text-red-600'}`}><strong className="font-medium text-gray-700">Status:</strong> {comandaEncontrada.status.toUpperCase()}</div>}

              {(() => {
                const total = Number(isOfflineResult ? (comandaEncontrada as ComandaCache).valor_total_calculado : (comandaEncontrada as ComandaDetalhada).total_atual_calculado) || 0;
                return (<div><FiDollarSign className="inline mr-2 text-gray-500"/><strong className="font-medium">Consumo:</strong> R$ {total.toFixed(2).replace('.', ',')}</div>);
              })()}

              {('data_abertura' in comandaEncontrada && comandaEncontrada.data_abertura) && (<div><FiCalendar className="inline mr-2 text-gray-500"/><strong className="font-medium">Abertura:</strong> {formatDateTime(comandaEncontrada.data_abertura)}</div>)}

              {!isOfflineResult && 'itens' in comandaEncontrada && Array.isArray((comandaEncontrada as ComandaDetalhada).itens) && (comandaEncontrada as ComandaDetalhada).itens.length > 0 && (
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2 border-t pt-3 flex items-center"><FiList className="mr-2"/>Itens já registrados:</h3>
                  <ul className="space-y-1 text-sm max-h-48 overflow-y-auto custom-scrollbar pr-2 bg-white/50 p-3 rounded border">
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
          </div>
        </div>
      )}

      {/* Exibição de Erro e Carregamento */}
      <div className="mt-6">
        {isLoading && <LoadingSpinner message="Buscando..." />}
        {error && !isLoading && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow" role="alert">
            <p className="font-bold">Atenção</p>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComandasPage;