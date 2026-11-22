import type { Produto } from '../src/store/shared';

export interface Regra { categoria?: string; palavras?: string[]; excluir?: string[]; minDesconto?: number; maxPreco?: number; minPreco?: number }
export interface Grupo { titulo: string; sub: string; regras: Regra[] }
export interface Selecao extends Regra {
  slug: string; titulo: string; sub: string; desc: string;
  especial?: 'natal'; periodo?: { de: string; ate: string }; grupos?: Grupo[];
}
export const MINIMO: number;
export const SELECOES: Selecao[];
export function produtosDoGrupo(grupo: Grupo, produtos: Produto[]): Produto[];
export function produtosDaSelecao(sel: Selecao, produtos: Produto[]): Produto[];
export function naEpoca(sel: Selecao, agora?: Date): boolean;
export function diasAte(sel: Selecao, agora?: Date): number | null;
export function selecoesAtivas(produtos: Produto[]): (Selecao & { produtos: Produto[] })[];
