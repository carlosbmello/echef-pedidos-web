// src/services/pedidoService.ts
import apiClient from '../config/api';
// Importa o tipo correto para o payload que a API espera
import { BackendPedidoPayload, PedidoDetalhado } from '../types/pedido'; 
// PedidoDetalhado é usado como tipo de retorno de criarPedido se a API retornar o pedido criado.
// Se a API retornar algo mais simples (ex: só { message: string, pedidoId: number }), ajuste o tipo de retorno.

const PEDIDOS_API_URL = `${import.meta.env.VITE_API_BASE_URL}/pedidos`;

// A função criarPedido agora espera BackendPedidoPayload
// O tipo de retorno <PedidoDetalhado> assume que sua API POST /pedidos retorna o objeto do pedido criado.
// Se retornar algo diferente, ajuste o tipo de retorno da Promise. Ex: Promise<{id: number; message: string}>
export const criarPedido = async (dadosPedido: BackendPedidoPayload): Promise<PedidoDetalhado> => {
  console.log("[pedidoService] Enviando para criar pedido:", dadosPedido);
  try {
    // A API /pedidos recebe BackendPedidoPayload e retorna o PedidoDetalhado (ou o que sua API retornar)
    const response = await apiClient.post<PedidoDetalhado>(PEDIDOS_API_URL, dadosPedido);
    console.log("[pedidoService] Pedido criado com sucesso, resposta da API:", response.data);
    return response.data;
  } catch (error: any) {
    console.error('Erro no serviço ao criar pedido:', error.response?.data || error.message);
    // const errorMessage = error.response?.data?.message || 'Falha ao enviar o pedido.';
    // É melhor relançar o erro para que o componente possa ter mais detalhes se necessário,
    // ou você pode optar por sempre lançar new Error(errorMessage).
    throw error; 
  }
};

// Futuramente:

// export const fetchPedidosDaComanda = async (comandaId: number): Promise<PedidoDetalhado[]> => { /* ... */ }
// export const adicionarItensPedido = async (pedidoId: number, itens: ItemParaPayloadBackend[]): Promise<PedidoDetalhado> => { /* ... */ }
// export const cancelarPedido = async (pedidoId: number): Promise<void> => { /* ... */ }
// export const cancelarItemPedido = async (pedidoId: number, itemId: number): Promise<PedidoDetalhado> => { /* ... */ }