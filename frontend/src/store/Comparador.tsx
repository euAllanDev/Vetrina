import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '../lib/format';
import { MarcaLoja, haQuanto, linkOferta, type Oferta, type Produto } from './shared';

/* ============================== lista de ofertas ============================== */

function Estrelas({ nota }: { nota: number }) {
  const pct = Math.max(0, Math.min(100, (nota / 5) * 100));
  return (
    <span className="s-estrelas" aria-hidden="true">
      <span className="base">★★★★★</span>
      <span className="cheia" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}

const fmtNum = (n: number) => n.toLocaleString('pt-BR');

function textoFrete(o: Oferta) {
  if (o.frete === 0) return { t: 'Frete grátis', k: 'ok' };
  if (o.frete != null) return { t: `+ ${money(o.frete)} de frete`, k: '' };
  return { t: 'Frete calculado na loja', k: 'muted' };
}

export function Ofertas({ p, onRef }: { p: Produto; onRef?: (el: HTMLDivElement | null) => void }) {
  const ofertas = p.ofertas;
  const disponiveis = ofertas.filter((o) => o.disponivel);
  const melhor = disponiveis[0];
  const pior = disponiveis.length > 1 ? Math.max(...disponiveis.map((o) => o.preco + (o.frete ?? 0))) : null;
  const economia = melhor && pior != null ? pior - (melhor.preco + (melhor.frete ?? 0)) : 0;
  const verificado = ofertas.map((o) => o.verificadoEm).filter(Boolean).sort().pop() ?? null;

  return (
    <div className="s-ofertas" ref={onRef}>
      <div className="s-ofertas-head">
        <h2>{ofertas.length === 1 ? 'Onde comprar' : `Compare em ${ofertas.length} lojas`}</h2>
        {economia >= 1 && <span className="s-ofertas-eco">Economize até {money(economia)}</span>}
      </div>
      <ol className="s-ofertas-lista">
        {ofertas.map((o, i) => {
          const fr = textoFrete(o);
          const top = i === 0 && o.disponivel && disponiveis.length > 1;
          return (
            <li key={o.id} className={`s-oferta ${top ? 'top' : ''} ${o.disponivel ? '' : 'off'}`} style={{ ['--i' as string]: i }}>
              {top && <span className="s-oferta-tag">Menor preço</span>}
              <div className="s-oferta-loja">
                <MarcaLoja nome={o.loja} cor={o.cor} size={34} />
                <div>
                  <strong>{o.loja}</strong>
                  {o.nota != null && (
                    <span className="s-oferta-nota" aria-label={`Nota ${o.nota.toFixed(1)} de 5${o.avaliacoes ? `, ${o.avaliacoes} avaliações` : ''}`}>
                      <Estrelas nota={o.nota} /> {o.nota.toFixed(1).replace('.', ',')}
                      {o.avaliacoes ? <small>({fmtNum(o.avaliacoes)})</small> : null}
                    </span>
                  )}
                </div>
              </div>
              <div className="s-oferta-preco">
                <span className="por s-num">{money(o.preco)}</span>
                {o.precoAnterior && o.precoAnterior > o.preco && <s className="de s-num">{money(o.precoAnterior)}</s>}
                <span className={`frete ${fr.k}`}>{fr.t}</span>
                {o.parcelamento && <span className="parc">{o.parcelamento}</span>}
              </div>
              {o.disponivel ? (
                <a className={`s-btn s-oferta-btn ${top || ofertas.length === 1 ? '' : 'ghost'}`} href={linkOferta(o)} target="_blank" rel="sponsored nofollow noopener noreferrer"
                  aria-label={`Ver ${p.nome} na ${o.loja} por ${money(o.preco)} (abre em nova aba)`}>
                  Ver na loja
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                </a>
              ) : <span className="s-oferta-indisp">Indisponível</span>}
            </li>
          );
        })}
      </ol>
      <p className="s-ofertas-nota">
        {verificado && <>Preços conferidos {haQuanto(verificado)}. </>}
        Preço, frete e estoque podem mudar: confira na loja antes de finalizar.
      </p>
    </div>
  );
}

/* ============================== histórico de preço ============================== */

interface Historico { pontos: { dia: string; preco: number }[]; menor: number | null; maior: number | null; atual: number | null; menorPrecoDoPeriodo: boolean; dias: number }

const fmtDia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export function HistoricoPreco({ produtoId }: { produtoId: number }) {
  const [h, setH] = useState<Historico | null>(null);
  const [dias, setDias] = useState(90);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/catalogo/produtos/${produtoId}/historico?dias=${dias}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo) setH(j); })
      .catch(() => { if (vivo) setH(null); });
    return () => { vivo = false; };
  }, [produtoId, dias]);

  const W = 640, H = 180, PX = 8, PY = 18;
  const geo = useMemo(() => {
    if (!h || h.pontos.length === 0) return null;
    const ps = h.pontos;
    const min = Math.min(...ps.map((x) => x.preco)), max = Math.max(...ps.map((x) => x.preco));
    const span = max - min || max * 0.1 || 1;
    const lo = min - span * 0.25, hi = max + span * 0.25;
    const x = (i: number) => PX + (ps.length === 1 ? (W - 2 * PX) / 2 : (i / (ps.length - 1)) * (W - 2 * PX));
    const y = (v: number) => PY + (1 - (v - lo) / (hi - lo)) * (H - 2 * PY);
    // degraus: o preço vale até mudar
    let d = `M${x(0)},${y(ps[0].preco)}`;
    for (let i = 1; i < ps.length; i++) d += ` H${x(i)} V${y(ps[i].preco)}`;
    const area = `${d} V${H} H${x(0)} Z`;
    return { ps, x, y, d, area, min, max };
  }, [h]);

  if (!h || !geo) return null;
  const poucos = h.pontos.length < 7;
  const sel = hover != null ? geo.ps[hover] : geo.ps[geo.ps.length - 1];

  const mover = (clientX: number) => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rel = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - PX) / (W - 2 * PX)) * (geo.ps.length - 1));
    setHover(Math.max(0, Math.min(geo.ps.length - 1, i)));
  };

  return (
    <section className="s-hist" aria-label="Histórico de preço">
      <div className="s-hist-head">
        <div>
          <h2>Histórico de preço</h2>
          <p>Menor preço entre as lojas, por dia</p>
        </div>
        <div className="s-hist-dias" role="group" aria-label="Período">
          {[30, 90, 180].map((d) => <button key={d} aria-pressed={dias === d} onClick={() => setDias(d)}>{d} dias</button>)}
        </div>
      </div>
      {h.menorPrecoDoPeriodo && (
        <div className="s-hist-selo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M14 7h7v7" /></svg>
          Menor preço dos últimos {h.dias} dias
        </div>
      )}
      <div className="s-hist-num">
        <div><span>{hover != null ? fmtDia(sel.dia) : 'Hoje'}</span><strong className="s-num">{money(sel.preco)}</strong></div>
        <div><span>Menor</span><strong className="s-num ok">{money(geo.min)}</strong></div>
        <div><span>Maior</span><strong className="s-num">{money(geo.max)}</strong></div>
      </div>
      <svg ref={svg} className="s-hist-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Preço entre ${money(geo.min)} e ${money(geo.max)} nos últimos ${h.dias} dias`}
        onMouseMove={(e) => mover(e.clientX)} onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => mover(e.touches[0].clientX)} onTouchEnd={() => setHover(null)}>
        <defs>
          <linearGradient id="s-hist-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#111" stopOpacity="0.12" />
            <stop offset="1" stopColor="#111" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geo.area} fill="url(#s-hist-g)" />
        <path d={geo.d} fill="none" stroke="#111" strokeWidth="2" vectorEffect="non-scaling-stroke" className="s-hist-linha" />
        {hover != null && (
          <>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={0} y2={H} stroke="#111" strokeOpacity=".25" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={geo.x(hover)} cy={geo.y(geo.ps[hover].preco)} r="4" fill="#111" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="s-hist-eixo"><span>{fmtDia(geo.ps[0].dia)}</span><span>{fmtDia(geo.ps[geo.ps.length - 1].dia)}</span></div>
      {poucos && <p className="s-hist-aviso">Começamos a acompanhar este preço há pouco tempo. O gráfico fica mais completo a cada dia.</p>}
    </section>
  );
}
