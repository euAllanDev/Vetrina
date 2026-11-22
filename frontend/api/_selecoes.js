// Seleções temáticas da loja (/loja/s/<slug>): listas montadas sozinhas a partir do catálogo, por regra.
// Usado pela loja (React) e pelas funções da Vercel (prévia no WhatsApp, Google e sitemap).
// Para criar uma nova, é só acrescentar um item aqui. Uma seleção só aparece se tiver pelo menos MINIMO produtos.

export const MINIMO = 2;

export const SELECOES = [
  // Página especial de Natal: aparece sozinha de 10/11 a 25/12 de todo ano, com a lista separada por pessoa.
  { slug: 'natal', titulo: 'Presentes de Natal', especial: 'natal', periodo: { de: '11-10', ate: '12-25' },
    sub: 'Ideias de presente com o preço comparado, separadas para cada pessoa da sua lista',
    desc: 'Presentes de Natal para ele, para ela, para quem joga e para o amigo secreto, com preço comparado e desconto. Compre direto na loja.',
    grupos: [
      { titulo: 'Para ele', sub: 'Perfumes, roupas e o que mais agrada', regras: [{ palavras: ['masculin', 'homem', 'homme', 'for men'] }] },
      { titulo: 'Para ela', sub: 'Perfumes, beleza e acessórios', regras: [{ palavras: ['feminin', 'for women', 'pour femme'] }, { categoria: 'Beleza & Cuidados' }, { categoria: 'Joias & Bijuterias' }] },
      { titulo: 'Para quem joga', sub: 'Controle, mouse e upgrade no PC', regras: [{ categoria: 'Games' }, { categoria: 'Periféricos para PC' }, { palavras: ['gamer', 'gaming', 'gabinete', 'cooler', 'ssd'], excluir: ['notebook'] }] },
      { titulo: 'Amigo secreto até R$ 100', sub: 'Presente bom que cabe no limite da brincadeira', regras: [{ maxPreco: 100 }] },
      { titulo: 'Para as crianças', sub: 'Roupas e mimos para os pequenos', regras: [{ categoria: 'Infantil' }] },
      { titulo: 'Para a casa', sub: 'Para quem vai receber a família', regras: [{ categoria: 'Casa & Cozinha' }] },
      { titulo: 'Presentão', sub: 'Para quem merece um presente maior', regras: [{ palavras: ['notebook', 'smartphone', 'celular', 'smart tv', 'console'] }, { minPreco: 1000 }] },
    ] },
  { slug: 'perfumes-pela-metade', titulo: 'Perfumes pela metade do preço', sub: 'Perfumes com 50% de desconto ou mais',
    desc: 'Perfumes masculinos e femininos com 50% de desconto ou mais. Compare preços e compre direto na loja.',
    categoria: 'Perfumes', minDesconto: 50 },
  { slug: 'perfumes-masculinos', titulo: 'Perfumes masculinos', sub: 'Colônias e perfumes para ele, do mais barato ao importado',
    desc: 'Perfumes e colônias masculinas com preço comparado. Veja os descontos e compre direto na loja.',
    categoria: 'Perfumes', palavras: ['masculin', 'homem', 'homme', 'for men'] },
  { slug: 'perfumes-femininos', titulo: 'Perfumes femininos', sub: 'Colônias e perfumes para ela',
    desc: 'Perfumes e colônias femininas com preço comparado. Veja os descontos e compre direto na loja.',
    categoria: 'Perfumes', palavras: ['feminin', 'for women', 'pour femme'] },
  { slug: 'notebooks', titulo: 'Notebooks', sub: 'Do dia a dia ao gamer, com o preço comparado',
    desc: 'Notebooks para trabalho, estudo e jogos com preço comparado e desconto. Compre direto na loja.',
    palavras: ['notebook'] },
  { slug: 'monte-seu-pc-gamer', titulo: 'Monte seu PC gamer', sub: 'Gabinete, cooler, SSD, mouse e o que mais faltar',
    desc: 'Peças e periféricos para montar ou melhorar o PC gamer: gabinete, cooler, SSD, mouse e mais, com preço comparado.',
    palavras: ['gabinete', 'cooler', 'ssd', 'mouse', 'teclado', 'headset', 'monitor', 'placa de video', 'memoria ram', 'fonte'],
    excluir: ['notebook'] },
  { slug: 'suplementos-em-oferta', titulo: 'Suplementos em oferta', sub: 'Whey, creatina e vitaminas com desconto',
    desc: 'Whey protein, creatina e multivitamínicos com desconto. Compare preços e compre direto na loja.',
    palavras: ['whey', 'creatina', 'vitamin', 'proteina', 'pre-treino', 'pre treino', 'bcaa', 'colageno', 'omega'], minDesconto: 1 },
  { slug: 'ofertas-ate-100-reais', titulo: 'Ofertas até R$ 100', sub: 'Produtos com desconto que cabem no bolso',
    desc: 'Produtos com desconto por até R$ 100. Compare preços e compre direto na loja.',
    maxPreco: 100, minDesconto: 1 },
];

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Um produto passa numa regra quando atende a tudo o que ela pede. */
function passa(regra, p) {
  const nome = semAcento(p.nome);
  if (regra.categoria && semAcento(p.categoriaNome) !== semAcento(regra.categoria)) return false;
  if (regra.palavras?.length && !regra.palavras.some((w) => nome.includes(semAcento(w)))) return false;
  if (regra.excluir?.some((w) => nome.includes(semAcento(w)))) return false;
  if (regra.minDesconto && !(p.precoAnterior > p.preco && (p.desconto ?? 0) >= regra.minDesconto)) return false;
  if (regra.maxPreco && p.preco > regra.maxPreco) return false;
  if (regra.minPreco && p.preco < regra.minPreco) return false;
  return true;
}
const ordenar = (l) => l.sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || (b.desconto ?? 0) - (a.desconto ?? 0));

/** Produtos de um grupo (passam em qualquer uma das regras), do maior desconto para o menor. */
export function produtosDoGrupo(grupo, produtos) {
  return ordenar((produtos || []).filter((p) => grupo.regras.some((r) => passa(r, p))));
}

/** Produtos que entram na seleção, do maior desconto para o menor. Com grupos, junta todos sem repetir. */
export function produtosDaSelecao(sel, produtos) {
  if (sel.grupos) return ordenar((produtos || []).filter((p) => sel.grupos.some((g) => g.regras.some((r) => passa(r, p)))));
  return ordenar((produtos || []).filter((p) => passa(sel, p)));
}

/** A seleção está na época dela? (sem período = o ano todo). Datas no formato MM-DD, horário de Brasília. */
export function naEpoca(sel, agora = new Date()) {
  if (!sel.periodo) return true;
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit', day: '2-digit' }).format(agora);
  const { de, ate } = sel.periodo;
  return de <= ate ? hoje >= de && hoje <= ate : hoje >= de || hoje <= ate;
}

/** Dias que faltam até o fim do período (ex.: até o Natal). */
export function diasAte(sel, agora = new Date()) {
  if (!sel.periodo) return null;
  const [m, d] = sel.periodo.ate.split('-').map(Number);
  const hoje = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora) + 'T00:00:00Z');
  let alvo = Date.UTC(hoje.getUTCFullYear(), m - 1, d);
  if (alvo < hoje.getTime()) alvo = Date.UTC(hoje.getUTCFullYear() + 1, m - 1, d);
  return Math.round((alvo - hoje.getTime()) / 86_400_000);
}

/** Seleções na época e com produtos suficientes para aparecer. */
export function selecoesAtivas(produtos) {
  return SELECOES.filter((s) => naEpoca(s)).map((s) => ({ ...s, produtos: produtosDaSelecao(s, produtos) })).filter((s) => s.produtos.length >= MINIMO);
}
