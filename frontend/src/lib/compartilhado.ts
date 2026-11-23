/**
 * Texto que chega quando o dono toca em "Compartilhar" no app da loja (Mercado Livre, Shein…) e escolhe a Vetrina,
 * ou que ele cola no app. Daqui saem o link e, quando a mensagem traz, nome e preço.
 *
 * Exemplo da Shein:
 *   ✨Oferta Relâmpago SHEIN—Promoções Exclusivas Terminando em Breve!
 *   💰Preço[R$143,40] -5% 🛒Blazer Feminino de Cor Sólida…
 *   https://onelink.shein.com/61/693o9vxg7voc
 */
export interface TextoCompartilhado { link: string | null; nome: string | null; preco: number | null; desconto: number | null }

const CHAVE = 'vetrina.compartilhado';
const URL_RE = /https?:\/\/[^\s<>"']+/i;
const PRECO_RE = /R\$\s*\[?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;
const DESCONTO_RE = /-\s?(\d{1,2})\s?%/;
// Frases de propaganda que vêm antes do nome e não são o produto.
const PROPAGANDA = /oferta|promo|desconto|exclusiv|terminando|imperd|confira|olha (s[oó]|que)|achei|veja/i;

export function lerTexto(texto: string): TextoCompartilhado {
  const t = (texto || '').replace(/\r/g, '');
  const link = (t.match(URL_RE)?.[0] ?? null)?.replace(/[).,;!]+$/, '') ?? null;
  const pm = t.match(PRECO_RE);
  const preco = pm ? Number(pm[1].includes(',') ? pm[1].replace(/\./g, '').replace(',', '.') : pm[1]) : null;
  const dm = t.match(DESCONTO_RE);

  // Nome: na Shein vem depois do 🛒; nos outros, a linha com mais texto que não seja link nem propaganda.
  let nome: string | null = null;
  const carrinho = t.split('🛒')[1];
  if (carrinho) nome = carrinho.split('\n')[0];
  if (!nome) {
    const linhas = t.split('\n').map((l) => l.replace(URL_RE, '').trim()).filter((l) => l.length > 8 && !PROPAGANDA.test(l) && !PRECO_RE.test(l));
    nome = linhas.sort((a, b) => b.length - a.length)[0] ?? null;
  }
  if (nome) {
    nome = nome.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
    if (nome.length > 120) nome = nome.slice(0, 120).trim();
    if (nome.length < 4) nome = null;
  }
  return { link, nome, preco: preco && preco > 0 ? preco : null, desconto: dm ? Number(dm[1]) : null };
}

/** Guarda o que veio pelo "Compartilhar" do celular até a tela de adicionar abrir (o login pode vir no meio). */
export function guardarCompartilhado(texto: string) {
  try { sessionStorage.setItem(CHAVE, texto); } catch { /* sem armazenamento: segue sem */ }
}

export function pegarCompartilhado(): string | null {
  try {
    const t = sessionStorage.getItem(CHAVE);
    if (t) sessionStorage.removeItem(CHAVE);
    return t;
  } catch {
    return null;
  }
}

/**
 * O Android abre o painel com ?title=&text=&url= quando o dono compartilha para o app instalado.
 * Lê esses dados, limpa o endereço e diz se havia algo.
 */
export function receberDoCompartilhar(): boolean {
  const q = new URLSearchParams(window.location.search);
  const partes = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean) as string[];
  if (!partes.length) return false;
  guardarCompartilhado(partes.join('\n'));
  history.replaceState(null, '', `${window.location.pathname}#/celular?aba=adicionar`);
  return true;
}
