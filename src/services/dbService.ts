// src/services/dbService.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Produto, Categoria, Subcategoria } from '../types/cardapio';
import { PedidoOfflinePayload } from '../types/pedido'; // Importação centralizada

const DB_NAME = 'eChefPedidosDB';
const DB_VERSION = 4;

export interface ComandaCache {
  id: number;
  numero: string;
  cliente_nome?: string | null;
  local_atual?: string | null;
  data_abertura?: string | null;
  valor_total_calculado?: number | null;
}

interface EChefDBSchema extends DBSchema {
  config: { key: string; value: any; };
  categorias: { key: number; value: Categoria; indexes: { 'nome': string }; };
  subcategorias: { key: number; value: Subcategoria; indexes: { 'categoria_id': number; 'nome': string }; };
  produtos: { key: number; value: Produto; indexes: { 'categoria_id': number; 'subcategoria_id': number; 'nome': string }; };
  pedidosOffline: { key: string; value: PedidoOfflinePayload; indexes: { 'timestamp': number; 'statusSync': string }; };
  comandas_abertas_cache: { key: string; value: ComandaCache; indexes: { 'id': number }; };
}

let dbPromise: Promise<IDBPDatabase<EChefDBSchema>>;

const initDB = () => {
  if (!dbPromise) {
    console.log("DB: Iniciando openDB para", DB_NAME, "v", DB_VERSION);
    dbPromise = openDB<EChefDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) { // Renomeado _transaction para transaction
        console.log(`DB: UPGRADE de v${oldVersion} para v${newVersion}`);
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
            const pedidosStore = db.createObjectStore('pedidosOffline', { keyPath: 'localId' }); // CRUCIAL: keyPath é 'localId'
            pedidosStore.createIndex('timestamp', 'timestamp');
            pedidosStore.createIndex('statusSync', 'statusSync');
            console.log("DB: Store 'pedidosOffline' criada com keyPath 'localId'.");
          }
        }
        if (oldVersion < 3) {
          console.log("DB: Aplicando schema v3 (comandas_abertas_cache)");
          if (!db.objectStoreNames.contains('comandas_abertas_cache')) {
            const comandaCacheStore = db.createObjectStore('comandas_abertas_cache', { keyPath: 'numero' });
            comandaCacheStore.createIndex('id', 'id', { unique: true });
            console.log("DB: Store 'comandas_abertas_cache' criada.");
          }
        }
        // Verificação da keyPath em versões existentes
        if (transaction && db.objectStoreNames.contains('pedidosOffline')) {
            const pedidosStore = transaction.objectStore('pedidosOffline');
            if (pedidosStore.keyPath !== 'localId') {
                console.error("DB: ALERTA CRÍTICO! KeyPath da store 'pedidosOffline' NÃO é 'localId'. É:", pedidosStore.keyPath, ". Isso VAI causar falhas ao salvar pedidos offline.");
                // Ação corretiva aqui seria deletar e recriar a store, mas isso apagaria dados existentes.
                // Para desenvolvimento, você poderia fazer:
                // db.deleteObjectStore('pedidosOffline');
                // const newStore = db.createObjectStore('pedidosOffline', { keyPath: 'localId' });
                // newStore.createIndex('timestamp', 'timestamp');
                // newStore.createIndex('statusSync', 'statusSync');
                // console.log("DB: Store 'pedidosOffline' recriada com keyPath 'localId' devido a inconsistência.");
            } else {
                console.log("DB: Store 'pedidosOffline' verificada, keyPath 'localId' está correta.");
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

export const salvarPedidoParaSincronizacaoDB = async (pedido: PedidoOfflinePayload): Promise<string> => {
  try {
    console.log("DB_SAVE: Tentando obter instância do DB...");
    const db = await initDB();
    console.log("DB_SAVE: Instância do DB obtida. Tentando 'put' para o pedido:", JSON.parse(JSON.stringify(pedido))); // Log para ver o objeto completo
    if (!pedido.id_local) {
        console.error("DB_SAVE: ERRO - Pedido Offline sem localId! Não será salvo.", pedido);
        throw new Error("Pedido Offline não pode ser salvo sem um localId.");
    }
    const resultKey = await db.put('pedidosOffline', pedido);
    console.log(`DB_SAVE: Pedido Offline ${pedido.id_local} (key: ${resultKey}) salvo/atualizado com sucesso.`);
    return pedido.id_local;
  } catch (error) {
    console.error("DB_SAVE: Erro DENTRO de salvarPedidoParaSincronizacaoDB:", error, "Objeto do pedido:", JSON.parse(JSON.stringify(pedido)));
    throw error; // Re-lança o erro para ser pego pela chamada em PedidoPage
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