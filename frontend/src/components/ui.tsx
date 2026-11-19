import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';
import type { StatusNota, StatusTitulo, StatusVenda, StatusCompra } from '../lib/types';

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName; loading?: boolean; block?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading, block, className = '', children, disabled, type = 'button', ...rest }, ref) {
  const iconOnly = !children;
  const cls = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, iconOnly && 'btn-icon', block && 'btn-block', className]
    .filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={16} />}
    </button>
  );
});

/* ---------- Form controls ---------- */
interface FieldProps { label: string; hint?: ReactNode; error?: string; className?: string; children: (id: string) => ReactNode }
export function Field({ label, hint, error, className = '', children }: FieldProps) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className = '', invalid, ...rest }, ref) {
    return <input ref={ref} className={`input ${className}`} aria-invalid={invalid || undefined} {...rest} />;
  });

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${className}`} {...rest}>{children}</select>;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SearchInput(props, ref) {
  return (
    <div className="input-wrap">
      <Icon name="search" size={16} />
      <input ref={ref} type="search" className="input" {...props} />
    </div>
  );
});

/** Campo numérico em reais/quantidade que aceita vírgula. */
export function NumberInput({ value, onChange, step = '0.01', min = 0, ...rest }:
  { value: number | ''; onChange: (v: number | '') => void; step?: string; min?: number } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input className="input num" inputMode="decimal" type="number" step={step} min={min}
      value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} {...rest} />
  );
}

/* ---------- Segmented filter ---------- */
export function Segmented<T extends string>({ value, onChange, options, label }:
  { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string }[] }) {
  return (
    <div className="pill-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  );
}

/* ---------- Badges ---------- */
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export function Badge({ tone = 'neutral', children, plain }: { tone?: Tone; children: ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone !== 'neutral' ? `badge-${tone}` : ''} ${plain ? 'plain' : ''}`}>{children}</span>;
}

const VENDA: Record<StatusVenda, [Tone, string]> = {
  ORCAMENTO: ['neutral', 'Orçamento'], CONFIRMADA: ['info', 'Confirmada'], FATURADA: ['success', 'Faturada'], CANCELADA: ['danger', 'Cancelada'],
};
const NOTA: Record<StatusNota, [Tone, string]> = {
  AUTORIZADA: ['success', 'Autorizada'], REJEITADA: ['danger', 'Rejeitada'], CANCELADA: ['neutral', 'Cancelada'],
};
const COMPRA: Record<StatusCompra, [Tone, string]> = {
  ABERTO: ['warning', 'Aberto'], RECEBIDO: ['success', 'Recebido'], CANCELADO: ['neutral', 'Cancelado'],
};
export const VendaBadge = ({ s }: { s: StatusVenda }) => <Badge tone={VENDA[s][0]}>{VENDA[s][1]}</Badge>;
export const NotaBadge = ({ s }: { s: StatusNota }) => <Badge tone={NOTA[s][0]}>{NOTA[s][1]}</Badge>;
export const CompraBadge = ({ s }: { s: StatusCompra }) => <Badge tone={COMPRA[s][0]}>{COMPRA[s][1]}</Badge>;
export function TituloBadge({ s, vencida, pagoLabel = 'Pago' }: { s: StatusTitulo; vencida?: boolean; pagoLabel?: string }) {
  if (s === 'PAGO') return <Badge tone="success">{pagoLabel}</Badge>;
  if (s === 'CANCELADO') return <Badge>Cancelado</Badge>;
  return vencida ? <Badge tone="danger">Vencido</Badge> : <Badge tone="warning">Em aberto</Badge>;
}

/* ---------- Layout ---------- */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', pad }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {title && <div className="card-head"><h2 className="section-title">{title}</h2>{actions}</div>}
      {pad ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function Kpi({ label, value, foot, icon, tone }: { label: string; value: ReactNode; foot?: ReactNode; icon?: IconName; tone?: 'danger' }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{icon && <Icon name={icon} size={15} />}{label}</div>
      <div className={`kpi-value ${tone ?? ''}`}>{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

/* ---------- States ---------- */
export function Skeleton({ w = '100%', h = 14, r }: { w?: number | string; h?: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: '8px 14px' }} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)`, gap: 16, padding: '13px 0', borderBottom: '1px solid var(--hairline)' }}>
          {Array.from({ length: cols }).map((__, j) => <Skeleton key={j} w={j === 0 ? '70%' : '55%'} />)}
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon = 'inbox', title, text, action }: { icon?: IconName; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <div className="empty-icon" style={{ color: 'var(--danger)', background: 'var(--danger-soft)' }}><Icon name="alert" size={22} /></div>
      <p className="empty-title">Não foi possível carregar</p>
      <p className="empty-text">{message}</p>
      {onRetry && <div style={{ marginTop: 10 }}><Button icon="refresh" onClick={onRetry}>Tentar de novo</Button></div>}
    </div>
  );
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'warning' | 'info'; children: ReactNode }) {
  return (
    <div className={`alert ${tone !== 'danger' ? `alert-${tone}` : ''}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={tone === 'info' ? 'info' : 'alert'} size={18} />
      <p>{children}</p>
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage, label = 'registros' }:
  { page: number; totalPages: number; total: number; onPage: (p: number) => void; label?: string }) {
  return (
    <div className="table-foot">
      <span className="num">{total.toLocaleString('pt-BR')} {total === 1 ? singular(label) : label}</span>
      {totalPages > 1 && (
        <div className="row">
          <span className="num">Página {page + 1} de {totalPages}</span>
          <Button size="sm" icon="chevronLeft" aria-label="Página anterior" disabled={page === 0} onClick={() => onPage(page - 1)} />
          <Button size="sm" icon="chevronRight" aria-label="Próxima página" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} />
        </div>
      )}
    </div>
  );
}

const IRREGULARES: Record<string, string> = { 'movimentações': 'movimentação', fornecedores: 'fornecedor', registros: 'registro' };
function singular(label: string) {
  return IRREGULARES[label] ?? label.replace(/s$/, '');
}
