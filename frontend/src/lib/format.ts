import type { FormaPagamento } from './types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

export const money = (v: number | null | undefined) => brl.format(Number(v ?? 0));
export const moneyCompact = (v: number | null | undefined) => brlCompact.format(Number(v ?? 0));
export const qty = (v: number | null | undefined) => num.format(Number(v ?? 0));
export const percent = (v: number | null | undefined) => `${pct.format(Number(v ?? 0))}%`;

/** Datas vindas do backend: "2026-11-18" ou "2026-11-18T21:43:55.123". */
function parse(v: string): Date {
  return v.length === 10 ? new Date(`${v}T12:00:00`) : new Date(v);
}
export const date = (v: string | null | undefined) => (v ? parse(v).toLocaleDateString('pt-BR') : '—');
export const dateTime = (v: string | null | undefined) =>
  v ? parse(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const dayShort = (v: string) => parse(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export function relativeDays(v: string): string {
  const d = parse(v); const hoje = new Date();
  d.setHours(0, 0, 0, 0); hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (diff === 0) return 'vence hoje';
  if (diff === 1) return 'vence amanhã';
  if (diff > 1) return `vence em ${diff} dias`;
  if (diff === -1) return 'venceu ontem';
  return `venceu há ${-diff} dias`;
}

export const isoDate = (d: Date) => {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const today = () => isoDate(new Date());
export const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d); };
export const daysAhead = (n: number) => daysAgo(-n);
export const monthStart = () => { const d = new Date(); d.setDate(1); return isoDate(d); };

export function documento(v: string | null | undefined): string {
  if (!v) return '—';
  if (/^\d{11}$/.test(v)) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (/^[0-9A-Z]{12}\d{2}$/.test(v)) return v.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, '$1.$2.$3/$4-$5');
  return v;
}
export const cep = (v: string | null | undefined) => (v && v.length === 8 ? `${v.slice(0, 5)}-${v.slice(5)}` : v || '—');
export const chave = (v: string) => v.replace(/(.{4})/g, '$1 ').trim();
export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export const FORMAS: { value: FormaPagamento; label: string; short: string; aVista: boolean }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro', short: 'Dinheiro', aVista: true },
  { value: 'PIX', label: 'Pix', short: 'Pix', aVista: true },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito', short: 'Débito', aVista: true },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito', short: 'Crédito', aVista: false },
  { value: 'BOLETO', label: 'Boleto', short: 'Boleto', aVista: false },
  { value: 'CREDIARIO', label: 'Crediário', short: 'Crediário', aVista: false },
  { value: 'TRANSFERENCIA', label: 'Transferência', short: 'Transf.', aVista: true },
  { value: 'CHEQUE', label: 'Cheque', short: 'Cheque', aVista: false },
];
export const formaLabel = (f: FormaPagamento | null | undefined) => FORMAS.find((x) => x.value === f)?.label ?? '—';

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador', GERENTE: 'Gerente', VENDEDOR: 'Vendedor', ESTOQUISTA: 'Estoquista', FINANCEIRO: 'Financeiro',
};

export const ORIGEM_LABEL: Record<string, string> = {
  ESTOQUE_INICIAL: 'Estoque inicial', COMPRA: 'Compra', VENDA: 'Venda', CANCELAMENTO_VENDA: 'Cancelamento de venda',
  AJUSTE_INVENTARIO: 'Inventário', ENTRADA_MANUAL: 'Entrada manual', SAIDA_MANUAL: 'Saída manual',
};

export const initials = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** "1 venda", "3 vendas"; irregulares: plural(n, 'movimentação', 'movimentações'). */
export const plural = (n: number, um: string, varios?: string) =>
  `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios ?? `${um}s`}`;
