import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { date, dateTime, daysAhead, money, qty } from '../lib/format';
import { navigate, useRoute } from '../lib/router';
import type { Fornecedor, Page, PedidoCompra, Produto, StatusCompra } from '../lib/types';
import { Alert, Button, Card, CompraBadge, Empty, ErrorState, Field, Input, NumberInput, PageHeader, Pagination, Segmented, Select, TableSkeleton, Textarea } from '../components/ui';
import { Confirm, Drawer, Modal, useToast } from '../components/overlay';
import { FornecedorPicker, ProdutoPicker } from '../components/pickers';

export function Compras() {
  const { query } = useRoute();
  const [status, setStatus] = useState<'TODOS' | StatusCompra>('TODOS');
  const [page, setPage] = useState(0);
  const lista = useAsync(() => api.get<Page<PedidoCompra>>('/compras', { status: status === 'TODOS' ? undefined : status, page, size: 20, sort: 'id,desc' }), [status, page]);
  const id = query.get('id');
  const novo = query.get('novo') === '1';

  return (
    <>
      <PageHeader title="Compras" sub="Pedidos a fornecedores. O recebimento dá entrada no estoque e gera as contas a pagar."
        actions={<Button variant="primary" icon="plus" onClick={() => navigate('/compras?novo=1')}>Novo pedido</Button>} />
      <Card>
        <div className="toolbar">
          <Segmented label="Status" value={status} onChange={(v) => { setStatus(v); setPage(0); }}
            options={[{ value: 'TODOS', label: 'Todos' }, { value: 'ABERTO', label: 'Abertos' }, { value: 'RECEBIDO', label: 'Recebidos' }, { value: 'CANCELADO', label: 'Cancelados' }]} />
        </div>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton />
          : lista.data.content.length === 0 ? <Empty icon="truck" title="Nenhum pedido de compra" text="Crie um pedido para repor o estoque; ao receber, o custo médio e o financeiro são atualizados."
              action={<Button variant="primary" icon="plus" onClick={() => navigate('/compras?novo=1')}>Novo pedido</Button>} />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Pedido</th><th>Fornecedor</th><th>Previsão</th><th>Status</th><th className="right">Itens</th><th className="right">Total</th></tr></thead>
                  <tbody>
                    {lista.data.content.map((p) => (
                      <tr key={p.id} className="clickable" tabIndex={0} onClick={() => navigate(`/compras?id=${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/compras?id=${p.id}`)}>
                        <td><div className="cell-title num">#{p.id}</div><div className="cell-sub">{date(p.criadoEm)}</div></td>
                        <td>{p.fornecedorNome}</td>
                        <td className="num">{p.status === 'RECEBIDO' ? <span className="muted">Recebido {date(p.dataRecebimento)}</span> : date(p.previsaoEntrega)}</td>
                        <td><CompraBadge s={p.status} /></td>
                        <td className="right num">{p.itens.length}</td>
                        <td className="right num" style={{ fontWeight: 500 }}>{money(p.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={lista.data.page.totalPages} total={lista.data.page.totalElements} onPage={setPage} label="pedidos" />
            </>
          )}
      </Card>
      {novo && <NovoPedido onClose={() => navigate('/compras')} onSaved={(p) => { lista.reload(); navigate(`/compras?id=${p.id}`); }} />}
      {id && <PedidoDrawer id={Number(id)} onClose={() => navigate('/compras')} onChange={lista.reload} />}
    </>
  );
}

interface Linha { produto: Produto; quantidade: number | ''; custo: number | '' }

function NovoPedido({ onClose, onSaved }: { onClose: () => void; onSaved: (p: PedidoCompra) => void }) {
  const toast = useToast();
  const act = useAction();
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [frete, setFrete] = useState<number | ''>('');
  const [parcelas, setParcelas] = useState(1);
  const [previsao, setPrevisao] = useState(daysAhead(7));
  const [obs, setObs] = useState('');

  const add = (p: Produto) => setLinhas((ls) => ls.some((l) => l.produto.id === p.id) ? ls : [...ls, { produto: p, quantidade: 1, custo: Number(p.precoCusto.toFixed(2)) }]);
  const upd = (i: number, patch: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const totalItens = linhas.reduce((s, l) => s + Number(l.quantidade || 0) * Number(l.custo || 0), 0);
  const total = totalItens + Number(frete || 0);

  const salvar = async () => {
    if (!fornecedor) return;
    const p = await act.run(() => api.post<PedidoCompra>('/compras', {
      fornecedorId: fornecedor.id, previsaoEntrega: previsao || null, quantidadeParcelas: parcelas, valorFrete: Number(frete || 0),
      observacao: obs || null, itens: linhas.map((l) => ({ produtoId: l.produto.id, quantidade: Number(l.quantidade), custoUnitario: Number(l.custo || 0) })),
    }));
    if (p) { toast.ok(`Pedido #${p.id} criado`); onSaved(p); }
  };

  return (
    <Drawer open onClose={onClose} wide title="Novo pedido de compra"
      footer={<><Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={act.busy} disabled={!fornecedor || !linhas.length || linhas.some((l) => !l.quantidade)} onClick={salvar}>Criar pedido · {money(total)}</Button></>}>
      <div className="stack">
        {act.error && <Alert>{act.error}</Alert>}
        <Field label="Fornecedor">{() => <FornecedorPicker value={fornecedor} onChange={setFornecedor} />}</Field>
        <div>
          <div className="field-label" style={{ marginBottom: 6 }}>Itens</div>
          <ProdutoPicker onPick={add} placeholder="Adicionar produto ao pedido" />
          {linhas.length > 0 && (
            <div className="card" style={{ marginTop: 10 }}>
              <table className="table">
                <thead><tr><th>Produto</th><th className="right" style={{ width: 110 }}>Qtd.</th><th className="right" style={{ width: 130 }}>Custo unit.</th><th className="right">Subtotal</th><th style={{ width: 44 }} /></tr></thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={l.produto.id}>
                      <td><div className="cell-title">{l.produto.descricao}</div><div className="cell-sub num">Em estoque {qty(l.produto.estoqueAtual)} · custo atual {money(l.produto.precoCusto)}</div></td>
                      <td><NumberInput aria-label="Quantidade" step="0.001" value={l.quantidade} onChange={(v) => upd(i, { quantidade: v })} style={{ textAlign: 'right' }} /></td>
                      <td><NumberInput aria-label="Custo unitário" value={l.custo} onChange={(v) => upd(i, { custo: v })} style={{ textAlign: 'right' }} /></td>
                      <td className="right num">{money(Number(l.quantidade || 0) * Number(l.custo || 0))}</td>
                      <td><Button size="sm" variant="ghost" icon="trash" aria-label="Remover item" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="form-grid">
          <Field label="Frete (R$)" className="col-4" hint="Rateado no custo dos itens.">{(i) => <NumberInput id={i} value={frete} onChange={setFrete} />}</Field>
          <Field label="Parcelas" className="col-4">{(i) => <Select id={i} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 10, 12].map((n) => <option key={n} value={n}>{n}x</option>)}</Select>}</Field>
          <Field label="Previsão de entrega" className="col-4">{(i) => <Input id={i} type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />}</Field>
          <Field label="Observação" className="col-12">{(i) => <Textarea id={i} value={obs} onChange={(e) => setObs(e.target.value)} />}</Field>
        </div>
        <div className="totals" style={{ maxWidth: 320, marginLeft: 'auto' }}>
          <span className="muted">Itens</span><span className="right">{money(totalItens)}</span>
          <span className="muted">Frete</span><span className="right">{money(Number(frete || 0))}</span>
          <span className="grand">Total</span><span className="grand right">{money(total)}</span>
        </div>
      </div>
    </Drawer>
  );
}

function PedidoDrawer({ id, onClose, onChange }: { id: number; onClose: () => void; onChange: () => void }) {
  const toast = useToast();
  const pedido = useAsync(() => api.get<PedidoCompra>(`/compras/${id}`), [id]);
  const act = useAction();
  const [receber, setReceber] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [nota, setNota] = useState('');
  const [venc, setVenc] = useState(daysAhead(30));
  const p = pedido.data;

  const doReceber = async () => {
    const r = await act.run(() => api.post<PedidoCompra>(`/compras/${id}/receber`, { numeroNotaFornecedor: nota || null, primeiroVencimento: venc || null }));
    if (r) { pedido.setData(r); setReceber(false); toast.ok(`Pedido #${id} recebido: estoque e contas a pagar atualizados`); onChange(); }
  };
  const doCancelar = async () => {
    const r = await act.run(() => api.post<PedidoCompra>(`/compras/${id}/cancelar`));
    if (r) { pedido.setData(r); setCancelar(false); toast.ok(`Pedido #${id} cancelado`); onChange(); }
  };

  return (
    <Drawer open onClose={onClose} wide title={p ? <span className="row">Pedido #{p.id} <CompraBadge s={p.status} /></span> : `Pedido #${id}`}
      sub={p && `${p.fornecedorNome} · criado em ${dateTime(p.criadoEm)}`}
      footer={p?.status === 'ABERTO' && <>
        <Button variant="ghost" onClick={() => setCancelar(true)}>Cancelar pedido</Button><span className="grow" />
        <Button variant="primary" icon="check" onClick={() => setReceber(true)}>Receber mercadoria</Button></>}>
      {pedido.error ? <ErrorState message={pedido.error} onRetry={pedido.reload} /> : !p ? <TableSkeleton rows={4} cols={4} /> : (
        <div className="stack">
          {act.error && <Alert>{act.error}</Alert>}
          <div className="card">
            <table className="table">
              <thead><tr><th>Produto</th><th className="right">Qtd.</th><th className="right">Custo unit.</th><th className="right">Subtotal</th></tr></thead>
              <tbody>{p.itens.map((i) => (
                <tr key={i.id}><td><div className="cell-title">{i.produtoDescricao}</div><div className="cell-sub mono">{i.produtoCodigo}</div></td>
                  <td className="right num">{qty(i.quantidade)}</td><td className="right num">{money(i.custoUnitario)}</td><td className="right num">{money(i.subtotal)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="grid grid-2">
            <dl className="dl">
              <dt>Previsão</dt><dd>{date(p.previsaoEntrega)}</dd>
              <dt>Recebido em</dt><dd>{dateTime(p.dataRecebimento)}</dd>
              <dt>NF do fornecedor</dt><dd>{p.numeroNotaFornecedor ?? '—'}</dd>
              <dt>Parcelas</dt><dd>{p.quantidadeParcelas}x</dd>
              <dt>Criado por</dt><dd>{p.usuario}</dd>
              {p.observacao && <><dt>Observação</dt><dd>{p.observacao}</dd></>}
            </dl>
            <div className="totals" style={{ alignSelf: 'start' }}>
              <span className="muted">Itens</span><span className="right">{money(p.valorTotal - p.valorFrete)}</span>
              <span className="muted">Frete</span><span className="right">{money(p.valorFrete)}</span>
              <span className="grand">Total</span><span className="grand right">{money(p.valorTotal)}</span>
            </div>
          </div>
        </div>
      )}
      <Modal open={receber} onClose={() => setReceber(false)} label="Receber mercadoria"
        footer={<><Button onClick={() => setReceber(false)}>Voltar</Button><Button variant="primary" loading={act.busy} onClick={doReceber}>Confirmar recebimento</Button></>}>
        <div className="stack">
          <div><h2 className="section-title" style={{ fontSize: 17 }}>Receber pedido #{id}</h2>
            <p className="muted" style={{ marginTop: 4 }}>Os itens entram no estoque com o frete rateado no custo, e {p?.quantidadeParcelas ?? 1} conta(s) a pagar são criadas.</p></div>
          <div className="form-grid">
            <Field label="Nº da NF do fornecedor" className="col-6">{(i) => <Input id={i} value={nota} onChange={(e) => setNota(e.target.value)} data-autofocus />}</Field>
            <Field label="1º vencimento" className="col-6">{(i) => <Input id={i} type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />}</Field>
          </div>
        </div>
      </Modal>
      <Confirm open={cancelar} onClose={() => setCancelar(false)} danger busy={act.busy} title={`Cancelar o pedido #${id}?`}
        text="Nada entrou no estoque ainda; o pedido só deixa de valer." confirmLabel="Cancelar pedido" onConfirm={doCancelar} />
    </Drawer>
  );
}
