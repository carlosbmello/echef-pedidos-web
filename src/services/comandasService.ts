// src/services/comandasService.ts
import apiClient from '../config/api';
import { 
    Comanda,                // Para o tipo de retorno da API de lista (ex: GET /comandas)
    ComandaCache, 
    ComandaDetalhada, 
    ComandaSearchResult     // Que agora é Comanda | null
} from '../types/comanda';
import { bulkReplaceComandasCacheDB, setConfig } from './dbService';

const API_URL_BASE = `${import.meta.env.VITE_API_BASE_URL}`; // URL base da API
const API_COMANDAS_ENDPOINT = `${API_URL_BASE}/comandas`; // Endpoint específico de comandas

// Tipos para Payload e Resposta da Criação de Nova Comanda
interface NovaComandaPayload {
  numero: string;
  cliente_nome?: string | null;
  // local_atual foi removido, pois você indicou que não é informado na criação
}

interface NovaComandaResponse {
  message: string;
  comandaId: number;
  // comanda?: Comanda; // Opcional: se a API retornar o objeto criado
}

// --- FUNÇÃO PARA CRIAR NOVA COMANDA ---
export const criarNovaComandaAPI = async (payload: NovaComandaPayload): Promise<NovaComandaResponse> => {
  console.log("[comandasService] Enviando para criar nova comanda:", payload);
  try {
    const response = await apiClient.post<NovaComandaResponse>(`${API_COMANDAS_ENDPOINT}/`, payload); // POST para /api/comandas/
    return response.data;
  } catch (error: any) {
    console.error("Erro no serviço ao criar nova comanda:", error);
    throw error; 
  }
};

// --- Função para buscar UMA comanda específica por NÚMERO (usada na ComandasPage ao buscar) ---
// Esta função deve retornar ComandaDetalhada se você quiser exibir os itens já na ComandasPage.
export const buscarComandaDetalhadaPorNumeroAPI = async (numeroComanda: string): Promise<ComandaDetalhada | null> => {
    console.log(`[comandasService] Buscando detalhes completos para comanda Nº ${numeroComanda}...`);
    try {
        // Chama a rota específica do backend para busca por número
        const response = await apiClient.get<ComandaDetalhada>(`${API_COMANDAS_ENDPOINT}/numero/${numeroComanda}`);
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return null; 
        }
        console.error(`Erro ao buscar comanda detalhada Nº ${numeroComanda}:`, error);
        throw error; 
    }
};

// --- Função para buscar UMA comanda por ID com todos os detalhes e itens (usada na PedidoPage) ---
export const buscarComandaDetalhadaPorIdAPI = async (comandaId: number): Promise<ComandaDetalhada | null> => {
    console.log(`[comandasService] Buscando detalhes completos para comanda ID ${comandaId}...`);
    try {
        // Chama a rota específica do backend para busca por ID
        const response = await apiClient.get<ComandaDetalhada>(`${API_COMANDAS_ENDPOINT}/id/${comandaId}`);
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
 // Usada para popular o cache local com dados básicos das comandas abertas.
export const sincronizarComandasAbertasAPI = async (): Promise<number> => {
  console.log("COMANDAS_SVC: Sincronizando comandas abertas da API...");
  try {
    // A API GET /api/comandas?status=aberta retorna um array de objetos Comanda.
    // O tipo Comanda (definido em comanda.ts) deve refletir a estrutura desses objetos.
    const response = await apiClient.get<Comanda[]>(`${API_COMANDAS_ENDPOINT}`, { // GET para /api/comandas
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
        // O tipo Comanda pode ter local_atual ou localizacao_cliente.
        // O tipo ComandaCache espera local_atual.
        local_atual: c.local_atual || c.localizacao_cliente, 
        data_abertura: c.data_abertura,
        status: c.status, // Mapeia o status para o cache
        // O tipo Comanda pode ter valor_total_calculado (string/number) ou total_atual_calculado (number).
        // O tipo ComandaCache espera valor_total_calculado (number | null).
        valor_total_calculado: 
            c.total_atual_calculado !== undefined ? c.total_atual_calculado : // Prioriza se existir
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


// Se você ainda usa fetchComandaByNumero em algum lugar para uma busca mais simples
// e ela retorna um tipo diferente de ComandaDetalhada, mantenha-a, mas
// certifique-se que o tipo ComandaSearchResult e Comanda estão corretos.
// Se ela não for mais usada, pode ser removida.
// Por segurança, vou mantê-la aqui, mas a busca principal na ComandasPage agora usa buscarComandaDetalhadaPorNumeroAPI.
export const fetchComandaByNumero = async (numeroComanda: string): Promise<ComandaSearchResult> => {
  try {
    const response = await apiClient.get<Comanda[]>(`${API_COMANDAS_ENDPOINT}`, {
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