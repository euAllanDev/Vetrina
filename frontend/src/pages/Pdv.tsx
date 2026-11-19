import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync, useDebounced, useHotkey } from '../lib/hooks';
import { FORMAS, money, qty } from '../lib/format';
import { navigate } from '../lib/router';
import type { Categoria, Cliente, FormaPagamento, NotaFiscal, Page, Produto, Venda } from '../lib/types';
import { Alert, Button, Card, Empty, ErrorState, Field, NumberInput, PageHeader, SearchInput, Segmented, Select, Skeleton } from '../components/ui';
import { Modal, useToast } from '../components/overlay';
import { Icon } from '../components/icons';
import { imprimirDanfe } from '../lib/danfe';
import { ProdutoFoto } from '../components/foto';

interface Linha { produto: Produto; quantidade: number }

export function Pdv() {
  const toast = useToast();
  const [termo, setTermo] = useState('');
  const dt = useDebounced(termo, 200);
  const [categoria, setCategoria] = useState('todas');
  const cats = useAsync(() => api.get<Categoria[]>('/categorias'), []);
  const prods = useAsync(() => api.get<Page<Produto>>('/produtos', {
    termo: dt, ativo: true, size: 60, sort: 'descricao', categoriaId: categoria === 'todas' ? undefined : categoria,
  }), [dt, categoria]);

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [forma, setForma] = useState<FormaPagamento>('PIX');
  const [parcelas, setParcelas] = useState(1);
  const [desconto, setDesconto] = useState<number | ''>('');
  const [frete, setFrete] = useState<number | ''>('');
  const [feita, setFeita] = useState<Venda | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const action = useAction();

  useHotkey((e) => e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement),
    (e) => { e.preventDefault(); searchRef.current?.focus(); });

  const aVista = FORMAS.find((f) => f.value === forma)?.aVista ?? true;
  useEffect(() => { if (aVista) setParcelas(1); }, [aVista]);

  const subtotal = useMemo(() => linhas.reduce((s, l) => s + l.quantidade * l.produto.precoVenda, 0), [linhas]);
  const total = Math.max(0, subtotal - Number(desconto || 0) + Number(frete || 0));
  const itensCount = linhas.reduce((s, l) => s + l.quantidade, 0);

  const add = (p: Produto) => {
    setLinhas((ls) => {
      const i = ls.findIndex((l) => l.produto.id === p.id);
      if (i >= 0) {
        if (ls[i].quantidade + 1 > p.estoqueAtual) { toast.err(`Só há ${qty(p.estoqueAtual)} ${p.unidade} de ${p.descricao} em estoque.`); return ls; }
        return ls.map((l, j) => (j === i ? { ...l, quantidade: l.quantidade + 1 } : l));
      }
      return [...ls, { produto: p, quantidade: 1 }];
    });
  };
  const setQtd = (id: number, q: number) => setLinhas((ls) => ls.flatMap((l) => {
    if (l.produto.id !== id) return [l];
    if (q <= 0) return [];
    return [{ ...l, quantidade: Math.min(q, l.produto.estoqueAtual) }];
  }));

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const lista = prods.data?.content ?? [];
    const exato = lista.find((p) => p.ean === termo.trim() || p.codigo.toLowerCase() === termo.trim().toLowerCase());
    const alvo = exato ?? (lista.length === 1 ? lista[0] : undefined);
    if (alvo && alvo.estoqueAtual > 0) { add(alvo); setTermo(''); }
  };

  const limpar = () => { setLinhas([]); setCliente(null); setDesconto(''); setFrete(''); setForma('PIX'); setParcelas(1); };

  const body = () => ({
    clienteId: cliente?.id ?? null,
    formaPagamento: forma,
    quantidadeParcelas: parcelas,
    valorDesconto: Number(desconto || 0),
    valorFrete: Number(frete || 0),
    itens: linhas.map((l) => ({ produtoId: l.produto.id, quantidade: l.quantidade })),
  });

  const finalizar = async () => {
    const v = await action.run(() => api.post<Venda>('/vendas/pdv', body()));
    if (v) { setFeita(v); limpar(); prods.reload(); }
  };
  const salvarOrcamento = async () => {
    const v = await action.run(() => api.post<Venda>('/vendas', body()));
    if (v) {
      limpar();
      toast.ok(`Orçamento #${v.id} salvo`, { label: 'Abrir', run: () => navigate(`/vendas?id=${v.id}`) });
    }
  };

  const precisaCliente = !aVista && forma !== 'CARTAO_CREDITO' && !cliente;
  const podeFinalizar = linhas.length > 0 && !precisaCliente;

  useHotkey((e) => e.key === 'F9', (e) => { e.preventDefault(); if (podeFinalizar && !action.busy) finalizar(); });

  return (
    <>
      <PageHeader title="Ponto de venda" sub={<>Busque pelo nome, código ou código de barras. <span className="kbd">/</span> busca · <span className="kbd">F9</span> finaliza</>} />
      <div className="pdv">
        <div className="stack">
          <div className="pdv-search">
            <SearchInput ref={searchRef} autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={onSearchKey}
              placeholder="Buscar produto ou ler código de barras" aria-label="Buscar produto" />
          </div>
          {cats.data && cats.data.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <Segmented label="Categoria" value={categoria} onChange={setCategoria}
                options={[{ value: 'todas', label: 'Todas' }, ...cats.data.filter((c) => c.ativo).map((c) => ({ value: String(c.id), label: c.nome }))]} />
            </div>
          )}
          {prods.error ? <Card pad><ErrorState message={prods.error} onRetry={prods.reload} /></Card>
            : !prods.data ? <div className="prod-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="prod-tile"><div className="tile-foto" /><div className="tile-body"><Skeleton h={14} /><Skeleton w="60%" h={12} /><Skeleton w={80} h={18} /></div></div>)}</div>
            : prods.data.content.length === 0 ? <Card><Empty icon="search" title="Nenhum produto encontrado" text={termo ? `Nada corresponde a “${termo}”.` : 'Cadastre produtos para vendê-los aqui.'} /></Card>
            : (
              <div className="prod-grid">
                {prods.data.content.map((p) => {
                  const noCarrinho = linhas.find((l) => l.produto.id === p.id)?.quantidade ?? 0;
                  const sem = p.estoqueAtual <= 0;
                  return (
                    <button key={p.id} className="prod-tile" disabled={sem} onClick={() => add(p)} aria-label={`Adicionar ${p.descricao}`}>
                      <div className="tile-foto">
                        <ProdutoFoto url={p.imagemUrl} alt="" />
                        {noCarrinho > 0 && <span className="badge badge-success plain num">{qty(noCarrinho)} no carrinho</span>}
                      </div>
                      <div className="tile-body">
                      <span className="mono muted">{p.codigo}</span>
                      <span className="name">{p.descricao}</span>
                      <div className="row-between">
                        <span className="price">{money(p.precoVenda)}</span>
                        <span className={`num ${sem ? 'neg' : p.abaixoDoMinimo ? '' : 'muted'}`} style={{ fontSize: 12, color: !sem && p.abaixoDoMinimo ? 'var(--warning)' : undefined }}>
                          {sem ? 'Sem estoque' : `${qty(p.estoqueAtual)} ${p.unidade}`}
                        </span>
                      </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        <section className="card cart" aria-label="Carrinho">
          <div className="card-head">
            <h2 className="section-title">Venda atual</h2>
            {linhas.length > 0 && <Button size="sm" variant="ghost" onClick={limpar}>Limpar</Button>}
          </div>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--hairline)' }}>
            <ClientePicker value={cliente} onChange={setCliente} />
          </div>
          <div className="cart-items">
            {linhas.length === 0 ? (
              <Empty icon="pdv" title="Carrinho vazio" text="Clique em um produto ou leia o código de barras para começar." />
            ) : linhas.map((l) => (
              <div key={l.produto.id} className="cart-item">
                <div className="row" style={{ minWidth: 0, alignItems: 'center' }}>
                  <ProdutoFoto url={l.produto.imagemUrl} alt="" size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.produto.descricao}</div>
                    <div className="muted num" style={{ fontSize: 12 }}>{money(l.produto.precoVenda)} / {l.produto.unidade}</div>
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 600, textAlign: 'right' }}>{money(l.quantidade * l.produto.precoVenda)}</div>
                <div className="qty">
                  <button aria-label="Diminuir" onClick={() => setQtd(l.produto.id, l.quantidade - 1)}><Icon name={l.quantidade === 1 ? 'trash' : 'minus'} size={14} /></button>
                  <input aria-label={`Quantidade de ${l.produto.descricao}`} value={l.quantidade} inputMode="numeric"
                    onChange={(e) => setQtd(l.produto.id, Number(e.target.value.replace(/\D/g, '')) || 0)} />
                  <button aria-label="Aumentar" onClick={() => add(l.produto)}><Icon name="plus" size={14} /></button>
                </div>
                <div className="muted num" style={{ fontSize: 12, textAlign: 'right', alignSelf: 'center' }}>{qty(l.produto.estoqueAtual)} em estoque</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px 20px' }} className="stack">
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>Pagamento</div>
              <div className="pay-grid">
                {FORMAS.filter((f) => f.value !== 'CHEQUE' && f.value !== 'TRANSFERENCIA').map((f) => (
                  <button key={f.value} className="pay-opt" aria-pressed={forma === f.value} onClick={() => setForma(f.value)}>{f.short}</button>
                ))}
              </div>
            </div>
            <div className="form-grid">
              {!aVista && (
                <Field label="Parcelas" className="col-4">
                  {(id) => <Select id={id} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x {total ? money(total / n) : ''}</option>)}
                  </Select>}
                </Field>
              )}
              <Field label="Desconto (R$)" className={aVista ? 'col-6' : 'col-4'}>{(id) => <NumberInput id={id} value={desconto} onChange={setDesconto} placeholder="0,00" />}</Field>
              <Field label="Frete (R$)" className={aVista ? 'col-6' : 'col-4'}>{(id) => <NumberInput id={id} value={frete} onChange={setFrete} placeholder="0,00" />}</Field>
            </div>
            <div className="totals">
              <span className="muted">Subtotal · {qty(itensCount)} {itensCount === 1 ? 'item' : 'itens'}</span><span className="right">{money(subtotal)}</span>
              {Number(desconto) > 0 && <><span className="muted">Desconto</span><span className="right neg">− {money(Number(desconto))}</span></>}
              {Number(frete) > 0 && <><span className="muted">Frete</span><span className="right">{money(Number(frete))}</span></>}
              <span className="grand">Total</span><span className="grand right">{money(total)}</span>
            </div>
            {precisaCliente && <Alert tone="warning">Venda no {FORMAS.find((f) => f.value === forma)?.label.toLowerCase()} exige um cliente identificado.</Alert>}
            {action.error && <Alert>{action.error}</Alert>}
            <div className="row">
              <Button onClick={salvarOrcamento} disabled={!linhas.length || action.busy}>Salvar orçamento</Button>
              <Button variant="primary" size="lg" className="grow" loading={action.busy} disabled={!podeFinalizar} onClick={finalizar}>
                Finalizar {total > 0 ? money(total) : 'venda'}
              </Button>
            </div>
          </div>
        </section>
      </div>
      <VendaConcluida venda={feita} onClose={() => { setFeita(null); searchRef.current?.focus(); }} />
    </>
  );
}

function VendaConcluida({ venda, onClose }: { venda: Venda | null; onClose: () => void }) {
  const toast = useToast();
  const emitir = useAction();
  const [nota, setNota] = useState<NotaFiscal | null>(null);
  useEffect(() => { setNota(null); }, [venda?.id]);
  if (!venda) return null;

  const emitirNota = async () => {
    const n = await emitir.run(() => api.post<NotaFiscal>('/notas-fiscais', { vendaId: venda.id }));
    if (n) {
      setNota(n);
      if (n.status === 'AUTORIZADA') toast.ok(`NF-e ${n.numero} autorizada`);
      else toast.err(`NF-e rejeitada: ${n.motivoStatus}`);
    }
  };

  return (
    <Modal open onClose={onClose} label="Venda finalizada"
      footer={<>
        <Button onClick={() => { onClose(); navigate(`/vendas?id=${venda.id}`); }}>Ver venda</Button>
        {nota?.status === 'AUTORIZADA'
          ? <>
              <Button icon="printer" loading={emitir.busy} onClick={() => emitir.run(() => imprimirDanfe(nota.id))}>Imprimir DANFE</Button>
              <Button variant="primary" data-autofocus onClick={onClose}>Nova venda</Button>
            </>
          : <Button variant="primary" data-autofocus icon="file" loading={emitir.busy} onClick={emitirNota}>Emitir NF-e</Button>}
      </>}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
        <div className="success-mark"><Icon name="check" size={26} /></div>
        <div>
          <p className="section-title" style={{ fontSize: 18 }}>Venda #{venda.id} finalizada</p>
          <p className="muted" style={{ marginTop: 4 }}>{venda.clienteNome} · {FORMAS.find((f) => f.value === venda.formaPagamento)?.label}{venda.quantidadeParcelas > 1 ? ` em ${venda.quantidadeParcelas}x` : ''}</p>
        </div>
        <p className="num" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.6px' }}>{money(venda.valorTotal)}</p>
        {emitir.error && <Alert>{emitir.error}</Alert>}
        {nota && (
          <div className="card card-pad" style={{ width: '100%', textAlign: 'left' }}>
            <div className="row-between"><span className="section-title">NF-e {nota.numero} · série {nota.serie}</span>
              <span className={`badge ${nota.status === 'AUTORIZADA' ? 'badge-success' : 'badge-danger'}`}>{nota.status === 'AUTORIZADA' ? 'Autorizada' : 'Rejeitada'}</span></div>
            <p className="chave muted" style={{ marginTop: 8 }}>{nota.chaveAcesso.replace(/(.{4})/g, '$1 ')}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ClientePicker({ value, onChange }: { value: Cliente | null; onChange: (c: Cliente | null) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 200);
  const res = useAsync(() => (open ? api.get<Page<Cliente>>('/clientes', { termo: dq, ativo: true, size: 6 }) : Promise.resolve(undefined)), [dq, open]);

  if (value) {
    return (
      <div className="row-between">
        <div className="row" style={{ minWidth: 0 }}>
          <span className="avatar" style={{ width: 28, height: 28 }}><Icon name="user" size={14} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500 }}>{value.nome}</div>
            <div className="muted" style={{ fontSize: 12 }}>{value.limiteCredito > 0 ? `Limite de crédito ${money(value.limiteCredito)}` : 'Sem limite de crédito definido'}</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Trocar</Button>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <SearchInput value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Cliente (opcional): consumidor final" aria-label="Buscar cliente" />
      {open && res.data && (
        <div className="menu" style={{ left: 0, right: 0, top: 'calc(100% + 4px)' }} role="listbox">
          {res.data.content.length === 0 ? <div className="muted" style={{ padding: 10 }}>Nenhum cliente encontrado.</div>
            : res.data.content.map((c) => (
              <button key={c.id} className="menu-item" role="option" aria-selected="false" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c); setQ(''); setOpen(false); }}>
                <Icon name="user" size={15} /><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
