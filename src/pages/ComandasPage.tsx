// src/pages/ComandasPage.tsx

import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarComandaDetalhadaPorNumeroAPI } from '../services/comandasService';
import { getComandaCacheByNumeroDB, ComandaCache } from '../services/dbService';
import { ComandaDetalhada, ItemPedido } from '../types/comanda';
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
  // NOME CORRIGIDO: Este estado guarda o local do cliente informado pelo garçom.
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
  };

  const buscarNoCache = async (numeroComanda: string) => {
    setIsLoading(true); setIsOfflineResult(true);
    try {
      const comandaCache = await getComandaCacheByNumeroDB(numeroComanda);
      if (comandaCache) {
        setComandaEncontrada(comandaCache);
        setError(null);
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
    limparResultadosBusca();

    if (statusConexao === 'online') {
      try {
        const comandaAPI = await buscarComandaDetalhadaPorNumeroAPI(numeroComandaTrimmed);
        if (comandaAPI) {
          setComandaEncontrada(comandaAPI);
          if (!localEntregaCliente.trim()) {
            localInputRef.current?.focus();
          }
        } else {
          setError(`Comanda ${numeroComandaTrimmed} não encontrada ou não está aberta.`);
          inputRef.current?.select();
        }
      } catch (err: any) {
        if (err.isAxiosError && !err.response) {
            toast.warn("Falha de comunicação. Tentando buscar no cache...", { autoClose: 2000 });
            await buscarNoCache(numeroComandaTrimmed);
        } else {
            setError(err.response?.data?.message || err.message || `Erro ao buscar comanda.`);
            inputRef.current?.select();
        }
      } finally { setIsLoading(false); }
    } else {
      toast.info("Buscando no cache local...", { autoClose: 1500 });
      await buscarNoCache(numeroComandaTrimmed);
    }
  };

  const handleNavigateToPedido = () => {
    if (!comandaEncontrada) {
        toast.error("Nenhuma comanda selecionada.");
        return;
    }

    const idParaUrl = comandaEncontrada.id;
    const localInformadoPeloGarcom = localEntregaCliente.trim();

    if (!localInformadoPeloGarcom) {
      toast.error("Por favor, informe o 'Local (p/ Pedido)' antes de prosseguir.");
      localInputRef.current?.focus();
      return;
    }

    if ('status' in comandaEncontrada && comandaEncontrada.status?.toLowerCase() !== 'aberta') {
        toast.warn(`A comanda ${comandaEncontrada.numero} não está aberta (Status: ${comandaEncontrada.status}).`);
        return;
    }

    // --- CORREÇÃO PRINCIPAL AQUI ---
    // Monta o objeto 'state' com a chave correta que a PedidoPage espera.
    const estadoParaNavegacao = {
      comandaDetalhes: { ...comandaEncontrada },
      localEntregaCliente: localInformadoPeloGarcom // NOME CORRIGIDO
    };

    console.log("[ComandasPage] Navegando para PedidoPage com state:", JSON.stringify(estadoParaNavegacao, null, 2));
    navigate(`/comandas/${idParaUrl}/novo-pedido`, { state: estadoParaNavegacao });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Buscar Comanda</h1>
      {statusConexao === 'offline' && ( <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 text-sm rounded text-center shadow"> <FiWifiOff className="inline mr-2 mb-0.5"/> Você está offline. Busca no cache local. </div> )}
      
      <form onSubmit={handleSearch} className="mb-6 bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-1">
                <label htmlFor="numeroComanda" className="block text-sm font-medium text-gray-700 mb-1"> Número Comanda <span className="text-red-500">*</span></label>
                <input ref={inputRef} type="text" id="numeroComanda" value={numeroBusca} onChange={(e)=> setNumeroBusca(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Número..." required />
            </div>
            <div className="sm:col-span-1">
                <label htmlFor="localEntrega" className="block text-sm font-medium text-gray-700 mb-1"><FiEdit3 className="inline mr-1 text-gray-500 h-4 w-4 align-text-bottom" /> Local (p/ Pedido) <span className="text-red-500">*</span></label>
                <input ref={localInputRef} type="text" id="localEntrega" value={localEntregaCliente} onChange={(e) => setLocalEntregaCliente(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Mesa 7, Balcão" required />
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
              {/* ... JSX para exibir os detalhes da comanda ... */}
            </div>
            <div className="mt-6 text-right">
              <button
                onClick={handleNavigateToPedido}
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