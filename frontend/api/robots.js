import { origemDe } from './_comum.js';

// Só a loja é indexada; o painel e os links de afiliado (/api/ir) ficam de fora.
export default function handler(req, res) {
  const o = origemDe(req);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.status(200).send([
    'User-agent: *',
    'Allow: /loja',
    'Allow: /assets/',
    'Allow: /api/catalogo',
    'Allow: /api/produtos/',
    'Allow: /api/img',
    'Allow: /sitemap.xml',
    'Allow: /google0adadbad9117cc16.html',
    'Disallow: /',
    '',
    `Sitemap: ${o}/sitemap.xml`,
    '',
  ].join('\n'));
}
