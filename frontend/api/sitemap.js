import { catalogo, esc, origemDe, urlImagem, urlProduto } from './_comum.js';

export default async function handler(req, res) {
  const o = origemDe(req);
  const d = await catalogo(8000);
  if (!d) { res.setHeader('Cache-Control', 'public, s-maxage=30'); res.status(503).send('Catálogo indisponível, tente de novo em instantes.'); return; }

  const data = (iso) => (iso ? `<lastmod>${iso.slice(0, 10)}</lastmod>` : '');
  const urls = [
    `<url><loc>${o}/loja</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${o}/loja?v=ofertas</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    ...d.categorias.map((c) => `<url><loc>${o}/loja?c=${c.id}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`),
    ...d.produtos.map((p) => {
      const conferido = (p.ofertas || []).map((x) => x.verificadoEm).filter(Boolean).sort().pop();
      const img = urlImagem(o, p);
      return `<url><loc>${urlProduto(o, p.id)}</loc>${data(conferido)}<changefreq>daily</changefreq><priority>0.7</priority>`
        + (img ? `<image:image><image:loc>${esc(img)}</image:loc><image:title>${esc(p.nome)}</image:title></image:image>` : '')
        + '</url>';
    }),
  ];
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
}
