// Código compartilhado pelas funções da Vercel (arquivos com "_" não viram rota).
export const API = process.env.API_ORIGEM || 'https://vetrina-42b1.onrender.com';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v) => brl.format(Number(v ?? 0));

export const origemDe = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
};

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// O catálogo fica em memória por alguns minutos para não bater no servidor a cada visita.
let cache = { em: 0, dados: null };
export async function catalogo(limiteMs = 3500) {
  if (cache.dados && Date.now() - cache.em < 5 * 60_000) return cache.dados;
  try {
    const r = await fetch(`${API}/api/catalogo`, { signal: AbortSignal.timeout(limiteMs) });
    if (!r.ok) throw new Error(String(r.status));
    cache = { em: Date.now(), dados: await r.json() };
  } catch {
    // Servidor dormindo ou fora do ar: usa a última cópia, se houver.
  }
  return cache.dados;
}

export const urlProduto = (origem, id) => `${origem}/loja/p/${id}`;
export const urlImagem = (origem, p) => {
  if (!p?.imagemUrl) return null;
  const v = (p.imagemUrl.match(/[?&]v=([^&]+)/) || [])[1];
  return `${origem}/api/img?id=${p.id}${v ? `&v=${v}` : ''}`;
};
export const emOferta = (p) => !!p.precoAnterior && p.precoAnterior > p.preco;
