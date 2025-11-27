// src/services/cardapioService.ts
import apiClient from '../config/api';
// [TIPOS ATUALIZADOS]
import { Produto, Categoria, Subcategoria, Cardapio, GrupoOpcoes } from '../types/cardapio';

export const fetchCategorias = async (): Promise<Categoria[]> => {
  const response = await apiClient.get<Categoria[]>('/categories?ativo=true');
  return response.data;
};

export const fetchSubcategorias = async (categoriaId?: number): Promise<Subcategoria[]> => {
  const params: any = { ativo: true };
  if (categoriaId) {
    params.categoriaId = categoriaId;
  }
  const response = await apiClient.get<Subcategoria[]>('/subcategories', { params });
  return response.data;
};

export const fetchProdutos = async (params?: { categoriaId?: number, subcategoriaId?: number, nome?: string }): Promise<Produto[]> => {
  const queryParams: any = { disponivel: true, ativo: true };

  if (params?.categoriaId) queryParams.categoriaId = params.categoriaId;
  if (params?.subcategoriaId) queryParams.subcategoriaId = params.subcategoriaId;
  if (params?.nome) queryParams.nome = params.nome;

  const response = await apiClient.get<Produto[]>('/products', { params: queryParams });
  return response.data;
};

// [NOVA FUNÇÃO ADICIONADA]
/**
 * Busca todos os grupos de opções de produtos e seus itens.
 */
export const fetchGruposDeOpcoes = async (): Promise<GrupoOpcoes[]> => {
    try {
        const response = await apiClient.get<GrupoOpcoes[]>('/grupos-opcoes');
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar grupos de opções:", error);
        throw error;
    }
};


// Função para buscar todo o cardápio de uma vez (pode ser mais eficiente em alguns casos)
export const fetchCardapioCompleto = async (): Promise<Cardapio> => {
  try {
    const [categorias, subcategorias, produtos] = await Promise.all([
      fetchCategorias(),
      fetchSubcategorias(),
      fetchProdutos()
    ]);
    return { categorias, subcategorias, produtos };
  } catch (error) {
    console.error('Erro ao buscar cardápio completo:', error);
    throw error;
  }
};