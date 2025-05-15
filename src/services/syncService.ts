// src/services/syncService.ts
import {
  getPedidosOfflineDB,
  updatePedidoOfflineDB,
  deletePedidoOfflineDB,
} from './dbService'; // PedidoOffline (tipo) removido daqui
import { criarPedido } from './pedidoService';
import { PedidoInput, PedidoOfflinePayload, ItemParaBackend } from '../types/pedido'; // Importa PedidoOfflinePayload
import { sincronizarComandasAbertasAPI } from './comandasService';

let isSyncing = false;
let globalSyncError: string | null = null;
let lastSyncResults: {
    comandasAbertas?: string | number;
    pedidos?: string | { sucesso: number; falha: number; total: number; erros: Array<{ idLocal: string; mensagem: string }> };
} | null = null;

let onSyncStatusChangeCallback: ((status: { isSyncing: boolean, error: string | null, lastResults?: any }) => void) | null = null;

const notifyUI = () => {
    if (onSyncStatusChangeCallback) {
        onSyncStatusChangeCallback({
            isSyncing,
            error: globalSyncError,
            lastResults: lastSyncResults
        });
    }
};

// Mapeia PedidoOfflinePayload para o formato que a API de criarPedido espera (PedidoInput)
const mapPedidoOfflineToPedidoInput = (pedidoOffline: PedidoOfflinePayload): PedidoInput => {
  // Remove campos específicos do offline que não vão para a API de criação
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    localId,
    timestamp,
    statusSync,
    tentativasSync,
    mensagemErroSync,
    // Os campos restantes devem corresponder ao PedidoInput ou serem mapeados
    // comandaNumero, usuario_id, local_pedido, observacao_geral, itens
    ...rest
  } = pedidoOffline;

  // Assume que `rest` já tem `comandaNumero` como `comandaIdentifier` (ou precisa de ajuste)
  // e que `rest.itens` está no formato `ItemPedidoOffline[]`
  // Precisamos mapear `rest.itens` para `ItemParaBackend[]`
  const itensParaApi: ItemParaBackend[] = rest.itens.map(itemOffline => ({
    produto_id: itemOffline.produto_id,
    quantidade: itemOffline.quantidade,
    preco_unitario_momento: itemOffline.preco_unitario_momento,
    observacao_item: itemOffline.observacao_item,
  }));

  return {
    comandaIdentifier: parseInt(rest.comandaNumero), // API espera número? Se sim, converter.
    usuario_id: rest.usuario_id,
    local_pedido: rest.local_pedido,
    observacao_geral: rest.observacao_geral,
    itens: itensParaApi,
  };
};

export const sincronizarPedidosPendentes = async (): Promise<{
  sucesso: number;
  falha: number;
  total: number;
  erros: Array<{ idLocal: string; mensagem: string }>;
}> => {
  console.log('SINCRONIZAÇÃO (PEDIDOS): Iniciando busca por pedidos offline...');
  const resultados = { sucesso: 0, falha: 0, total: 0, erros: [] as Array<{ idLocal: string; mensagem: string }>};

  try {
    const pedidosParaSincronizar: PedidoOfflinePayload[] = await getPedidosOfflineDB();
    resultados.total = pedidosParaSincronizar.length;

    if (resultados.total === 0) {
      console.log('SINCRONIZAÇÃO (PEDIDOS): Nenhum pedido pendente.');
    } else {
      console.log(`SINCRONIZAÇÃO (PEDIDOS): ${resultados.total} pedidos para sincronizar.`);
      for (const pedidoOffline of pedidosParaSincronizar) {
        // Usa 'erro' em vez de 'falhou' e 'tentativasSync'
        if (pedidoOffline.statusSync === 'pendente' || (pedidoOffline.statusSync === 'erro' && (pedidoOffline.tentativasSync || 0) < 5)) {
          let pedidoAtualizado: PedidoOfflinePayload = {
            ...pedidoOffline,
            statusSync: 'enviando', // 'enviando' deve estar no tipo PedidoOfflinePayload.statusSync
            tentativasSync: (pedidoOffline.tentativasSync || 0) + 1
          };
          await updatePedidoOfflineDB(pedidoAtualizado);
          console.log(`SINCRONIZAÇÃO (PEDIDOS): Enviando ID: ${pedidoOffline.localId}, Tentativa: ${pedidoAtualizado.tentativasSync}`); // Usa localId
          try {
            const pedidoPayloadParaAPI = mapPedidoOfflineToPedidoInput(pedidoOffline);
            await criarPedido(pedidoPayloadParaAPI); // Envia para a API
            await deletePedidoOfflineDB(pedidoOffline.localId); // Usa localId
            console.log(`SINCRONIZAÇÃO (PEDIDOS): ID: ${pedidoOffline.localId} sincronizado.`); // Usa localId
            resultados.sucesso++;
          } catch (error: any) {
            const msgErro = error.response?.data?.message || error.message || 'Erro desconhecido ao sincronizar pedido.';
            console.error(`SINCRONIZAÇÃO (PEDIDOS): Falha ID: ${pedidoOffline.localId}. Erro: ${msgErro}`); // Usa localId
            // Usa 'erro' e 'mensagemErroSync'
            await updatePedidoOfflineDB({ ...pedidoAtualizado, statusSync: 'erro', mensagemErroSync: msgErro.substring(0, 255) });
            resultados.falha++;
            resultados.erros.push({ idLocal: pedidoOffline.localId, mensagem: msgErro }); // Usa localId
          }
        } else if (pedidoOffline.statusSync === 'erro') { // Usa 'erro'
          console.warn(`SINCRONIZAÇÃO (PEDIDOS): ID: ${pedidoOffline.localId} no limite de tentativas ou já marcado com erro.`); // Usa localId
        }
      }
    }
  } catch (dbError: any) {
    console.error('SINCRONIZAÇÃO (PEDIDOS): Erro crítico DB:', dbError);
    throw dbError;
  }
  console.log(`SINCRONIZAÇÃO (PEDIDOS): Concluído. S: ${resultados.sucesso}, F: ${resultados.falha}, T: ${resultados.total}.`);
  return resultados;
};

export const getSyncStatus = (): { isSyncing: boolean, error: string | null, lastResults?: any } => ({
    isSyncing,
    error: globalSyncError,
    lastResults: lastSyncResults
});

export const onSyncStatusChange = (callback: ((status: { isSyncing: boolean, error: string | null, lastResults?: any }) => void) | null ): (() => void) => {
    onSyncStatusChangeCallback = callback;
    return () => {
        if (onSyncStatusChangeCallback === callback) {
            onSyncStatusChangeCallback = null;
        }
    };
};

export const trySincronizarEInformar = async () => {
    if (!navigator.onLine) {
        console.log("SINCRONIZAÇÃO GERAL: Offline, não pode sincronizar.");
        globalSyncError = "Offline, sincronização não realizada.";
        lastSyncResults = null;
        isSyncing = false;
        notifyUI();
        return;
    }

    if (isSyncing) {
         console.log("SINCRONIZAÇÃO GERAL: Tentativa de iniciar, mas já está em andamento.");
         return;
    }

    isSyncing = true;
    globalSyncError = null;
    lastSyncResults = { comandasAbertas: 'aguardando...', pedidos: 'aguardando...' };
    notifyUI();
    console.log("SINCRONIZAÇÃO GERAL: Iniciando...");

    let numComandasSincronizadas = 0;
    let resultadosPedidosObj = { sucesso: 0, falha: 0, total: 0, erros: [] as Array<{ idLocal: string; mensagem: string }> };

    try {
        console.log("SINCRONIZAÇÃO GERAL: Sincronizando comandas abertas...");
        try {
            numComandasSincronizadas = await sincronizarComandasAbertasAPI();
            lastSyncResults.comandasAbertas = `${numComandasSincronizadas} comandas sincronizadas`;
        } catch (comandasError: any) {
            console.error("SINCRONIZAÇÃO GERAL: Erro ao sincronizar comandas abertas:", comandasError);
            lastSyncResults.comandasAbertas = "Falha ao sincronizar comandas";
            globalSyncError = globalSyncError ? `${globalSyncError}; Falha comandas` : "Falha ao sincronizar comandas";
        }
        notifyUI();

        console.log("SINCRONIZAÇÃO GERAL: Sincronizando pedidos pendentes...");
        try {
            resultadosPedidosObj = await sincronizarPedidosPendentes();
            lastSyncResults.pedidos = `${resultadosPedidosObj.sucesso} sucesso(s), ${resultadosPedidosObj.falha} falha(s) de ${resultadosPedidosObj.total}`;
            if (resultadosPedidosObj.falha > 0) {
                globalSyncError = globalSyncError ? `${globalSyncError}; Falha pedidos` : "Alguns pedidos falharam ao sincronizar.";
            }
        } catch (pedidosError: any) {
            console.error("SINCRONIZAÇÃO GERAL: Erro ao sincronizar pedidos pendentes:", pedidosError);
            lastSyncResults.pedidos = "Falha ao sincronizar pedidos";
            globalSyncError = globalSyncError ? `${globalSyncError}; Falha pedidos` : "Falha ao sincronizar pedidos";
        }
        notifyUI();

    } catch (geralError: any) {
        console.error("SINCRONIZAÇÃO GERAL: Erro inesperado durante o processo:", geralError);
        globalSyncError = geralError.message || "Erro geral inesperado durante a sincronização.";
    } finally {
        isSyncing = false;
        console.log("SINCRONIZAÇÃO GERAL: Processo finalizado.");
        notifyUI();
    }
};

console.log('syncService.ts carregado.');