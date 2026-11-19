import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { daysAgo, dayShort, money, moneyCompact, plural, qty, today } from '../lib/format';
import { href } from '../lib/router';
import type { Dashboard as D, Produto, RelatorioVendas } from '../lib/types';
import { Button, Card, Empty, ErrorState, Kpi, PageHeader, Skeleton } from '../components/ui';
import { BarChart, Meter } from '../components/charts';
import { Icon } from '../components/icons';
import { useAuth } from '../lib/auth';

export function Dashboard() {
  const { usuario } = useAuth();
  const dash = useAsync(() => api.get<D>('/dashboard'), []);
  const vendas = useAsync(() => api.get<RelatorioVendas>('/relatorios/vendas', { inicio: daysAgo(29), fim: today() }), []);
  const baixo = useAsync(() => api.get<Produto[]>('/produtos/estoque-baixo'), []);

  const d = dash.data;
  const serie = fillDays(vendas.data?.porDia ?? [], 30);
  const hora = new Date().getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <PageHeader
        title={`${saud}, ${usuario?.nome.split(' ')[0] ?? ''}`}
        sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={<a className="btn btn-primary" href={href('/pdv')}><Icon name="pdv" size={16} />Abrir PDV</a>}
      />

      {dash.error ? <Card pad><ErrorState message={dash.error} onRetry={dash.reload} /></Card> : (
        <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
          {!d ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card kpi"><Skeleton w={90} h={12} /><div style={{ height: 14 }} /><Skeleton w={140} h={28} /><div style={{ height: 10 }} /><Skeleton w={110} h={11} /></div>
          )) : (
            <>
              <Kpi icon="coins" label="Faturamento hoje" value={money(d.hoje.faturamento)}
                foot={`${plural(d.hoje.quantidadeVendas, 'venda')} · ticket ${money(d.hoje.ticketMedio)}`} />
              <Kpi icon="calendar" label="Faturamento no mês" value={money(d.mesAtual.faturamento)}
                foot={`${plural(d.mesAtual.quantidadeVendas, 'venda')} · ticket ${money(d.mesAtual.ticketMedio)}`} />
              <Kpi icon="wallet" label="A receber vencido" value={money(d.receberVencido)} tone={d.receberVencido > 0 ? 'danger' : undefined}
                foot={`${money(d.receberProximos7Dias)} vencem nos próximos 7 dias`} />
              <Kpi icon="truck" label="A pagar em 7 dias" value={money(d.pagarProximos7Dias)}
                foot={d.pagarVencido > 0 ? <span className="neg">{money(d.pagarVencido)} já vencido</span> : 'Nada vencido'} />
            </>
          )}
        </div>
      )}

      <div className="grid grid-3-1" style={{ marginBottom: 16 }}>
        <Card title="Vendas nos últimos 30 dias"
          actions={vendas.data && <span className="muted num">{money(vendas.data.totais.faturamento)} em {plural(vendas.data.totais.quantidadeVendas, 'venda')}</span>}>
          <div className="card-body">
            {vendas.error ? <ErrorState message={vendas.error} onRetry={vendas.reload} />
              : !vendas.data ? <Skeleton h={240} r={8} />
              : <BarChart data={serie.map((p) => ({ label: dayShort(p.dia), value: p.total, sub: plural(p.quantidade, 'venda') }))} format={money} />}
          </div>
        </Card>

        <Card title="Mais vendidos no mês" actions={<a href={href('/relatorios')} className="btn btn-ghost btn-sm">Relatórios</a>}>
          {!d ? <div className="card-body stack-sm">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={16} />)}</div>
            : d.topProdutosMes.length === 0 ? <Empty icon="chart" title="Nenhuma venda no mês" text="Os produtos mais vendidos aparecem aqui depois da primeira venda confirmada." />
            : d.topProdutosMes.map((p, i) => (
              <div key={p.produtoId} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div className="row-between">
                  <div className="row" style={{ minWidth: 0 }}>
                    <span className="rank">{i + 1}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</span>
                  </div>
                  <span className="num nowrap">{moneyCompact(p.faturamento)}</span>
                </div>
                <Meter value={p.faturamento} max={d.topProdutosMes[0].faturamento} />
                <div className="muted num" style={{ fontSize: 12 }}>{qty(p.quantidade)} un. · margem {money(p.faturamento - p.custo)}</div>
              </div>
            ))}
        </Card>
      </div>

      <Card title={<span className="row">Estoque abaixo do mínimo {baixo.data && baixo.data.length > 0 && <span className="badge badge-warning plain">{baixo.data.length}</span>}</span>}
        actions={<a href={href('/compras?novo=1')} className="btn btn-secondary btn-sm"><Icon name="truck" size={15} />Pedido de compra</a>}>
        {baixo.error ? <ErrorState message={baixo.error} onRetry={baixo.reload} />
          : !baixo.data ? <div className="card-body stack-sm">{[1, 2, 3].map((i) => <Skeleton key={i} h={16} />)}</div>
          : baixo.data.length === 0 ? <Empty icon="check" title="Estoque em dia" text="Nenhum produto ativo está no estoque mínimo ou abaixo dele." />
          : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Produto</th><th className="right">Em estoque</th><th className="right">Mínimo</th><th style={{ width: '28%' }}>Cobertura</th><th /></tr></thead>
                <tbody>
                  {baixo.data.slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td><div className="cell-title">{p.descricao}</div><div className="cell-sub mono">{p.codigo}</div></td>
                      <td className="right num">{qty(p.estoqueAtual)} {p.unidade}</td>
                      <td className="right num muted">{qty(p.estoqueMinimo)}</td>
                      <td><Meter value={p.estoqueAtual} max={p.estoqueMinimo || 1} tone={p.estoqueAtual <= 0 ? 'danger' : 'warn'} /></td>
                      <td className="right"><Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => { window.location.hash = `/produtos?id=${p.id}`; }}>Ver</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </>
  );
}

/** Completa os dias sem venda com zero, para o gráfico não "pular" datas. */
function fillDays(rows: { dia: string; quantidade: number; total: number }[], n: number) {
  const map = new Map(rows.map((r) => [r.dia, r]));
  return Array.from({ length: n }, (_, i) => {
    const dia = daysAgo(n - 1 - i);
    return map.get(dia) ?? { dia, quantidade: 0, total: 0 };
  });
}
