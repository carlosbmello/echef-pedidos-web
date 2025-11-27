// src/services/comandasService.ts
import apiClient from '../config/api';
import { 
    Comanda,                
    ComandaCache, 
    ComandaDetalhada, 
    ComandaSearchResult     
} from '../types/comanda';
import { bulkReplaceComandasCacheDB, setConfig } from './dbService';

// [CORREÇÃO] Não lemos mais o .env aqui. Usamos caminho relativo.
// O apiClient já sabe que deve ir para '.../api/admin'
const COMANDAS_PATH = '/comandas'; 

// Tipos para Payload e Resposta
interface NovaComandaPayload {
  numero: string;
  cliente_nome?: string | null;
}

interface NovaComandaResponse {
  message: string;
  comandaId: number;
}

// --- FUNÇÃO PARA CRIAR NOVA COMANDA ---
export const criarNovaComandaAPI = async (payload: NovaComandaPayload): Promise<NovaComandaResponse> => {
  console.log("[comandasService] Enviando para criar nova comanda:", payload);
  try {
    // Agora vai para: .../api/admin/comandas/
    const response = await apiClient.post<NovaComandaResponse>(`${COMANDAS_PATH}/`, payload); 
    return response.data;
  } catch (error: any) {
    console.error("Erro no serviço ao criar nova comanda:", error);
    throw error; 
  }
};

// --- Função para buscar UMA comanda detalhada por NÚMERO ---
export const buscarComandaDetalhadaPorNumeroAPI = async (numeroComanda: string): Promise<ComandaDetalhada | null> => {
    console.log(`[comandasService] Buscando detalhes completos para comanda Nº ${numeroComanda}...`);
    try {
        const response = await apiClient.get<ComandaDetalhada>(`${COMANDAS_PATH}/numero/${numeroComanda}`);
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return null; 
        }
        console.error(`Erro ao buscar comanda detalhada Nº ${numeroComanda}:`, error);
        throw error; 
    }
};

// --- Função para buscar UMA comanda detalhada por ID ---
export const buscarComandaDetalhadaPorIdAPI = async (comandaId: number): Promise<ComandaDetalhada | null> => {
    console.log(`[comandasService] Buscando detalhes completos para comanda ID ${comandaId}...`);
    try {
        const response = await apiClient.get<ComandaDetalhada>(`${COMANDAS_PATH}/id/${comandaId}`);
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        console.error(`Erro ao buscar comanda detalhada ID ${comandaId}:`, error);
        throw error;
    }
};


// --- Função para SINCRONIZAR Comandas Abertas ---
export const sincronizarComandasAbertasAPI = async (): Promise<number> => {
  console.log("COMANDAS_SVC: Sincronizando comandas abertas da API...");
  try {
    const response = await apiClient.get<Comanda[]>(`${COMANDAS_PATH}`, { 
      params: {
       status: 'aberta',
      }
    });

    const comandasDaAPI = response.data;

    if (Array.isArray(comandasDaAPI)) {
      const comandasParaCache: ComandaCache[] = comandasDaAPI.map(c => ({
        id: c.id,
        numero: c.numero,
        cliente_nome: c.cliente_nome,
        local_atual: c.local_atual || c.localizacao_cliente, 
        data_abertura: c.data_abertura,
        status: c.status, 
        valor_total_calculado: 
            c.total_atual_calculado !== undefined ? c.total_atual_calculado : 
            (typeof c.valor_total_calculado === 'string' ? parseFloat(c.valor_total_calculado) :
            (typeof c.valor_total_calculado === 'number' ? c.valor_total_calculado : null)),
      }));

      await bulkReplaceComandasCacheDB(comandasParaCache);
      await setConfig('lastComandasAbertasSync', Date.now());
      console.log(`COMANDAS_SVC: ${comandasParaCache.length} comandas abertas sincronizadas para o cache local.`);
      return comandasParaCache.length;
    } else {
      console.error("COMANDAS_SVC: Resposta da API para comandas abertas não é um array.");
      return 0;
    }
  } catch (error) {
    console.error("COMANDAS_SVC: Erro ao sincronizar comandas abertas:", error);
    return 0;
  }
};

// --- Função legada (se ainda usada) ---
export const fetchComandaByNumero = async (numeroComanda: string): Promise<ComandaSearchResult> => {
  try {
    const response = await apiClient.get<Comanda[]>(`${COMANDAS_PATH}`, {
      params: { numero: numeroComanda, status: 'aberta' }
    });
    if (response.data && response.data.length > 0) {
      return response.data[0]; 
    }
    return null; 
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
        return null; 
    }
    console.error(`Erro ao buscar comanda (simples) por número ${numeroComanda}:`, error);
    throw error; 
  }
};