// src/services/comandaService.ts
import apiClient from '../config/api';
import { Comanda, ComandaSearchResult } from '../types/comanda';
import { Comanda as ComandaCompletaAPI } from '../types/comanda';
import { ComandaCache, bulkReplaceComandasCacheDB, setConfig } from './dbService';
import { ComandaBasica, ComandaDetalhada } from '../types/comanda'; 



const API_URL = `${import.meta.env.VITE_API_BASE_URL}/comandas`;

// Busca uma comanda específica pelo número (apenas se estiver aberta)
export const fetchComandaByNumero = async (numeroComanda: string): Promise<ComandaSearchResult> => {
  try {
    // Ajuste o endpoint e parâmetros conforme a definição da sua API
    // Exemplo: /comandas?numero=123&status=aberta
    // A API deve retornar um array (mesmo que vazio ou com 1 elemento) ou um objeto direto?
    // Assumindo que retorna um array e pegamos o primeiro (ou null)
    const response = await apiClient.get<Comanda[]>(`/comandas`, {
      params: {
        numero: numeroComanda,
        status: 'aberta' // Garante que só buscamos comandas abertas
      }
    });

    if (response.data && response.data.length > 0) {
      return response.data[0]; // Retorna a primeira comanda encontrada
    }
    return null; // Nenhuma comanda aberta encontrada com esse número
  } catch (error: any) {
    // Tratar erros específicos se necessário (ex: 404 não é um erro de rede)
    if (error.response && error.response.status === 404) {
        return null; // Comanda não encontrada
    }
    console.error('Erro ao buscar comanda por número:', error);
    throw error; // Re-throw para o componente tratar (ex: mostrar mensagem de erro de rede)
  }
};


// Função para buscar UMA comanda por NÚMERO com todos os detalhes e itens
export const buscarComandaDetalhadaPorNumeroAPI = async (numeroComanda: string): Promise<ComandaDetalhada | null> => {
    console.log(`[comandaService] Buscando detalhes completos para comanda Nº ${numeroComanda}...`);
    try {
        const response = await apiClient.get<ComandaDetalhada>(`${API_URL}/numero/${numeroComanda}`);
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return null; // Comanda não encontrada
        }
        console.error(`Erro ao buscar comanda detalhada Nº ${numeroComanda}:`, error);
        throw error; // Relança para a UI tratar
    }
};

// Função para buscar UMA comanda por ID com todos os detalhes e itens
export const buscarComandaDetalhadaPorIdAPI = async (comandaId: number): Promise<ComandaDetalhada | null> => {
    console.log(`[comandaService] Buscando detalhes completos para comanda ID ${comandaId}...`);
    try {
        const response = await apiClient.get<ComandaDetalhada>(`${API_URL}/id/${comandaId}`);
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        console.error(`Erro ao buscar comanda detalhada ID ${comandaId}:`, error);
        throw error;
    }
};


// --- NOVA FUNÇÃO PARA SINCRONIZAR COMANDAS ABERTAS ---
 export const sincronizarComandasAbertasAPI = async (): Promise<number> => {
  console.log("COMANDAS_SVC: Sincronizando comandas abertas da API...");
  try {
    // Busca da API apenas os campos necessários para o cache
    // A API do backend /comandas precisa suportar um query param como 'fields' ou retornar
    // uma versão simplificada se outro endpoint for usado.
    // Assumindo que /comandas?status=aberta retorna objetos completos.
    const response = await apiClient.get<ComandaCompletaAPI[]>('/comandas', {
      params: {
       status: 'aberta',
        // Opcional: Se sua API suportar seleção de campos para otimizar:
        // fields: 'id,numero,cliente_nome' // Exemplo
      }
    });

    const comandasDaAPI = response.data;

    if (Array.isArray(comandasDaAPI)) {
      const comandasParaCache: ComandaCache[] = comandasDaAPI.map(c => ({
        id: c.id,
        numero: c.numero,
        cliente_nome: c.cliente_nome, // Mapeia se existir em ComandaCompletaAPI
        local_atual: c.localizacao_cliente, // Mapeia se existir (ou o nome do campo na API)
        data_abertura: c.data_abertura, // Mapeia se existir
        // A API retorna valor_total_calculado como string, precisamos converter para número
        valor_total_calculado: typeof c.valor_total_calculado === 'string'
            ? parseFloat(c.valor_total_calculado)
            : (typeof c.valor_total_calculado === 'number' ? c.valor_total_calculado : null),
      }));

      await bulkReplaceComandasCacheDB(comandasParaCache);
      await setConfig('lastComandasAbertasSync', Date.now()); // Atualiza timestamp da sincronização
      console.log(`COMANDAS_SVC: ${comandasParaCache.length} comandas abertas sincronizadas para o cache local.`);
      return comandasParaCache.length;
    } else {
      console.error("COMANDAS_SVC: Resposta da API para comandas abertas não é um array.");
      return 0;
    }
  } catch (error) {
    console.error("COMANDAS_SVC: Erro ao sincronizar comandas abertas:", error);
    // Não lançar erro aqui para não quebrar o fluxo de sync geral se esta parte falhar
    return 0; // Indica que 0 comandas foram sincronizadas devido ao erro
  }
};