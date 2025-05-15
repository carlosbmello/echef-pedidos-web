// src/types/cardapio.ts - (Adicionar unidade_medida, assumir que API envia o resto)
export interface Categoria { id: number; nome: string; }
export interface Subcategoria { id: number; nome: string; categoria_id: number; }
export interface Produto {
  id: number;
  nome: string;
  descricao?: string;
  preco_venda: string;
  categoria_id: number;
  categoria_nome?: string;
  subcategoria_id?: number;
  subcategoria_nome?: string;
  unidade_medida?: string; 
  imagem_url?: string;
  ativo: boolean; 
  permite_observacao: boolean; // <-- Assumindo que a API retorna
}
export interface Cardapio { categorias: Categoria[]; subcategorias: Subcategoria[]; produtos: Produto[];}