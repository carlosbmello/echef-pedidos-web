// src/types/pedido.ts

// Interface para o item como está no ESTADO do PedidoPage
export interface PedidoItemInput { // Usado em ItemPedidoState
  produto_id: number;
  quantidade: number;
  preco_unitario: number; // Preço no momento que foi adicionado ao carrinho (no estado)
  observacao?: string;    // Observação do item (no estado)
}

// ---- Interface para os ITENS que são enviados para o BACKEND (e salvos offline para sincronização) ----
export interface ItemParaBackend { // Também pode ser chamado de ItemPedidoAPIPayload
  produto_id: number;
  quantidade: number;
  preco_unitario_momento: number; // Nome esperado pelo backend
  observacao_item?: string;       // Nome esperado pelo backend
}

// ---- Interface para o PAYLOAD do PEDIDO enviado para o BACKEND ----
export interface PedidoInput { // Payload para API (online)
  comandaIdentifier: number; // ou string, dependendo da sua API
  usuario_id: number;
  local_pedido?: string;
  observacao_geral?: string;
  itens: ItemParaBackend[];
}

// ---- Tipos para Pedidos Offline ----
export interface ItemPedidoOffline { // Estrutura do item dentro do PedidoOfflinePayload
  produto_id: number;
  nome_produto: string; // Para UI na lista de pendentes
  quantidade: number;
  preco_unitario_momento: number; // Consistente com ItemParaBackend
  observacao_item?: string;       // Consistente com ItemParaBackend
}

export interface PedidoOfflinePayload { // O que é salvo no IndexedDB
  localId: string; // Chave primária no IndexedDB (IMPORTANTE QUE SEJA 'localId')
  comandaNumero: string;
  usuario_id: number;
  local_pedido: string;
  observacao_geral?: string;
  itens: ItemPedidoOffline[];
  timestamp: number;
  statusSync: 'pendente' | 'enviando' | 'sincronizado' | 'erro';
  tentativasSync: number;
  mensagemErroSync?: string;
}

// --- Tipos para dados retornados pela API (após criação/consulta) ---
export interface PedidoItem { // Item de um pedido existente, retornado pela API
  id: number;
  pedido_id: number;
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao_item?: string;
  status_item?: 'pendente' | 'impresso' | 'cancelado';
}

export interface Pedido { // Pedido existente, retornado pela API
  id: number;
  comanda_id: number;
  usuario_id: number;
  usuario_nome?: string;
  local_pedido?: string;
  observacao_geral?: string;
  data_pedido: string;
  itens: PedidoItem[];
}