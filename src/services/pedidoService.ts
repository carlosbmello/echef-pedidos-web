// src/services/pedidoService.ts
import apiClient from '../config/api';
import { BackendPedidoPayload, PedidoDetalhado } from '../types/pedido'; 

// [CORREÇÃO] Usamos apenas o caminho relativo. 
// O apiClient já vai adicionar 'http://.../api/admin' automaticamente.
const PEDIDOS_API_URL = '/pedidos';

export const criarPedido = async (dadosPedido: BackendPedidoPayload): Promise<PedidoDetalhado> => {
  console.log("[pedidoService] Enviando para criar pedido:", dadosPedido);
  try {
    // Agora a requisição vai para: .../api/admin/pedidos
    const response = await apiClient.post<PedidoDetalhado>(PEDIDOS_API_URL, dadosPedido);
    console.log("[pedidoService] Pedido criado com sucesso, resposta da API:", response.data);
    return response.data;
  } catch (error: any) {
    console.error('Erro no serviço ao criar pedido:', error.response?.data || error.message);
    throw error; 
  }
};