/**
 * Endereço do painel da equipe. Fica fora da loja (nenhum link aponta para cá) para visitantes não esbarrarem nele.
 * Pode ser trocado sem mexer no código: variável VITE_PAINEL na Vercel (ex.: /minha-gestao), e um novo deploy.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const PAINEL = (env?.VITE_PAINEL || '/gestao-vt7').replace(/\/+$/, '');
