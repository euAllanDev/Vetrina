import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { money } from '../lib/format';

/* ============================== tipos ============================== */
export interface Loja { nome: string; razaoSocial: string | null; telefone: string | null; email: string | null; cidade: string | null; uf: string | null }
export interface Categoria { id: number; nome: string; quantidade: number }
export interface Produto {
  id: number; codigo: string; nome: string; preco: number; categoriaId: number | null; categoriaNome: string | null;
  unidade: string; imagemUrl: string | null; disponivel: boolean; ultimasUnidades: number | null;
  precoAnterior: number | null; desconto: number | null; detalhes: string | null; novo: boolean; maisVendido: boolean;
  ofertas: Oferta[];
}
/** Oferta numa loja parceira. O clique passa por /api/ir/{id}, que conta e redireciona para o link de afiliado. */
export interface Oferta {
  id: number; parceiroId: number; loja: string; cor: string | null; preco: number; precoAnterior: number | null;
  frete: number | null; parcelamento: string | null; nota: number | null; avaliacoes: number | null;
  disponivel: boolean; verificadoEm: string | null;
}
export interface ParceiroV { id: number; nome: string; cor: string | null; produtos: number }
export interface Catalogo { loja: Loja; categorias: Categoria[]; produtos: Produto[]; parceiros?: ParceiroV[] }

/** Estado de navegação da loja, espelhado na URL (?c=, ?p=, ?q=, ?l=loja, ?v=ofertas|novidades). */
export interface Rota { p?: number; c?: number; q?: string; l?: number; v?: 'ofertas' | 'novidades' | 'todos' }

export function lerRota(): Rota {
  const s = new URLSearchParams(window.location.search);
  const r: Rota = {};
  if (s.get('p')) r.p = Number(s.get('p'));
  if (s.get('c')) r.c = Number(s.get('c'));
  if (s.get('q')) r.q = s.get('q')!;
  if (s.get('l')) r.l = Number(s.get('l'));
  const v = s.get('v');
  if (v === 'ofertas' || v === 'novidades' || v === 'todos') r.v = v;
  return r;
}

export function urlDe(r: Rota) {
  const s = new URLSearchParams();
  if (r.p) s.set('p', String(r.p));
  if (r.c) s.set('c', String(r.c));
  if (r.q) s.set('q', r.q);
  if (r.l) s.set('l', String(r.l));
  if (r.v) s.set('v', r.v);
  const qs = s.toString();
  return `/loja${qs ? `?${qs}` : ''}`;
}

/* ============================== utilidades ============================== */
export const reduzMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Troca de estado embrulhada na View Transitions API; sem suporte (ou com movimento reduzido), troca direto. */
export function transicao(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!d.startViewTransition || reduzMovimento()) { fn(); return; }
  d.startViewTransition(() => flushSync(fn));
}

export const limiteDe = (p: Produto) => p.ultimasUnidades ?? 99;
/** Produto de afiliado: vendido nas lojas parceiras (não entra na sacola). */
export const ehAfiliado = (p: Produto) => (p.ofertas?.length ?? 0) > 0;
export const linkOferta = (o: Oferta) => `/api/ir/${o.id}`;
export const freteGratis = (p: Produto) => ehAfiliado(p) && p.ofertas[0]?.frete === 0;

/** "no Mercado Livre", "na Shopee"… (artigo certo para cada loja). */
const MASCULINAS = ['mercado livre', 'aliexpress', 'magazine luiza', 'magalu', 'carrefour', 'extra', 'ponto'];
export function naLoja(nome: string) {
  return `${MASCULINAS.some((m) => nome.toLowerCase().startsWith(m)) ? 'no' : 'na'} ${nome}`;
}

/** "há 3 h", "há 2 dias"… */
export function haQuanto(iso: string | null) {
  if (!iso) return null;
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 2) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Etiqueta da loja parceira: quadradinho na cor da loja com a inicial. */
export function MarcaLoja({ nome, cor, size = 22 }: { nome: string; cor: string | null; size?: number }) {
  const bg = cor ?? '#111111';
  const claro = luminancia(bg) > 0.6;
  return (
    <span className="s-marca" style={{ width: size, height: size, background: bg, color: claro ? '#111' : '#fff', fontSize: size * 0.5 }} aria-hidden="true">
      {inicial(nome)}
    </span>
  );
}
function luminancia(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
export const inicial = (nome: string) => nome.trim().charAt(0).toUpperCase();
export const emOferta = (p: Produto) => !!p.precoAnterior && p.precoAnterior > p.preco;

/** Revela o elemento quando entra na tela (uma vez). */
export function useRevela<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visto) return;
    if (reduzMovimento() || !('IntersectionObserver' in window)) { setVisto(true); return; }
    // Já visível na montagem? Mostra direto. E nunca deixa conteúdo escondido para sempre:
    // se o observador não disparar (aba em segundo plano, navegador antigo), revela por tempo.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) { setVisto(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    const t = window.setTimeout(() => setVisto(true), 4000);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, [visto]);
  return [ref, visto] as const;
}

/* ============================== ícones da loja ============================== */
export function Seta({ dir = 'right', size = 20 }: { dir?: 'left' | 'right' | 'down'; size?: number }) {
  const r = dir === 'left' ? 180 : dir === 'down' ? 90 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ transform: `rotate(${r}deg)` }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/* ============================== preço ============================== */
export function Preco({ p, grande = false }: { p: Produto; grande?: boolean }) {
  const promo = emOferta(p);
  return (
    <div className={`s-preco ${grande ? 'lg' : ''} ${promo ? 'promo' : ''}`}>
      <span className="por s-num">{money(p.preco)}</span>
      {promo && <s className="de s-num" aria-label={`Preço anterior ${money(p.precoAnterior!)}`}>{money(p.precoAnterior!)}</s>}
      {promo && p.desconto ? <span className="off">{p.desconto}% off</span> : null}
    </div>
  );
}

/* ============================== selos ============================== */
export function Selos({ p }: { p: Produto }) {
  const s: { t: string; k: string }[] = [];
  if (!p.disponivel) s.push({ t: 'Esgotado', k: 'out' });
  else {
    if (emOferta(p) && p.desconto) s.push({ t: `-${p.desconto}%`, k: 'sale' });
    if (p.novo) s.push({ t: 'Novo', k: 'new' });
    if (p.maisVendido) s.push({ t: 'Mais vendido', k: 'top' });
    if (freteGratis(p)) s.push({ t: 'Frete grátis', k: 'frete' });
  }
  if (!s.length) return null;
  return <div className="s-selos">{s.slice(0, 2).map((x) => <span key={x.k} className={`s-selo ${x.k}`}>{x.t}</span>)}</div>;
}

/* ============================== foto ============================== */
export function Foto({ p, eager = false, className = '' }: { p: Produto; eager?: boolean; className?: string }) {
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [tentativa, setTentativa] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setEstado('carregando');
    setTentativa(0);
    // Imagem já em cache pode terminar antes do onLoad ser ligado.
    if (img.current?.complete && img.current.naturalWidth > 0) setEstado('ok');
  }, [p.imagemUrl]);
  // Servidor acordando (plano grátis) pode falhar a 1ª imagem: tenta de novo duas vezes.
  const falhou = () => {
    if (tentativa < 2) window.setTimeout(() => setTentativa((t) => t + 1), 2500 * (tentativa + 1));
    else setEstado('erro');
  };
  const src = p.imagemUrl ? (tentativa ? `${p.imagemUrl}${p.imagemUrl.includes('?') ? '&' : '?'}t=${tentativa}` : p.imagemUrl) : '';
  if (!p.imagemUrl || estado === 'erro') return <div className={`s-foto vazia ${className}`}><span>{inicial(p.nome)}</span></div>;
  return (
    <div className={`s-foto ${estado === 'ok' ? 'ok' : ''} ${className}`}>
      <img ref={img} src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async"
        onLoad={() => setEstado('ok')} onError={falhou} />
    </div>
  );
}

/* ============================== cartão ============================== */
export type Abrir = (p: Produto, foto: HTMLElement | null) => void;
export type Adicionar = (p: Produto, el: Element | null, q?: number) => void;

export function Card({ p, i = 0, onAbrir, onAdicionar }: { p: Produto; i?: number; onAbrir: Abrir; onAdicionar: Adicionar }) {
  const media = useRef<HTMLDivElement>(null);
  const afiliado = ehAfiliado(p);
  const lojas = afiliado ? [...new Map(p.ofertas.map((o) => [o.parceiroId, o])).values()] : [];
  const extra = !p.disponivel ? (afiliado ? 'Indisponível no momento' : 'Esgotado')
    : p.ultimasUnidades ? (p.ultimasUnidades === 1 ? 'Última unidade' : `Últimas ${p.ultimasUnidades} unidades`) : null;
  return (
    <article className={`s-card ${p.disponivel ? '' : 'soldout'}`} style={{ ['--i' as string]: Math.min(i, 11) }}>
      <div className="s-card-top">
        <a href={urlDe({ p: p.id })} className="s-card-link" aria-label={`${p.nome}, ${afiliado ? 'a partir de ' : ''}${money(p.preco)}`}
          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onAbrir(p, media.current); }}>
          <div className="s-card-media" ref={media}>
            <Foto p={p} />
          </div>
        </a>
        <Selos p={p} />
        {p.disponivel && (afiliado ? (
          <button className="s-quick" aria-label={`Comparar preços de ${p.nome}`} onClick={() => onAbrir(p, media.current)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h11M4 7l3-3M4 7l3 3M20 17H9m11 0-3-3m3 3-3 3" /></svg>
            <span>Comparar</span>
          </button>
        ) : (
          <button className="s-quick" aria-label={`Adicionar ${p.nome} à sacola`} onClick={() => onAdicionar(p, media.current)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span>Adicionar</span>
          </button>
        ))}
      </div>
      <div className="s-card-info">
        {extra && <div className={`s-card-flag ${p.disponivel ? 'warn' : ''}`}>{extra}</div>}
        <div className="s-card-name">{p.nome}</div>
        {p.categoriaNome && <div className="s-card-cat">{p.categoriaNome}</div>}
        {afiliado && <span className="s-apartir">{lojas.length > 1 ? 'a partir de' : naLoja(lojas[0].loja)}</span>}
        <Preco p={p} />
        {afiliado && lojas.length > 1 && (
          <div className="s-card-lojas" title={lojas.map((o) => o.loja).join(', ')}>
            <span className="marcas">{lojas.slice(0, 4).map((o) => <MarcaLoja key={o.parceiroId} nome={o.loja} cor={o.cor} size={18} />)}</span>
            em {lojas.length} lojas
          </div>
        )}
      </div>
    </article>
  );
}

/* ============================== trilho horizontal ============================== */
export function Trilho({ titulo, sub, acao, children }: { titulo: string; sub?: string; acao?: ReactNode; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [lim, setLim] = useState({ ini: true, fim: false });
  const [ref, visto] = useRevela<HTMLElement>();
  const medir = () => {
    const el = box.current;
    if (!el) return;
    setLim({ ini: el.scrollLeft < 8, fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(() => { medir(); window.addEventListener('resize', medir); return () => window.removeEventListener('resize', medir); }, []);
  const rolar = (d: number) => {
    const el = box.current;
    if (!el) return;
    el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: reduzMovimento() ? 'auto' : 'smooth' });
  };
  return (
    <section className={`s-trilho ${visto ? 'in' : ''}`} ref={ref}>
      <div className="s-sec-head">
        <div>
          <h2 className="s-sec-title">{titulo}</h2>
          {sub && <p className="s-sec-sub">{sub}</p>}
        </div>
        <div className="s-sec-tools">
          {acao}
          <button className="s-round" aria-label="Anteriores" disabled={lim.ini} onClick={() => rolar(-1)}><Seta dir="left" /></button>
          <button className="s-round" aria-label="Próximos" disabled={lim.fim} onClick={() => rolar(1)}><Seta /></button>
        </div>
      </div>
      <div className="s-trilho-track" ref={box} onScroll={medir}>{children}</div>
    </section>
  );
}
