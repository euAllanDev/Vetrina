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
    'Allow: /favicon.ico',
    'Allow: /favicon-48.png',
    'Allow: /icon-192.png',
    'Allow: /ads.txt',
    'Allow: /api/anuncios/',
    'Disallow: /api/anuncios/*/ir',
    'Allow: /google0adadbad9117cc16.html',
    'Disallow: /',
    '',
    // Robô do Google AdSense: precisa ver as páginas para escolher anúncios que combinem.
    'User-agent: Mediapartners-Google',
    'Allow: /loja',
    'Disallow: /',
    '',
    `Sitemap: ${o}/sitemap.xml`,
    '',
  ].join('\n'));
}
