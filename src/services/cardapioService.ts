// src/services/cardapioService.ts
import apiClient from '../config/api';
import { Produto, Categoria, Subcategoria, Cardapio } from '../types/cardapio';

export const fetchCategorias = async (): Promise<Categoria[]> => {
  const response = await apiClient.get<Categoria[]>('/categories?ativo=true'); // Supondo filtro de ativas
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
  const queryParams: any = { disponivel: true, ativo: true }; // Garçons só veem ativos e disponíveis

  if (params?.categoriaId) queryParams.categoriaId = params.categoriaId;
  if (params?.subcategoriaId) queryParams.subcategoriaId = params.subcategoriaId;
  if (params?.nome) queryParams.nome = params.nome; // Para busca por nome

  const response = await apiClient.get<Produto[]>('/produtos', { params: queryParams });
  return response.data;
};

// Função para buscar todo o cardápio de uma vez (pode ser mais eficiente em alguns casos)
export const fetchCardapioCompleto = async (): Promise<Cardapio> => {
  try {
    const [categorias, subcategorias, produtos] = await Promise.all([
      fetchCategorias(),
      fetchSubcategorias(), // Busca todas as subcategorias ativas
      fetchProdutos() // Busca todos os produtos ativos e disponíveis
    ]);
    return { categorias, subcategorias, produtos };
  } catch (error) {
    console.error('Erro ao buscar cardápio completo:', error);
    throw error;
  }
};