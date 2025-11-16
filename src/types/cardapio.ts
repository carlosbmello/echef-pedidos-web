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
  grupo_opcoes_id: number | null;
}
export interface Cardapio { categorias: Categoria[]; subcategorias: Subcategoria[]; produtos: Produto[];}

/**
 * Representa um item de escolha dentro de um grupo.
 * Ex: "Morango", "Limão", "Ao Ponto".
 */
export interface OpcaoItem {
  id: number;
  nome: string;
  valor_adicional: number;
  grupo_id: number;
}

/**
 * Representa um grupo de personalização.
 * Ex: "Escolha as Frutas", "Ponto da Carne".
 */
export interface GrupoOpcoes {
  id: number;
  nome_grupo: string;
  tipo_selecao: 'multipla' | 'unica';
  opcoes: OpcaoItem[]; // Contém a lista de itens de opção aninhados.
}