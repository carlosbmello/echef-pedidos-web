import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Produto, Categoria, Subcategoria, GrupoOpcoes } from '../types/cardapio';
import { PedidoOfflinePayload } from '../types/pedido';

const DB_NAME = 'eChefPedidosDB';
// A versão foi incrementada para acionar a atualização do schema
const DB_VERSION = 6;

export interface ComandaCache {
  id: number;
  numero: string;
  cliente_nome?: string | null;
  local_atual?: string | null;
  data_abertura?: string | null;
  valor_total_calculado?: number | null;
}

// O schema agora inclui a nova "tabela" para os grupos de opções
interface EChefDBSchema extends DBSchema {
  config: { key: string; value: any; };
  categorias: { key: number; value: Categoria; indexes: { 'nome': string }; };
  subcategorias: { key: number; value: Subcategoria; indexes: { 'categoria_id': number; 'nome': string }; };
  produtos: { key: number; value: Produto; indexes: { 'categoria_id': number; 'subcategoria_id': number; 'nome': string }; };
  grupos_opcoes: { key: number; value: GrupoOpcoes; indexes: { 'nome_grupo': string }; };
  pedidosOffline: { key: string; value: PedidoOfflinePayload; indexes: { 'timestamp': number; 'statusSync': string }; };
  comandas_abertas_cache: { key: string; value: ComandaCache; indexes: { 'id': number }; };
}

let dbPromise: Promise<IDBPDatabase<EChefDBSchema>>;

const initDB = () => {
  if (!dbPromise) {
    console.log("DB: Iniciando openDB para", DB_NAME, "v", DB_VERSION);
    dbPromise = openDB<EChefDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`DB: UPGRADE de v${oldVersion} para v${DB_VERSION}`);
        
        if (oldVersion < 1) {
          console.log("DB: Aplicando schema v1 (config, categorias, subcategorias, produtos)");
          if (!db.objectStoreNames.contains('config')) { db.createObjectStore('config'); }
          if (!db.objectStoreNames.contains('categorias')) { const s = db.createObjectStore('categorias', { keyPath: 'id' }); s.createIndex('nome', 'nome'); }
          if (!db.objectStoreNames.contains('subcategorias')) { const s = db.createObjectStore('subcategorias', { keyPath: 'id' }); s.createIndex('categoria_id', 'categoria_id'); s.createIndex('nome', 'nome'); }
          if (!db.objectStoreNames.contains('produtos')) { const s = db.createObjectStore('produtos', { keyPath: 'id' }); s.createIndex('categoria_id', 'categoria_id'); s.createIndex('subcategoria_id', 'subcategoria_id', { multiEntry: true }); s.createIndex('nome', 'nome');}
        }
        if (oldVersion < 2) {
          console.log("DB: Aplicando schema v2 (pedidosOffline)");
          if (!db.objectStoreNames.contains('pedidosOffline')) {
            const pedidosStore = db.createObjectStore('pedidosOffline', { keyPath: 'id_local' });
            pedidosStore.createIndex('timestamp', 'timestamp');
            pedidosStore.createIndex('statusSync', 'statusSync');
          }
        }
        if (oldVersion < 3) {
          console.log("DB: Aplicando schema v3 (comandas_abertas_cache)");
          if (!db.objectStoreNames.contains('comandas_abertas_cache')) {
            const comandaCacheStore = db.createObjectStore('comandas_abertas_cache', { keyPath: 'numero' });
            comandaCacheStore.createIndex('id', 'id', { unique: true });
          }
        }
        // [NOVA MIGRAÇÃO]
        if (oldVersion < 6) {
            console.log("DB: Aplicando schema v6 (grupos_opcoes)");
            if (!db.objectStoreNames.contains('grupos_opcoes')) {
                const store = db.createObjectStore('grupos_opcoes', { keyPath: 'id' });
                store.createIndex('nome_grupo', 'nome_grupo');
                console.log("DB: Store 'grupos_opcoes' criada.");
            }
        }

        // Bloco de verificação, mantido por segurança
        if (transaction && db.objectStoreNames.contains('pedidosOffline')) {
            const pedidosStore = transaction.objectStore('pedidosOffline');
            if (pedidosStore.keyPath !== 'id_local') { // Corrigido para 'id_local'
                console.error("DB: ALERTA CRÍTICO! KeyPath da store 'pedidosOffline' é inválida.");
            }
        }
      },
    });
    dbPromise.then(() => console.log("DB: Conexão IndexedDB estabelecida com sucesso."))
             .catch(err => console.error("DB: FALHA GRAVE ao estabelecer conexão com IndexedDB:", err));
  }
  return dbPromise;
};

initDB();

export const getConfig = async (key: string): Promise<any> => { const db = await initDB(); return db.get('config', key); };
export const setConfig = async (key: string, value: any): Promise<void> => { const db = await initDB(); await db.put('config', value, key);};

export const getCategoriasDB = async (): Promise<Categoria[]> => { const db = await initDB(); return db.getAll('categorias'); };
export const bulkPutCategoriasDB = async (categorias: Categoria[]): Promise<void> => { const db = await initDB(); const tx = db.transaction('categorias', 'readwrite'); await Promise.all(categorias.map(cat => tx.store.put(cat))); await tx.done; };
export const getSubcategoriasDB = async (): Promise<Subcategoria[]> => { const db = await initDB(); return db.getAll('subcategorias'); };
export const bulkPutSubcategoriasDB = async (subcategorias: Subcategoria[]): Promise<void> => { const db = await initDB(); const tx = db.transaction('subcategorias', 'readwrite'); await Promise.all(subcategorias.map(subcat => tx.store.put(subcat))); await tx.done; };
export const getProdutosDB = async (): Promise<Produto[]> => { const db = await initDB(); return db.getAll('produtos'); };
export const bulkPutProdutosDB = async (produtos: Produto[]): Promise<void> => { const db = await initDB(); const tx = db.transaction('produtos', 'readwrite'); await Promise.all(produtos.map(prod => tx.store.put(prod))); await tx.done; };

// --- [NOVAS FUNÇÕES IMPLEMENTADAS] ---
/**
 * Busca todos os grupos de opções do IndexedDB.
 */
export const getGruposDeOpcoesDB = async (): Promise<GrupoOpcoes[]> => {
    const db = await initDB();
    return db.getAll('grupos_opcoes');
};

/**
 * Salva uma lista de grupos de opções no IndexedDB.
 */
export const bulkPutGruposDeOpcoesDB = async (grupos: GrupoOpcoes[]): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction('grupos_opcoes', 'readwrite');
    await Promise.all(grupos.map(grupo => tx.store.put(grupo)));
    await tx.done;
};

export const salvarPedidoParaSincronizacaoDB = async (pedido: PedidoOfflinePayload): Promise<string> => {
  try {
    const db = await initDB();
    if (!pedido.id_local) {
        throw new Error("Pedido Offline não pode ser salvo sem um id_local.");
    }
    await db.put('pedidosOffline', pedido);
    return pedido.id_local;
  } catch (error) {
    console.error("DB_SAVE: Erro dentro de salvarPedidoParaSincronizacaoDB:", error);
    throw error;
  }
};

export const getPedidosOfflineDB = async (): Promise<PedidoOfflinePayload[]> => { const db = await initDB(); return db.getAllFromIndex('pedidosOffline', 'timestamp'); };
export const getPedidoOfflineByIdDB = async (localId: string): Promise<PedidoOfflinePayload | undefined> => { const db = await initDB(); return db.get('pedidosOffline', localId);};
export const deletePedidoOfflineDB = async (localId: string): Promise<void> => { const db = await initDB(); await db.delete('pedidosOffline', localId); console.log(`DB: Pedido Offline ${localId} deletado.`); };
export const updatePedidoOfflineDB = async (pedido: PedidoOfflinePayload): Promise<string> => { const db = await initDB(); await db.put('pedidosOffline', pedido); console.log(`DB: Pedido Offline ${pedido.id_local} atualizado.`); return pedido.id_local; };

export const getComandaCacheByNumeroDB = async (numeroComanda: string): Promise<ComandaCache | undefined> => { const db = await initDB(); return db.get('comandas_abertas_cache', numeroComanda);};
export const getAllComandasCacheDB = async (): Promise<ComandaCache[]> => { const db = await initDB(); return db.getAll('comandas_abertas_cache');};
export const bulkReplaceComandasCacheDB = async (comandas: ComandaCache[]): Promise<void> => { const db = await initDB(); const tx = db.transaction('comandas_abertas_cache', 'readwrite'); await tx.store.clear(); for (const comanda of comandas) { if (comanda.id && comanda.numero) { await tx.store.put(comanda); } else { console.warn("DB: Tentativa de adicionar comanda inválida ao cache:", comanda); }} await tx.done; console.log("DB: Cache de comandas abertas atualizado com", comandas.length, "registros.");};

console.log(`dbService.ts carregado. DB (v${DB_VERSION}) inicialização iniciada.`);