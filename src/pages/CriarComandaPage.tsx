// src/pages/CriarComandaPage.tsx
import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { criarNovaComandaAPI } from '../services/comandasService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FiPlusCircle, FiUser, FiHash, FiCheckCircle, FiArrowLeft } from 'react-icons/fi'; // Removido FiMapPin
import { toast } from 'react-toastify';

const CriarComandaPage: React.FC = () => {
  const [numeroNovaComanda, setNumeroNovaComanda] = useState('');
  const [clienteNovaComanda, setClienteNovaComanda] = useState('');
  // Estado para localNovaComanda foi removido

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comandaCriadaInfo, setComandaCriadaInfo] = useState<{ id: number; numero: string } | null>(null);

  const navigate = useNavigate();
  const numeroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    numeroInputRef.current?.focus();
  }, []);

  const handleSubmitNovaComanda = async (e: FormEvent) => {
    e.preventDefault();
    if (!numeroNovaComanda.trim()) {
      toast.error("O número da comanda é obrigatório.");
      setError("O número da comanda é obrigatório.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setComandaCriadaInfo(null);

    try {
      const payload = {
        numero: numeroNovaComanda.trim(),
        cliente_nome: clienteNovaComanda.trim() || null,
        // local_atual não é mais enviado
      };
      console.log("[CriarComandaPage] Enviando payload para criar comanda:", payload);
      const response = await criarNovaComandaAPI(payload);
      
      toast.success(`Comanda ${payload.numero} (ID: ${response.comandaId}) criada com sucesso!`);
      setComandaCriadaInfo({ id: response.comandaId, numero: payload.numero });

      setNumeroNovaComanda('');
      setClienteNovaComanda('');
      // setLocalNovaComanda(''); // Não é mais necessário
      numeroInputRef.current?.focus();

      // Opcional: Navegar para a página de pedido da nova comanda
      // if (confirm(`Comanda ${payload.numero} criada. Deseja adicionar itens agora?`)) {
      //   navigate(`/comandas/${response.comandaId}/novo-pedido`, { 
      //     state: { 
      //       numeroComandaExibicao: payload.numero,
      //       nomeCliente: payload.cliente_nome,
      //       // localAtualComanda: null, // ou um valor padrão se PedidoPage esperar
      //       idComandaDB: response.comandaId,
      //       statusComanda: 'aberta',
      //       totalJaConsumidoState: 0
      //     } 
      //   });
      // }

    } catch (err: any) {
      console.error("[CriarComandaPage] Erro ao criar comanda:", err);
      const errorMessage = err.response?.data?.message || err.message || "Falha ao criar comanda.";
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <button
        onClick={() => navigate(-1)} 
        className="mb-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
      >
        <FiArrowLeft className="mr-2 h-5 w-5" />
        Voltar
      </button>

      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl max-w-lg mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-8 text-center">
          Registrar Nova Comanda
        </h1>

        {comandaCriadaInfo && !error && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-md shadow">
            <div className="flex items-center">
              <FiCheckCircle className="h-6 w-6 mr-3 flex-shrink-0" />
              <div>
                <p className="font-semibold">Comanda Registrada com Sucesso!</p>
                <p className="text-sm">
                  Número: <span className="font-medium">{comandaCriadaInfo.numero}</span> (ID: <span className="font-medium">{comandaCriadaInfo.id}</span>)
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitNovaComanda} className="space-y-6">
          <div>
            <label htmlFor="numeroNovaComanda" className="block text-sm font-semibold text-gray-700 mb-1">
              <FiHash className="inline mr-2 align-text-bottom text-gray-500"/>Número da Comanda <span className="text-red-500">*</span>
            </label>
            <input
              ref={numeroInputRef}
              type="text"
              id="numeroNovaComanda"
              value={numeroNovaComanda}
              onChange={(e) => { setNumeroNovaComanda(e.target.value); setError(null); setComandaCriadaInfo(null); }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="clienteNovaComanda" className="block text-sm font-semibold text-gray-700 mb-1">
              <FiUser className="inline mr-2 align-text-bottom text-gray-500"/>Nome do Cliente (Opcional)
            </label>
            <input
              type="text"
              id="clienteNovaComanda"
              value={clienteNovaComanda}
              onChange={(e) => setClienteNovaComanda(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* O campo de input para Localização Inicial foi removido daqui */}
          
          {error && (
            <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md border border-red-200">{error}</p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-all duration-150 ease-in-out flex items-center justify-center disabled:opacity-60"
            >
              {isSubmitting ? <LoadingSpinner /> : <FiPlusCircle className="mr-2"/>}
              {isSubmitting ? 'Registrando...' : 'Registrar Comanda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CriarComandaPage;