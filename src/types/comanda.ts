// src/types/comanda.ts

// Passo 1: Certifique-se de que ItemPedido está DEFINIDO e EXPORTADO em './pedido.ts'
// como: export interface ItemPedido { ... }
import { ItemPedido as TipoItemDoPedidoOriginal } from './pedido';
// Passo 2: Reexporte ItemPedido de './pedido.ts' UMA ÚNICA VEZ.
export type ItemPedido = TipoItemDoPedidoOriginal; 

// Interface base para uma comanda, com campos que são comuns e geralmente esperados
export interface ComandaBase { 
  id: number;
  numero: string;
  cliente_nome?: string | null;
  local_atual?: string | null;         // Nome da coluna no DB, usado pela API de detalhes e cache
  status: string;                     // 'aberta', 'fechada', 'paga', 'cancelada', etc.
  data_abertura?: string;            // Data ISO string de quando foi aberta
  observacao_geral?: string | null;
  // Este campo é calculado e retornado pela API de DETALHES e pela API de LISTA (findAllWithTotal)
  total_atual_calculado?: number | null; 
}

// Para o cache do IndexedDB, deve ser consistente com ComandaBase ou ter mapeamento claro
export interface ComandaCache extends ComandaBase {
  // Herda: id, numero, cliente_nome, local_atual, status, data_abertura, observacao_geral
  // O seu syncService mapeava 'valor_total_calculado' da API de lista para 'valor_total_calculado' no cache.
  // E 'total_atual_calculado' de ComandaBase é number | null.
  // Para consistência no cache, vamos usar 'total_atual_calculado' se possível,
  // ou manter 'valor_total_calculado' se o syncService for mais fácil de manter assim.
  // Se a API de lista (GET /comandas) retorna 'total_atual_calculado' (numérico),
  // então ComandaCache pode simplesmente herdar de ComandaBase e o syncService mapearia para ele.
  // Se a API de lista retorna 'valor_total_calculado' (string ou number) e você quer manter esse nome no cache:
  valor_total_calculado?: number | null; // Mantido se o syncService lida com este nome.
                                         // Se não, remova e use o herdado 'total_atual_calculado'.
}

// Para o tipo de objeto retornado pela API de listagem geral de comandas (ex: GET /api/comandas)
// Esta interface deve refletir EXATAMENTE o que a API GET /comandas?status=aberta retorna.
// O seu backend `comandaModel.findAllWithTotal` já calcula e retorna 'total_atual_calculado'.
// E os outros campos parecem vir diretamente da tabela 'comandas'.
export interface ComandaDaListaAPI extends ComandaBase {
  localizacao_cliente?: string | null; // Adicione se a API de lista envia
  valor_total_calculado?: string | number | null; // Adicione se a API de lista envia
}
// ComandaSearchResult usa o tipo retornado pela sua função fetchComandaByNumero (que chama a API de lista).
export type ComandaSearchResult = ComandaDaListaAPI | null;


// Para quando você busca uma comanda com TODOS os seus detalhes (incluindo itens)
// Usada por buscarComandaDetalhadaPorNumeroAPI e buscarComandaDetalhadaPorIdAPI
export interface ComandaDetalhada extends ComandaBase {
  // Campos de ComandaBase são herdados.
  // O backend já retorna: id, numero, cliente_nome, local_atual, status, data_abertura, observacao_geral, total_atual_calculado.
  
  usuario_id_abertura?: number;
  nome_usuario_abertura?: string; // Se o backend popular este (JOIN com usuarios)
  data_fechamento?: string | null;
  usuario_id_fechamento?: number | null;
  
  itens: ItemPedido[]; // Array de itens já lançados (tipo ItemPedido reexportado de ./pedido.ts)
}


// Para compatibilidade com o seu comandasService.ts que importa 'Comanda'
// Se 'Comanda' é o tipo usado para a resposta da API de lista geral
// então ComandaDaListaAPI é o nome mais descritivo.
// Você pode criar um alias ou ajustar o service para usar ComandaDaListaAPI.
// Por simplicidade, vamos assumir que o service pode ser ajustado para usar ComandaDaListaAPI.
// Ou, se 'Comanda' no service refere-se a ComandaDetalhada, isso precisa ser alinhado.

// Se o seu comandasService.ts importa `Comanda` e espera que seja o tipo da lista:
// export type Comanda = ComandaDaListaAPI; (Exporte este alias se necessário para compatibilidade)

// Se o seu comandasService.ts importa `Comanda as ComandaCompletaAPI` e espera que seja o tipo da lista:
// export type ComandaCompletaAPI = ComandaDaListaAPI; (Exporte este alias)

// >>> FOCO NA SIMPLICIDADE E CONSISTÊNCIA <<<
// Idealmente, a API de lista (GET /comandas) e a API de detalhe (GET /comandas/id/X)
// usariam nomes de campo consistentes para as propriedades básicas da comanda.
// Se isso for verdade, ComandaDaListaAPI poderia ser muito similar ou idêntica a ComandaBase,
// apenas sem o array 'itens'.

export type Comanda = ComandaDaListaAPI;