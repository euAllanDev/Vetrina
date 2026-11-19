import { useState } from 'react';
import { api } from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';
import { money, qty } from '../lib/format';
import type { Fornecedor, Page, Produto } from '../lib/types';
import { Button, SearchInput } from './ui';
import { Icon } from './icons';

/** Busca com lista suspensa; usado para escolher produto ou fornecedor em formulários. */
function Picker<T extends { id: number }>({ placeholder, fetch, render, onPick, label }:
  { placeholder: string; label: string; fetch: (q: string) => Promise<T[]>; render: (t: T) => { title: string; sub?: string; right?: string }; onPick: (t: T) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 200);
  const res = useAsync(() => (open ? fetch(dq) : Promise.resolve(undefined)), [dq, open]);
  return (
    <div style={{ position: 'relative' }}>
      <SearchInput value={q} placeholder={placeholder} aria-label={label}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && res.data && (
        <div className="menu" style={{ left: 0, right: 0, top: 'calc(100% + 4px)', maxHeight: 300, overflowY: 'auto' }} role="listbox">
          {res.data.length === 0 ? <div className="muted" style={{ padding: 10 }}>Nada encontrado.</div> : res.data.map((t) => {
            const r = render(t);
            return (
              <button key={t.id} type="button" className="menu-item" style={{ height: 'auto', padding: '8px 10px' }} role="option" aria-selected="false"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(t); setQ(''); setOpen(false); }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  {r.sub && <div className="muted mono" style={{ fontSize: 11.5 }}>{r.sub}</div>}
                </div>
                {r.right && <span className="muted num" style={{ fontSize: 12 }}>{r.right}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProdutoPicker({ onPick, placeholder = 'Buscar produto por nome, código ou EAN' }: { onPick: (p: Produto) => void; placeholder?: string }) {
  return (
    <Picker<Produto> label="Buscar produto" placeholder={placeholder}
      fetch={(q) => api.get<Page<Produto>>('/produtos', { termo: q, ativo: true, size: 8, sort: 'descricao' }).then((p) => p.content)}
      render={(p) => ({ title: p.descricao, sub: p.codigo, right: `${qty(p.estoqueAtual)} ${p.unidade} · ${money(p.precoCusto)}` })}
      onPick={onPick} />
  );
}

export function FornecedorPicker({ value, onChange }: { value: Fornecedor | null; onChange: (f: Fornecedor | null) => void }) {
  if (value) {
    return (
      <div className="row-between card" style={{ padding: '8px 12px' }}>
        <div className="row"><Icon name="factory" size={16} className="muted" /><div><div style={{ fontWeight: 500 }}>{value.razaoSocial}</div>
          {value.nomeFantasia && <div className="muted" style={{ fontSize: 12 }}>{value.nomeFantasia}</div>}</div></div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Trocar</Button>
      </div>
    );
  }
  return (
    <Picker<Fornecedor> label="Buscar fornecedor" placeholder="Buscar fornecedor"
      fetch={(q) => api.get<Page<Fornecedor>>('/fornecedores', { termo: q, ativo: true, size: 8 }).then((p) => p.content)}
      render={(f) => ({ title: f.razaoSocial, sub: f.nomeFantasia ?? undefined })} onPick={onChange} />
  );
}
