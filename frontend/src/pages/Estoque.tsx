import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { dateTime, money, ORIGEM_LABEL, qty } from '../lib/format';
import { navigate } from '../lib/router';
import type { Movimentacao, Page, Produto, ResumoEstoque } from '../lib/types';
import { Alert, Button, Card, Empty, ErrorState, Field, Kpi, NumberInput, PageHeader, Pagination, Skeleton, TableSkeleton, Textarea } from '../components/ui';
import { Modal, useToast } from '../components/overlay';
import { ProdutoPicker } from '../components/pickers';
import { Icon } from '../components/icons';

type Op = 'inventario' | 'entrada' | 'saida';

export function Estoque() {
  const [page, setPage] = useState(0);
  const [op, setOp] = useState<Op | null>(null);
  const resumo = useAsync(() => api.get<ResumoEstoque>('/estoque/resumo'), []);
  const movs = useAsync(() => api.get<Page<Movimentacao>>('/estoque/movimentacoes', { page, size: 30 }), [page]);
  const r = resumo.data;
  const recarregar = () => { resumo.reload(); movs.reload(); };

  return (
    <>
      <PageHeader title="Movimentações de estoque" sub="Kardex de entradas e saídas, inventário e ajustes."
        actions={<>
          <Button icon="minus" onClick={() => setOp('saida')}>Saída manual</Button>
          <Button icon="plus" onClick={() => setOp('entrada')}>Entrada manual</Button>
          <Button variant="primary" icon="clipboard" onClick={() => setOp('inventario')}>Contagem de inventário</Button>
        </>} />
      <div className="grid grid-kpi" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 16 }}>
        {!r ? [1, 2, 3].map((i) => <div key={i} className="card kpi"><Skeleton w={100} h={12} /><div style={{ height: 14 }} /><Skeleton w={120} h={28} /></div>) : (
          <>
            <Kpi icon="package" label="Produtos ativos" value={r.produtosAtivos.toLocaleString('pt-BR')} />
            <Kpi icon="alert" label="No mínimo ou abaixo" value={r.produtosAbaixoDoMinimo.toLocaleString('pt-BR')}
              foot={<a href="#/produtos" onClick={(e) => { e.preventDefault(); navigate('/produtos'); }}>Ver produtos</a>} />
            <Kpi icon="coins" label="Valor em estoque (custo)" value={money(r.valorTotalCusto)} foot="Saldo × custo médio" />
          </>
        )}
      </div>
      <Card>
        {movs.error ? <ErrorState message={movs.error} onRetry={movs.reload} />
          : !movs.data ? <TableSkeleton cols={6} />
          : movs.data.content.length === 0 ? <Empty icon="boxes" title="Nenhuma movimentação" text="Entradas de compras, vendas e ajustes aparecem aqui." />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Data</th><th>Produto</th><th>Origem</th><th className="right">Quantidade</th><th className="right">Saldo</th><th className="right">Custo unit.</th></tr></thead>
                  <tbody>
                    {movs.data.content.map((m) => (
                      <tr key={m.id} className="clickable" onClick={() => navigate(`/produtos?id=${m.produtoId}`)}>
                        <td className="nowrap"><div>{dateTime(m.data)}</div><div className="cell-sub">{m.usuario}</div></td>
                        <td><div className="cell-title">{m.produtoDescricao}</div><div className="cell-sub mono">{m.produtoCodigo}</div></td>
                        <td><div>{ORIGEM_LABEL[m.origem] ?? m.origem}{m.referenciaId ? <span className="muted"> #{m.referenciaId}</span> : null}</div>
                          {m.observacao && <div className="cell-sub" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.observacao}</div>}</td>
                        <td className={`right num ${m.tipo === 'ENTRADA' ? 'pos' : 'neg'}`} style={{ fontWeight: 500 }}>
                          <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}><Icon name={m.tipo === 'ENTRADA' ? 'down' : 'up'} size={14} />{qty(m.quantidade)}</span>
                        </td>
                        <td className="right num"><span className="muted">{qty(m.saldoAnterior)} → </span>{qty(m.saldoPosterior)}</td>
                        <td className="right num muted">{m.custoUnitario != null ? money(m.custoUnitario) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={movs.data.page.totalPages} total={movs.data.page.totalElements} onPage={setPage} label="movimentações" />
            </>
          )}
      </Card>
      {op && <OperacaoModal op={op} onClose={() => setOp(null)} onDone={recarregar} />}
    </>
  );
}

const TITULOS: Record<Op, { title: string; text: string; cta: string }> = {
  inventario: { title: 'Contagem de inventário', text: 'Informe a quantidade contada na prateleira. O sistema ajusta a diferença e registra no histórico.', cta: 'Ajustar estoque' },
  entrada: { title: 'Entrada manual', text: 'Para entradas fora de um pedido de compra (bonificação, devolução de cliente). Com custo, recalcula o custo médio.', cta: 'Registrar entrada' },
  saida: { title: 'Saída manual', text: 'Para perdas, avarias, consumo interno ou amostras.', cta: 'Registrar saída' },
};

function OperacaoModal({ op, onClose, onDone }: { op: Op; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState<number | ''>('');
  const [custo, setCusto] = useState<number | ''>('');
  const [obs, setObs] = useState('');
  const t = TITULOS[op];

  const salvar = async () => {
    if (!produto) return;
    const r = await act.run(() => op === 'inventario'
      ? api.post('/estoque/inventario', { produtoId: produto.id, quantidadeContada: Number(quantidade), observacao: obs })
      : api.post(`/estoque/${op === 'entrada' ? 'entradas' : 'saidas'}`, { produtoId: produto.id, quantidade: Number(quantidade), custoUnitario: custo === '' ? null : Number(custo), observacao: obs }));
    if (r) { toast.ok(`${t.title}: ${produto.descricao} atualizado`); onDone(); onClose(); }
  };
  const diff = produto && op === 'inventario' && quantidade !== '' ? Number(quantidade) - produto.estoqueAtual : null;

  return (
    <Modal open onClose={onClose} label={t.title}
      footer={<><Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={act.busy} disabled={!produto || quantidade === '' || obs.trim().length === 0} onClick={salvar}>{t.cta}</Button></>}>
      <div className="stack">
        <div><h2 className="section-title" style={{ fontSize: 17 }}>{t.title}</h2><p className="muted" style={{ marginTop: 4 }}>{t.text}</p></div>
        {act.error && <Alert>{act.error}</Alert>}
        {produto ? (
          <div className="row-between card" style={{ padding: '10px 12px' }}>
            <div><div style={{ fontWeight: 500 }}>{produto.descricao}</div><div className="muted num" style={{ fontSize: 12 }}>Saldo atual {qty(produto.estoqueAtual)} {produto.unidade}</div></div>
            <Button size="sm" variant="ghost" onClick={() => setProduto(null)}>Trocar</Button>
          </div>
        ) : <ProdutoPicker onPick={setProduto} />}
        <div className="form-grid">
          <Field label={op === 'inventario' ? 'Quantidade contada' : 'Quantidade'} className={op === 'entrada' ? 'col-6' : 'col-12'}
            hint={diff !== null ? (diff === 0 ? 'Igual ao saldo: nada a ajustar.' : `Ajuste de ${diff > 0 ? '+' : ''}${qty(diff)} ${produto?.unidade}`) : undefined}>
            {(i) => <NumberInput id={i} step="0.001" value={quantidade} onChange={setQuantidade} />}
          </Field>
          {op === 'entrada' && <Field label="Custo unitário (R$)" className="col-6" hint="Opcional">{(i) => <NumberInput id={i} value={custo} onChange={setCusto} />}</Field>}
          <Field label="Motivo" className="col-12">{(i) => <Textarea id={i} value={obs} onChange={(e) => setObs(e.target.value)} placeholder={op === 'saida' ? 'Ex.: embalagem danificada no recebimento' : ''} />}</Field>
        </div>
      </div>
    </Modal>
  );
}
