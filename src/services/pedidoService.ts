// src/services/pedidoService.ts
import apiClient from '../config/api';
import { Pedido, PedidoInput } from '../types/pedido';

export const criarPedido = async (dadosPedido: PedidoInput): Promise<Pedido> => {
  try {
    const response = await apiClient.post<Pedido>('/pedidos', dadosPedido);
    // O backend é responsável por registrar no banco E disparar a impressão aqui.
    return response.data;
  } catch (error: any) {
    console.error('Erro ao criar pedido:', error);
    // Podemos adicionar tratamento para erros específicos do backend (ex: comanda fechada, produto indisponível)
    const errorMessage = error.response?.data?.message || 'Falha ao enviar o pedido.';
    throw new Error(errorMessage); // Lança um erro com a mensagem do backend ou uma genérica
  }
};

// Futuramente:
// export const fetchPedidosDaComanda = async (comandaId: number): Promise<Pedido[]> => { ... }
// export const adicionarItensPedido = async (pedidoId: number, itens: PedidoItemInput[]): Promise<Pedido> => { ... }
// export const cancelarPedido = async (pedidoId: number): Promise<void> => { ... }
// export const cancelarItemPedido = async (pedidoId: number, itemId: number): Promise<Pedido> => { ... }