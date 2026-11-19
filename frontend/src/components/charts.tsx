import { useEffect, useMemo, useRef, useState } from 'react';

interface Point { label: string; value: number; sub?: string }

/** Barras verticais com eixo Y em 4 linhas e tooltip. Uma cor de série (acento). */
export function BarChart({ data, height = 280, format, emptyText = 'Sem dados no período' }:
  { data: Point[]; height?: number; format: (v: number) => string; emptyText?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 500 ? Math.round(height * 0.75) : height, padL = 56, padB = 26, padT = 8;
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value))), [data]);

  if (!data.length || max === 0) {
    return <div ref={box} className="empty" style={{ height }}><p className="empty-text">{emptyText}</p></div>;
  }
  const innerW = W - padL, innerH = H - padB - padT;
  const step = innerW / data.length;
  const bw = Math.max(3, Math.min(28, step * 0.62));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(data.length / Math.max(3, Math.floor(innerW / 72)));
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={box} className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Gráfico de barras">
        {ticks.map((t, i) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line className="grid-line" x1={padL} x2={W} y1={y} y2={y} />
              <text className="axis-label" x={padL - 8} y={y + 4} textAnchor="end">{compact(t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const bh = (d.value / max) * innerH;
          const x = padL + i * step + (step - bw) / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect className="hit" x={padL + i * step} y={padT} width={step} height={innerH} />
              <rect className={`bar ${hover !== null && hover !== i ? 'dim' : ''}`} x={x} y={padT + innerH - bh} width={bw} height={Math.max(bh, d.value > 0 ? 2 : 0)} rx={Math.min(4, bw / 3)} />
              {i % labelEvery === 0 && (
                <text className="axis-label" x={x + bw / 2} y={H - 6} textAnchor="middle">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div className="chart-tip" style={{
          left: `${((padL + hover * step + step / 2) / W) * 100}%`,
          top: `${((padT + innerH - (h.value / max) * innerH) / H) * 100}%`,
        }}>
          <div className="muted" style={{ color: 'inherit', opacity: .7 }}>{h.label}{h.sub ? ` · ${h.sub}` : ''}</div>
          <strong>{format(h.value)}</strong>
        </div>
      )}
    </div>
  );
}

/** Topo do eixo com 4 intervalos "redondos" (ex.: 0, 500, 1.000, 1.500, 2.000). */
function niceMax(v: number): number {
  if (v <= 0) return 0;
  const raw = v / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  const step = ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((c) => n <= c) ?? 10) * p;
  return step * 4;
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/** Barra horizontal de proporção (ex.: participação no faturamento). */
export function Meter({ value, max, tone }: { value: number; max: number; tone?: 'warn' | 'danger' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className={`meter ${tone ?? ''}`} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>;
}
