// Páginas da loja com título, descrição, foto e preço já no HTML.
// O WhatsApp, o Instagram e o Google leem isso sem rodar JavaScript; o visitante recebe a mesma página e o app abre normal.
import { catalogo, emOferta, esc, money, origemDe, urlImagem, urlProduto } from './_comum.js';
import { SELECOES, produtosDaSelecao } from './_selecoes.js';

let shell = null;
async function paginaBase(o) {
  if (shell) return shell;
  for (const base of [o, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`].filter(Boolean)) {
    try {
      const r = await fetch(`${base}/index.html`, { signal: AbortSignal.timeout(4000) });
      const t = await r.text();
      if (r.ok && t.includes('id="root"')) { shell = t; return t; }
    } catch { /* tenta a próxima */ }
  }
  return null;
}

const corta = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const juntaNomes = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function montar(o, q, d) {
  const loja = d?.loja?.nome || 'Vetrina';
  const parceiros = (d?.parceiros || []).map((x) => x.nome);
  const ondeCompara = parceiros.length ? ` em lojas como ${juntaNomes(parceiros.slice(0, 4))}` : '';
  const base = {
    titulo: `${loja} · Compare preços e encontre ofertas`,
    desc: `Compare preços${ondeCompara}, veja o histórico de cada produto e compre pelo menor preço, sem custo extra.`,
    url: `${o}/loja`, img: null, tipo: 'website', indexar: true, ld: [], preco: null,
  };
  if (!d) return base;

  const ativos = d.produtos || [];
  const capa = (l) => l.find((p) => p.imagemUrl);
  const maiorDesconto = [...ativos].filter(emOferta).sort((a, b) => (b.desconto ?? 0) - (a.desconto ?? 0));

  const p = q.p && ativos.find((x) => String(x.id) === String(q.p));
  if (p) {
    const ofertas = (p.ofertas || []).filter((x) => x.disponivel !== false);
    const lojas = [...new Set(ofertas.map((x) => x.loja))];
    const onde = lojas.length > 1 ? `em ${lojas.length} lojas` : lojas.length ? `${/^(mercado|magazine)/i.test(lojas[0]) ? 'no' : 'na'} ${lojas[0]}` : '';
    const off = emOferta(p) && p.desconto ? ` (${p.desconto}% off)` : '';
    const url = urlProduto(o, p.id);
    const img = urlImagem(o, p);
    const precos = ofertas.map((x) => x.preco);
    const ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.nome, sku: p.codigo, url,
      description: corta(p.detalhes || p.nome, 500),
      ...(img ? { image: [img] } : {}),
      ...(p.categoriaNome ? { category: p.categoriaNome } : {}),
      offers: precos.length > 1
        ? { '@type': 'AggregateOffer', priceCurrency: 'BRL', lowPrice: Math.min(...precos).toFixed(2), highPrice: Math.max(...precos).toFixed(2), offerCount: precos.length, availability: 'https://schema.org/InStock' }
        : { '@type': 'Offer', priceCurrency: 'BRL', price: Number(p.preco).toFixed(2), url, availability: p.disponivel ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', seller: { '@type': 'Organization', name: lojas[0] || loja } },
    };
    const trilha = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: loja, item: `${o}/loja` },
        ...(p.categoriaId && p.categoriaNome ? [{ '@type': 'ListItem', position: 2, name: p.categoriaNome, item: `${o}/loja?c=${p.categoriaId}` }] : []),
        { '@type': 'ListItem', position: p.categoriaNome ? 3 : 2, name: p.nome, item: url },
      ],
    };
    return {
      titulo: `${p.nome} por ${money(p.preco)}${off} | ${loja}`,
      desc: corta(`${money(p.preco)}${emOferta(p) ? ` (antes ${money(p.precoAnterior)})` : ''} ${onde}. ${p.detalhes || ''} Compare preços e veja o histórico na ${loja}.`, 200),
      url, img, tipo: 'product', indexar: true, ld: [ld, trilha], preco: p.preco,
    };
  }

  const sel = q.s && SELECOES.find((x) => x.slug === q.s);
  if (sel) {
    const l = produtosDaSelecao(sel, ativos);
    const url = `${o}/loja/s/${sel.slug}`;
    const top = l.slice(0, 3).map((x) => `${corta(x.nome, 40)} por ${money(x.preco)}${emOferta(x) && x.desconto ? ` (-${x.desconto}%)` : ''}`);
    return {
      ...base, titulo: `${sel.titulo} | ${loja}`,
      desc: corta(top.length ? `${top.join(' · ')}${l.length > 3 ? ` e mais ${l.length - 3}` : ''}. ${sel.desc}` : sel.desc, 200),
      url, img: urlImagem(o, capa(l)), indexar: l.length > 0,
      ld: l.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: sel.titulo, url,
        itemListElement: l.slice(0, 20).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: urlProduto(o, x.id), name: x.nome })) }] : [],
    };
  }

  const c = q.c && (d.categorias || []).find((x) => String(x.id) === String(q.c));
  if (c) {
    const l = ativos.filter((x) => x.categoriaId === c.id);
    const pr = l.map((x) => x.preco);
    return {
      ...base, titulo: `${c.nome}: menores preços e ofertas | ${loja}`,
      desc: `${l.length} ${l.length === 1 ? 'produto' : 'produtos'} de ${c.nome.toLowerCase()}${pr.length ? ` a partir de ${money(Math.min(...pr))}` : ''}. Compare preços${ondeCompara} e veja o histórico de cada um.`,
      url: `${o}/loja?c=${c.id}`, img: urlImagem(o, capa(maiorDesconto.filter((x) => x.categoriaId === c.id)) || capa(l)),
    };
  }

  if (q.v === 'ofertas' || q.v === 'baixou') {
    const top = maiorDesconto.slice(0, 3).map((x) => `${corta(x.nome, 40)} por ${money(x.preco)}`);
    return {
      ...base,
      titulo: q.v === 'ofertas' ? `Ofertas de hoje | ${loja}` : `Baixaram de preço | ${loja}`,
      desc: top.length ? `${top.join(' · ')} e mais. Preços conferidos regularmente.` : base.desc,
      url: `${o}/loja?v=${q.v}`, img: urlImagem(o, capa(maiorDesconto)),
    };
  }

  if (q.v === 'favoritos') return { ...base, titulo: `Meus favoritos | ${loja}`, url: `${o}/loja?v=favoritos`, indexar: false };
  if (q.q) return { ...base, titulo: `Busca: ${corta(q.q, 60)} | ${loja}`, indexar: false };
  if (q.l || q.v) return { ...base, url: `${o}/loja?${q.l ? `l=${q.l}` : `v=${q.v}`}`, img: urlImagem(o, capa(maiorDesconto) || capa(ativos)) };

  return {
    ...base, img: urlImagem(o, capa(maiorDesconto) || capa(ativos)),
    ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: loja, url: `${o}/loja`,
      potentialAction: { '@type': 'SearchAction', target: `${o}/loja?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }],
  };
}

export default async function handler(req, res) {
  const o = origemDe(req);
  const q = req.query || {};
  const [html, d] = await Promise.all([paginaBase(o), catalogo()]);
  if (!html) { res.status(502).send('Página indisponível, tente de novo.'); return; }

  const m = montar(o, q, d);
  const tags = [
    `<meta name="description" content="${esc(m.desc)}" />`,
    `<link rel="canonical" href="${esc(m.url)}" />`,
    m.indexar ? '' : '<meta name="robots" content="noindex, follow" />',
    `<meta property="og:site_name" content="${esc(d?.loja?.nome || 'Vetrina')}" />`,
    '<meta property="og:locale" content="pt_BR" />',
    `<meta property="og:type" content="${m.tipo}" />`,
    `<meta property="og:title" content="${esc(m.titulo)}" />`,
    `<meta property="og:description" content="${esc(m.desc)}" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    m.img ? `<meta property="og:image" content="${esc(m.img)}" />` : '',
    m.img ? `<meta property="og:image:alt" content="${esc(m.titulo)}" />` : '',
    m.preco != null ? `<meta property="product:price:amount" content="${Number(m.preco).toFixed(2)}" />` : '',
    m.preco != null ? '<meta property="product:price:currency" content="BRL" />' : '',
    `<meta name="twitter:card" content="${m.img ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(m.titulo)}" />`,
    `<meta name="twitter:description" content="${esc(m.desc)}" />`,
    m.img ? `<meta name="twitter:image" content="${esc(m.img)}" />` : '',
    ...m.ld.map((x) => `<script type="application/ld+json">${json(x)}</script>`),
  ].filter(Boolean).join('\n    ');

  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.titulo)}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Com catálogo: guarda 10 min e serve a cópia antiga enquanto atualiza. Sem catálogo (servidor dormindo): só 30 s.
  res.setHeader('Cache-Control', d ? 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' : 'public, max-age=0, s-maxage=30');
  res.status(200).send(out);
}
