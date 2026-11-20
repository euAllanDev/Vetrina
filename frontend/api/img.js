// Foto do produto servida pela Vercel com cache longo: a prévia do WhatsApp funciona mesmo com o servidor dormindo.
import { API } from './_comum.js';

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!/^\d+$/.test(id)) { res.status(400).send('id inválido'); return; }
  try {
    const r = await fetch(`${API}/api/produtos/${id}/imagem`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { res.setHeader('Cache-Control', 'public, s-maxage=60'); res.status(r.status === 404 ? 404 : 502).send('sem imagem'); return; }
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000');
    res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=30');
    res.status(504).send('servidor acordando');
  }
}
