import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { date, daysAhead, FORMAS, money, relativeDays, today } from '../lib/format';
import { navigate } from '../lib/router';
import type { ContaPagar, ContaReceber, FluxoCaixa, FormaPagamento, Page } from '../lib/types';
import { Alert, Button, Card, Empty, ErrorState, Field, Input, Kpi, NumberInput, PageHeader, Pagination, Segmented, Select, Skeleton, TableSkeleton, Tabs, TituloBadge } from '../components/ui';
import { Confirm, Modal, useToast } from '../components/overlay';

type Lado = 'receber' | 'pagar';
type Filtro = 'abertos' | 'vencidos' | 'pagos' | 'todos';
type Titulo = (ContaReceber | ContaPagar) & { parte: string | null; pago: number | null; dataPgto: string | null };

const PERIODO_FLUXO = 30;

export function Financeiro() {
  const [lado, setLado] = useState<Lado>('receber');
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [page, setPage] = useState(0);
  const [baixa, setBaixa] = useState<Titulo | null>(null);
  const [cancelar, setCancelar] = useState<Titulo | null>(null);
  const [nova, setNova] = useState(false);
  const toast = useToast();
  const act = useAction();

  const fluxo = useAsync(() => api.get<FluxoCaixa>('/financeiro/fluxo-caixa', { inicio: today(), fim: daysAhead(PERIODO_FLUXO) }), []);
  const lista = useAsync(async () => {
    const params = {
      status: filtro === 'abertos' || filtro === 'vencidos' ? 'ABERTO' : filtro === 'pagos' ? 'PAGO' : undefined,
      vencidas: filtro === 'vencidos' ? true : undefined, page, size: 25, sort: filtro === 'pagos' ? 'vencimento,desc' : 'vencimento',
    };
    if (lado === 'receber') {
      const r = await api.get<Page<ContaReceber>>('/financeiro/receber', params);
      return { ...r, content: r.content.map((c): Titulo => ({ ...c, parte: c.clienteNome, pago: c.valorRecebido, dataPgto: c.dataRecebimento })) };
    }
    const r = await api.get<Page<ContaPagar>>('/financeiro/pagar', params);
    return { ...r, content: r.content.map((c): Titulo => ({ ...c, parte: c.fornecedorNome, pago: c.valorPago, dataPgto: c.dataPagamento })) };
  }, [lado, filtro, page]);

  const recarregar = () => { lista.reload(); fluxo.reload(); };
  const doCancelar = async () => {
    if (!cancelar) return;
    const r = await act.run(() => api.post(`/financeiro/${lado}/${cancelar.id}/cancelar`));
    if (r) { toast.ok('Título cancelado'); setCancelar(null); recarregar(); }
  };
  const fx = fluxo.data;

  return (
    <>
      <PageHeader title="Financeiro" sub="Contas a receber e a pagar, baixas e previsão de caixa."
        actions={<Button variant="primary" icon="plus" onClick={() => setNova(true)}>{lado === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'}</Button>} />

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        {!fx ? [1, 2, 3, 4].map((i) => <div key={i} className="card kpi"><Skeleton w={110} h={12} /><div style={{ height: 14 }} /><Skeleton w={130} h={28} /></div>) : (
          <>
            <Kpi icon="down" label={`A receber · ${PERIODO_FLUXO} dias`} value={money(fx.aReceber)} foot="Títulos em aberto que vencem no período" />
            <Kpi icon="up" label={`A pagar · ${PERIODO_FLUXO} dias`} value={money(fx.aPagar)} foot="Títulos em aberto que vencem no período" />
            <Kpi icon="coins" label="Realizado no período" value={money(fx.saldoRealizado)} tone={fx.saldoRealizado < 0 ? 'danger' : undefined}
              foot={`${money(fx.recebido)} recebido · ${money(fx.pago)} pago`} />
            <Kpi icon="calendar" label="Saldo previsto" value={money(fx.saldoPrevisto)} tone={fx.saldoPrevisto < 0 ? 'danger' : undefined} foot="Realizado + a receber − a pagar" />
          </>
        )}
      </div>

      <Tabs value={lado} onChange={(v) => { setLado(v); setPage(0); }} tabs={[{ value: 'receber', label: 'Contas a receber' }, { value: 'pagar', label: 'Contas a pagar' }]} />
      <Card>
        <div className="toolbar">
          <Segmented label="Situação" value={filtro} onChange={(v) => { setFiltro(v); setPage(0); }}
            options={[{ value: 'abertos', label: 'Em aberto' }, { value: 'vencidos', label: 'Vencidos' }, { value: 'pagos', label: lado === 'receber' ? 'Recebidos' : 'Pagos' }, { value: 'todos', label: 'Todos' }]} />
        </div>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton cols={5} />
          : lista.data.content.length === 0 ? <Empty icon="wallet" title={filtro === 'vencidos' ? 'Nada vencido' : 'Nenhum título neste filtro'}
              text={lado === 'receber' ? 'Vendas a prazo geram parcelas aqui automaticamente.' : 'O recebimento de compras gera as parcelas aqui automaticamente.'} />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Descrição</th><th>{lado === 'receber' ? 'Cliente' : 'Fornecedor'}</th><th>Vencimento</th><th>Status</th><th className="right">Valor</th><th /></tr></thead>
                  <tbody>
                    {lista.data.content.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div className="cell-title">{t.descricao}</div>
                          <div className="cell-sub">
                            {'vendaId' in t && t.vendaId ? <a href={`#/vendas?id=${t.vendaId}`} onClick={(e) => { e.preventDefault(); navigate(`/vendas?id=${t.vendaId}`); }}>Venda #{t.vendaId}</a>
                              : 'compraId' in t && t.compraId ? <a href={`#/compras?id=${t.compraId}`} onClick={(e) => { e.preventDefault(); navigate(`/compras?id=${t.compraId}`); }}>Compra #{t.compraId}</a>
                              : 'categoria' in t && t.categoria ? t.categoria : 'Lançamento avulso'}
                          </div>
                        </td>
                        <td className="ink-2">{t.parte ?? '—'}</td>
                        <td className="nowrap">
                          <div className="num">{date(t.vencimento)}</div>
                          <div className={`cell-sub ${t.vencida ? 'neg' : ''}`}>{t.status === 'ABERTO' ? relativeDays(t.vencimento) : t.status === 'PAGO' ? `pago em ${date(t.dataPgto)}` : ''}</div>
                        </td>
                        <td><TituloBadge s={t.status} vencida={t.vencida} pagoLabel={lado === 'receber' ? 'Recebido' : 'Pago'} /></td>
                        <td className="right num" style={{ fontWeight: 500 }}>{money(t.valor)}{t.pago != null && t.pago !== t.valor && <div className="cell-sub">pago {money(t.pago)}</div>}</td>
                        <td className="right nowrap">
                          {t.status === 'ABERTO' && (
                            <div className="row" style={{ justifyContent: 'flex-end' }}>
                              {!('vendaId' in t && t.vendaId) && <Button size="sm" variant="ghost" icon="ban" aria-label="Cancelar título" onClick={() => setCancelar(t)} />}
                              <Button size="sm" onClick={() => setBaixa(t)}>{lado === 'receber' ? 'Receber' : 'Pagar'}</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={lista.data.page.totalPages} total={lista.data.page.totalElements} onPage={setPage} label="títulos" />
            </>
          )}
      </Card>
      {baixa && <BaixaModal lado={lado} titulo={baixa} onClose={() => setBaixa(null)} onDone={recarregar} />}
      {nova && <NovaContaModal lado={lado} onClose={() => setNova(false)} onDone={recarregar} />}
      <Confirm open={!!cancelar} onClose={() => setCancelar(null)} danger busy={act.busy} onConfirm={doCancelar} confirmLabel="Cancelar título"
        title="Cancelar este título?" text={cancelar ? `${cancelar.descricao} · ${money(cancelar.valor)}. Ele sai da previsão de caixa.` : ''}>
        {act.error && <Alert>{act.error}</Alert>}
      </Confirm>
    </>
  );
}

function BaixaModal({ lado, titulo, onClose, onDone }: { lado: Lado; titulo: Titulo; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [valor, setValor] = useState<number | ''>(titulo.valor);
  const [data, setData] = useState(today());
  const [forma, setForma] = useState<FormaPagamento>(titulo.formaPagamento ?? 'PIX');
  const salvar = async () => {
    const r = await act.run(() => api.post(`/financeiro/${lado}/${titulo.id}/baixa`, { valor: Number(valor), data, formaPagamento: forma }));
    if (r) { toast.ok(lado === 'receber' ? `Recebimento de ${money(Number(valor))} registrado` : `Pagamento de ${money(Number(valor))} registrado`); onDone(); onClose(); }
  };
  return (
    <Modal open onClose={onClose} label="Registrar baixa"
      footer={<><Button onClick={onClose}>Voltar</Button><Button variant="primary" loading={act.busy} disabled={!valor} onClick={salvar}>{lado === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento'}</Button></>}>
      <div className="stack">
        <div><h2 className="section-title" style={{ fontSize: 17 }}>{lado === 'receber' ? 'Receber' : 'Pagar'}: {titulo.descricao}</h2>
          <p className="muted" style={{ marginTop: 4 }}>Vencimento {date(titulo.vencimento)} · valor original {money(titulo.valor)}</p></div>
        {act.error && <Alert>{act.error}</Alert>}
        <div className="form-grid">
          <Field label="Valor (R$)" className="col-6" hint="Ajuste para juros ou desconto.">{(i) => <NumberInput id={i} value={valor} onChange={setValor} data-autofocus />}</Field>
          <Field label="Data" className="col-6">{(i) => <Input id={i} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Field>
          <Field label="Forma de pagamento" className="col-12">{(i) => (
            <Select id={i} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>{FORMAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</Select>)}</Field>
        </div>
      </div>
    </Modal>
  );
}

function NovaContaModal({ lado, onClose, onDone }: { lado: Lado; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState<number | ''>('');
  const [venc, setVenc] = useState(daysAhead(30));
  const salvar = async () => {
    const body = { descricao, valor: Number(valor), vencimento: venc, ...(lado === 'pagar' ? { categoria: categoria || null } : {}) };
    const r = await act.run(() => api.post(`/financeiro/${lado}`, body));
    if (r) { toast.ok('Conta lançada'); onDone(); onClose(); }
  };
  return (
    <Modal open onClose={onClose} label="Nova conta"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={act.busy} disabled={!descricao || !valor || !venc} onClick={salvar}>Lançar conta</Button></>}>
      <div className="stack">
        <h2 className="section-title" style={{ fontSize: 17 }}>{lado === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'}</h2>
        {act.error && <Alert>{act.error}</Alert>}
        <div className="form-grid">
          <Field label="Descrição" className="col-12" error={act.fieldErrors.descricao}>{(i) => <Input id={i} value={descricao} onChange={(e) => setDescricao(e.target.value)} data-autofocus placeholder={lado === 'pagar' ? 'Ex.: Aluguel de novembro' : ''} />}</Field>
          {lado === 'pagar' && <Field label="Categoria" className="col-12">{(i) => (
            <Input id={i} list="categorias-despesa" value={categoria} onChange={(e) => setCategoria(e.target.value)} />)}</Field>}
          <Field label="Valor (R$)" className="col-6">{(i) => <NumberInput id={i} value={valor} onChange={setValor} />}</Field>
          <Field label="Vencimento" className="col-6">{(i) => <Input id={i} type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />}</Field>
        </div>
        <datalist id="categorias-despesa">
          {['Aluguel', 'Energia', 'Água', 'Internet', 'Folha de pagamento', 'Impostos', 'Mercadorias', 'Manutenção', 'Marketing'].map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
    </Modal>
  );
}
