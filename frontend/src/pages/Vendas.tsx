import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { chave, date, dateTime, daysAgo, formaLabel, money, qty, today } from '../lib/format';
import { href, navigate, useRoute } from '../lib/router';
import { useAuth } from '../lib/auth';
import type { NotaFiscal, Page, StatusVenda, Venda } from '../lib/types';
import { Alert, Button, Card, Empty, ErrorState, Field, NotaBadge, PageHeader, Pagination, Segmented, Select, TableSkeleton, Textarea, VendaBadge } from '../components/ui';
import { Confirm, Drawer, useToast } from '../components/overlay';
import { Icon } from '../components/icons';
import { imprimirDanfe } from '../lib/danfe';

type Filtro = 'TODAS' | StatusVenda;
const PERIODOS = { '7': 'Últimos 7 dias', '30': 'Últimos 30 dias', '90': 'Últimos 90 dias', '0': 'Todo o período' } as const;

export function Vendas() {
  const { query } = useRoute();
  const [status, setStatus] = useState<Filtro>('TODAS');
  const [periodo, setPeriodo] = useState<keyof typeof PERIODOS>('30');
  const [page, setPage] = useState(0);
  const lista = useAsync(() => api.get<Page<Venda>>('/vendas', {
    status: status === 'TODAS' ? undefined : status,
    de: periodo === '0' ? undefined : daysAgo(Number(periodo) - 1), ate: periodo === '0' ? undefined : today(),
    page, size: 20, sort: 'id,desc',
  }), [status, periodo, page]);

  const abertaId = query.get('id');

  return (
    <>
      <PageHeader title="Vendas" sub="Orçamentos, vendas confirmadas e faturadas."
        actions={<a className="btn btn-primary" href={href('/pdv')}><Icon name="plus" size={16} />Nova venda</a>} />
      <Card>
        <div className="toolbar">
          <Segmented label="Status" value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={[
            { value: 'TODAS', label: 'Todas' }, { value: 'ORCAMENTO', label: 'Orçamentos' }, { value: 'CONFIRMADA', label: 'Confirmadas' },
            { value: 'FATURADA', label: 'Faturadas' }, { value: 'CANCELADA', label: 'Canceladas' }]} />
          <Select aria-label="Período" value={periodo} onChange={(e) => { setPeriodo(e.target.value as keyof typeof PERIODOS); setPage(0); }} style={{ width: 190, marginLeft: 'auto' }}>
            {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton />
          : lista.data.content.length === 0 ? <Empty icon="receipt" title="Nenhuma venda neste filtro" text="Vendas feitas no PDV ou orçamentos salvos aparecem aqui." action={<a className="btn btn-secondary" href={href('/pdv')}>Abrir PDV</a>} />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Venda</th><th>Cliente</th><th>Pagamento</th><th>Status</th><th className="right">Itens</th><th className="right">Total</th></tr></thead>
                  <tbody>
                    {lista.data.content.map((v) => (
                      <tr key={v.id} className="clickable" tabIndex={0} onClick={() => navigate(`/vendas?id=${v.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/vendas?id=${v.id}`)}>
                        <td><div className="cell-title num">#{v.id}</div><div className="cell-sub">{dateTime(v.dataConfirmacao ?? v.criadoEm)}</div></td>
                        <td><div className="row">{v.vendedor === 'Loja online' ? (v.observacao?.match(/Cliente: ([^·]+)/)?.[1]?.trim() ?? v.clienteNome) : v.clienteNome}{v.vendedor === 'Loja online' && <span className="badge badge-info plain">Loja</span>}</div><div className="cell-sub">{v.vendedor}</div></td>
                        <td>{formaLabel(v.formaPagamento)}{v.quantidadeParcelas > 1 && <span className="muted"> · {v.quantidadeParcelas}x</span>}</td>
                        <td><VendaBadge s={v.status} /></td>
                        <td className="right num">{qty(v.itens.reduce((s, i) => s + i.quantidade, 0))}</td>
                        <td className="right num" style={{ fontWeight: 500 }}>{money(v.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={lista.data.page.totalPages} total={lista.data.page.totalElements} onPage={setPage} label="vendas" />
            </>
          )}
      </Card>
      {abertaId && <VendaDrawer id={Number(abertaId)} onClose={() => navigate('/vendas')} onChange={lista.reload} />}
    </>
  );
}

function VendaDrawer({ id, onClose, onChange }: { id: number; onClose: () => void; onChange: () => void }) {
  const { pode } = useAuth();
  const toast = useToast();
  const venda = useAsync(() => api.get<Venda>(`/vendas/${id}`), [id]);
  const notas = useAsync(() => api.get<NotaFiscal[]>(`/notas-fiscais/venda/${id}`).catch(() => [] as NotaFiscal[]), [id]);
  const act = useAction();
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const v = venda.data;
  const autorizada = notas.data?.find((n) => n.status === 'AUTORIZADA');

  const done = (msg: string, nv?: Venda) => { if (nv) venda.setData(nv); toast.ok(msg); onChange(); notas.reload(); };
  const confirmar = async () => {
    const nv = await act.run(() => api.post<Venda>(`/vendas/${id}/confirmar`));
    if (nv) done(`Venda #${id} confirmada. Estoque baixado e títulos gerados.`, nv);
  };
  const emitir = async () => {
    const n = await act.run(() => api.post<NotaFiscal>('/notas-fiscais', { vendaId: id }));
    if (n) {
      if (n.status === 'AUTORIZADA') { toast.ok(`NF-e ${n.numero} autorizada`, { label: 'Abrir', run: () => navigate(`/notas?id=${n.id}`) }); }
      else toast.err(`NF-e rejeitada: ${n.motivoStatus}`);
      venda.reload(); notas.reload(); onChange();
    }
  };
  const cancelar = async () => {
    const nv = await act.run(() => api.post<Venda>(`/vendas/${id}/cancelar`, { motivo }));
    if (nv) { setCancelando(false); setMotivo(''); done(`Venda #${id} cancelada`, nv); }
  };

  const footer = v && (
    <>
      {pode('GERENTE') && v.status !== 'CANCELADA' && v.status !== 'FATURADA' && <Button variant="ghost" onClick={() => setCancelando(true)}>Cancelar venda</Button>}
      <span className="grow" />
      {v.status === 'ORCAMENTO' && <Button variant="primary" icon="check" loading={act.busy} onClick={confirmar}>Confirmar venda</Button>}
      {v.status === 'CONFIRMADA' && <Button variant="primary" icon="file" loading={act.busy} onClick={emitir}>Emitir NF-e</Button>}
      {v.status === 'FATURADA' && notas.data?.[0] && <a className="btn btn-secondary" href={href(`/notas?id=${notas.data.find((n) => n.status === 'AUTORIZADA')?.id ?? notas.data[0].id}`)}><Icon name="file" size={16} />Ver NF-e</a>}
      {v.status === 'FATURADA' && autorizada && <Button variant="primary" icon="printer" loading={act.busy} onClick={() => act.run(() => imprimirDanfe(autorizada.id))}>Imprimir DANFE</Button>}
    </>
  );

  return (
    <Drawer open onClose={onClose} wide title={v ? <span className="row">Venda #{v.id} <VendaBadge s={v.status} /></span> : `Venda #${id}`}
      sub={v && `${v.clienteNome} · ${dateTime(v.criadoEm)}`} footer={footer}>
      {venda.error ? <ErrorState message={venda.error} onRetry={venda.reload} /> : !v ? <TableSkeleton rows={4} cols={4} /> : (
        <div className="stack">
          {act.error && <Alert>{act.error}</Alert>}
          {v.status === 'FATURADA' && <Alert tone="info">Venda faturada. Para cancelar, cancele antes a NF-e (até 24 horas após a autorização).</Alert>}
          {v.status === 'CANCELADA' && <Alert tone="warning">Cancelada em {dateTime(v.dataCancelamento)}: {v.motivoCancelamento}</Alert>}
          <div className="card">
            <table className="table">
              <thead><tr><th>Produto</th><th className="right">Qtd.</th><th className="right">Preço</th><th className="right">Desconto</th><th className="right">Subtotal</th></tr></thead>
              <tbody>
                {v.itens.map((i) => (
                  <tr key={i.id}>
                    <td><div className="cell-title">{i.produtoDescricao}</div><div className="cell-sub mono">{i.produtoCodigo}</div></td>
                    <td className="right num">{qty(i.quantidade)} {i.unidade}</td>
                    <td className="right num">{money(i.precoUnitario)}</td>
                    <td className="right num muted">{i.valorDesconto > 0 ? money(i.valorDesconto) : '—'}</td>
                    <td className="right num">{money(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-2">
            <dl className="dl">
              <dt>Pagamento</dt><dd>{formaLabel(v.formaPagamento)}{v.quantidadeParcelas > 1 ? ` em ${v.quantidadeParcelas}x` : ''}</dd>
              <dt>Vendedor</dt><dd>{v.vendedor}</dd>
              <dt>Confirmada em</dt><dd>{dateTime(v.dataConfirmacao)}</dd>
              {v.observacao && <><dt>Observação</dt><dd>{v.observacao}</dd></>}
            </dl>
            <div className="totals">
              <span className="muted">Subtotal</span><span className="right">{money(v.subtotal)}</span>
              <span className="muted">Desconto</span><span className="right">{v.valorDesconto > 0 ? `− ${money(v.valorDesconto)}` : money(0)}</span>
              <span className="muted">Frete</span><span className="right">{money(v.valorFrete)}</span>
              <span className="grand">Total</span><span className="grand right">{money(v.valorTotal)}</span>
            </div>
          </div>
          {notas.data && notas.data.length > 0 && (
            <div>
              <h3 className="section-title" style={{ marginBottom: 10 }}>Notas fiscais</h3>
              <div className="card">
                {notas.data.map((n) => (
                  <a key={n.id} href={href(`/notas?id=${n.id}`)} className="list-row" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Icon name="file" size={16} className="muted" />
                    <div className="grow">
                      <div style={{ fontWeight: 500 }}>NF-e {n.numero} · série {n.serie}</div>
                      <div className="chave muted" style={{ fontSize: 11.5 }}>{chave(n.chaveAcesso)}</div>
                    </div>
                    <span className="muted num" style={{ fontSize: 12 }}>{date(n.dataEmissao)}</span>
                    <NotaBadge s={n.status} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <Confirm open={cancelando} onClose={() => setCancelando(false)} danger busy={act.busy} confirmLabel="Cancelar venda" onConfirm={cancelar}
        title={`Cancelar a venda #${id}?`}
        text={v?.status === 'CONFIRMADA' ? 'Os itens voltam para o estoque e os títulos desta venda são estornados no financeiro.' : 'O orçamento deixa de valer.'}>
        <Field label="Motivo" hint="Mínimo de 5 caracteres; fica registrado na venda.">
          {(fid) => <Textarea id={fid} value={motivo} onChange={(e) => setMotivo(e.target.value)} data-autofocus />}
        </Field>
      </Confirm>
    </Drawer>
  );
}
