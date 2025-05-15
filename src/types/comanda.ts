// src/types/comanda.ts
import { ItemPedido } from './pedido'; // Assumindo que ItemPedido de 'types/pedido.ts' já tem os campos dos itens

export interface ComandaBasica { // Para listagens ou cache, sem itens detalhados
  id: number;
  numero: string;
  cliente_nome?: string | null;
  local_atual?: string | null;
  data_abertura: string;
  status: 'aberta' | 'fechada' | 'paga' | 'cancelada' | string; // string para flexibilidade
  total_atual_calculado?: number; // Se o backend fornecer para listagens
  // Outros campos que você usa na listagem ou cache
}

export interface ComandaDetalhada extends ComandaBasica { // Estende a básica e adiciona itens
  usuario_id_abertura?: number;
  nome_usuario_abertura?: string;
  // Outros campos detalhados da comanda que a API pode retornar
  itens: ItemPedido[]; // Array de itens já lançados
}