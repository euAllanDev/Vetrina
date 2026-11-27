import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

/**
 * Espaços de anúncio da loja. Em cada lugar vale o banner próprio (campanha com link de afiliado, cadastrada no painel);
 * sem banner, entra o Google AdSense, se estiver configurado; sem nenhum dos dois, o espaço não aparece.
 */
export type Posicao = 'HOME_TOPO' | 'HOME_MEIO' | 'LISTA' | 'PRODUTO' | 'RODAPE';
interface BannerPublico { id: number; titulo: string; posicao: Posicao; imagemUrl: string; link: string; interno: boolean }
interface Anuncios { banners: BannerPublico[]; adsense: { cliente: string; slot: string } | null }

let dados: Anuncios | null = null;
let pedido: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

function carregar() {
  if (pedido) return;
  pedido = fetch('/api/anuncios')
    .then((r) => (r.ok ? r.json() : null))
    .then((d: Anuncios | null) => { dados = d ?? { banners: [], adsense: null }; ouvintes.forEach((f) => f()); })
    .catch(() => { dados = { banners: [], adsense: null }; ouvintes.forEach((f) => f()); });
}

function useAnuncios(): Anuncios | null {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); carregar(); return () => ouvintes.delete(f); },
    () => dados,
    () => null,
  );
}

export function Anuncio({ posicao, className = '' }: { posicao: Posicao; className?: string }) {
  const a = useAnuncios();
  // Com mais de um banner no mesmo lugar, cada visita sorteia um (fica o mesmo enquanto a página estiver aberta).
  const sorteio = useMemo(() => Math.random(), []);
  if (!a) return null;
  const doLugar = a.banners.filter((b) => b.posicao === posicao);
  if (doLugar.length > 0) {
    const b = doLugar[Math.floor(sorteio * doLugar.length)];
    const interno = b.interno;
    return (
      <aside className={`s-anuncio ${posicao.toLowerCase()} ${className}`} aria-label="Publicidade">
        <span className="s-anuncio-tag">Publicidade</span>
        <a href={b.link} target={interno ? undefined : '_blank'} rel={interno ? undefined : 'sponsored noopener'} title={b.titulo}>
          <img src={b.imagemUrl} alt={b.titulo} loading="lazy" decoding="async" />
        </a>
      </aside>
    );
  }
  if (a.adsense) return <BlocoAdsense posicao={posicao} cliente={a.adsense.cliente} slot={a.adsense.slot} className={className} />;
  return null;
}

/* ============================== Google AdSense ============================== */
declare global { interface Window { adsbygoogle?: unknown[] } }

function scriptAdsense(cliente: string) {
  if (document.querySelector('script[data-vetrina-adsense]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cliente)}`;
  s.crossOrigin = 'anonymous';
  s.dataset.vetrinaAdsense = '1';
  document.head.append(s);
}

function BlocoAdsense({ posicao, cliente, slot, className }: { posicao: Posicao; cliente: string; slot: string; className: string }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    scriptAdsense(cliente);
    if (!ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* bloqueador de anúncios: o espaço fica vazio */ }
  }, [cliente]);
  return (
    <aside className={`s-anuncio adsense ${posicao.toLowerCase()} ${className}`} aria-label="Publicidade">
      <span className="s-anuncio-tag">Publicidade</span>
      <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={cliente} data-ad-slot={slot}
        data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
