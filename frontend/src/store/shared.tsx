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
}
export interface Catalogo { loja: Loja; categorias: Categoria[]; produtos: Produto[] }

/** Estado de navegação da loja, espelhado na URL (?c=, ?p=, ?q=, ?v=ofertas|novidades). */
export interface Rota { p?: number; c?: number; q?: string; v?: 'ofertas' | 'novidades' | 'todos' }

export function lerRota(): Rota {
  const s = new URLSearchParams(window.location.search);
  const r: Rota = {};
  if (s.get('p')) r.p = Number(s.get('p'));
  if (s.get('c')) r.c = Number(s.get('c'));
  if (s.get('q')) r.q = s.get('q')!;
  const v = s.get('v');
  if (v === 'ofertas' || v === 'novidades' || v === 'todos') r.v = v;
  return r;
}

export function urlDe(r: Rota) {
  const s = new URLSearchParams();
  if (r.p) s.set('p', String(r.p));
  if (r.c) s.set('c', String(r.c));
  if (r.q) s.set('q', r.q);
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
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(el);
    return () => io.disconnect();
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
  }
  if (!s.length) return null;
  return <div className="s-selos">{s.slice(0, 2).map((x) => <span key={x.k} className={`s-selo ${x.k}`}>{x.t}</span>)}</div>;
}

/* ============================== foto ============================== */
export function Foto({ p, eager = false, className = '' }: { p: Produto; eager?: boolean; className?: string }) {
  const [ok, setOk] = useState(false);
  if (!p.imagemUrl) return <div className={`s-foto vazia ${className}`}><span>{inicial(p.nome)}</span></div>;
  return (
    <div className={`s-foto ${ok ? 'ok' : ''} ${className}`}>
      <img src={p.imagemUrl} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setOk(true)} />
    </div>
  );
}

/* ============================== cartão ============================== */
export type Abrir = (p: Produto, foto: HTMLElement | null) => void;
export type Adicionar = (p: Produto, el: Element | null, q?: number) => void;

export function Card({ p, i = 0, onAbrir, onAdicionar }: { p: Produto; i?: number; onAbrir: Abrir; onAdicionar: Adicionar }) {
  const media = useRef<HTMLDivElement>(null);
  const extra = !p.disponivel ? 'Esgotado'
    : p.ultimasUnidades ? (p.ultimasUnidades === 1 ? 'Última unidade' : `Últimas ${p.ultimasUnidades} unidades`) : null;
  return (
    <article className={`s-card ${p.disponivel ? '' : 'soldout'}`} style={{ ['--i' as string]: Math.min(i, 11) }}>
      <div className="s-card-top">
        <a href={urlDe({ p: p.id })} className="s-card-link" aria-label={`${p.nome}, ${money(p.preco)}`}
          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onAbrir(p, media.current); }}>
          <div className="s-card-media" ref={media}>
            <Foto p={p} />
          </div>
        </a>
        <Selos p={p} />
        {p.disponivel && (
          <button className="s-quick" aria-label={`Adicionar ${p.nome} à sacola`} onClick={() => onAdicionar(p, media.current)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span>Adicionar</span>
          </button>
        )}
      </div>
      <div className="s-card-info">
        {extra && <div className={`s-card-flag ${p.disponivel ? 'warn' : ''}`}>{extra}</div>}
        <div className="s-card-name">{p.nome}</div>
        {p.categoriaNome && <div className="s-card-cat">{p.categoriaNome}</div>}
        <Preco p={p} />
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
