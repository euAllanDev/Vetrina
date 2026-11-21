/**
 * Modo do painel. Por padrão é o comparador de afiliados: só as telas que importam (Afiliados, Produtos,
 * Empresa, Usuários). As telas de loja física (PDV, vendas, NF-e, estoque, compras…) continuam no código
 * e voltam com a variável VITE_MODO=completo na Vercel, caso um dia a Vetrina venda produto próprio.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const LOJA_FISICA = env?.VITE_MODO === 'completo';
