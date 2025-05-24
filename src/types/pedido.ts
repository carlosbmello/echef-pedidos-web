// src/types/pedido.ts

// 1. Item de um pedido que JÁ EXISTE e é retornado pela API 
// (usado em ComandaDetalhada.itens em comanda.ts)
export interface ItemPedido {
  id: number; 
  pedido_id?: number;
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario_momento: number;
  observacao_item: string | null;
  status_item?: string;
  data_hora_pedido?: string;
  nome_garcom?: string;
}

// 2. Interface para o item como está no ESTADO local da PedidoPage (novos itens)
export interface PedidoItemInput {
  produto_id: number;
  quantidade: number;
  preco_unitario: number; 
  observacao?: string;
}

// 3. Interface para os ITENS que são enviados para o BACKEND ao criar/atualizar um pedido
export interface ItemParaPayloadBackend { 
  produto_id: number;
  quantidade: number;
  preco_unitario_momento: number;
  observacao_item: string | null;
}

// 4. Interface para o PAYLOAD do PEDIDO COMPLETO enviado para o BACKEND (POST /api/pedidos)
// Este é o tipo que PedidoPage.tsx monta e pedidoService.ts->criarPedido deve esperar.
export interface BackendPedidoPayload {
  comandaIdentifier: string; 
  local_pedido: string;
  observacao_geral: string | null;
  itens: ItemParaPayloadBackend[];
  // usuario_id NÃO é enviado aqui, pois o backend pega do token.
}

// 5. Tipos para Pedidos Offline
export interface ItemPedidoOffline {
  produto_id: number;
  nome_produto: string;
  quantidade: number;
  preco_unitario_momento: number; 
  observacao_item: string | null;   // Consistente com ItemParaPayloadBackend
}

export interface PedidoOfflinePayload {
  id_local: string;                 
  timestamp: number;
  tentativas_sync: number;          
  nome_cliente_comanda?: string | null;
  numero_comanda_exibicao: string;  
  comandaIdentifier: string; 
  usuario_id_frontend: number;
  local_pedido: string;
  observacao_geral?: string; 
  itens: ItemPedidoOffline[];
  comanda_id_db?: number | null;
  statusSync?: 'pendente' | 'enviando' | 'sincronizado' | 'erro';
  mensagemErroSync?: string;
}

// 6. Tipos para Pedido e PedidoItem retornados pela API (após consulta de um pedido específico)
// Se sua API /pedidos/:id retorna algo assim, defina aqui.
export interface PedidoDetalhadoItem { 
  id: number;
  pedido_id: number;
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number; // Note: nome diferente de preco_unitario_momento
  subtotal: number;
  observacao_item?: string;
  status_item?: string;
}

export interface PedidoDetalhado { // Renomeado de 'Pedido' para evitar conflito com 'ItemPedido'
  id: number;
  comanda_id: number;
  usuario_id: number;
  usuario_nome?: string;
  local_pedido?: string;
  observacao_geral?: string;
  data_pedido: string;
  status_pedido?: string;
  itens: PedidoDetalhadoItem[];
  valor_total_pedido?: number;
}

// O tipo PedidoInput que estava causando o erro.
// Se a API de criar pedido NÃO espera usuario_id no corpo, este tipo é problemático para essa chamada.
// BackendPedidoPayload é o tipo correto para o corpo da requisição POST /api/pedidos.
export interface PedidoInput { 
  comandaIdentifier: string | number; 
  usuario_id: number; // O problema está aqui para a chamada de criarPedidoAPI
  local_pedido?: string;
  observacao_geral?:  string | null;
  itens: ItemParaPayloadBackend[];
}