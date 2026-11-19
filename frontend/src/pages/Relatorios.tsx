import { useState } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { dayShort, daysAgo, money, monthStart, percent, plural, qty, today } from '../lib/format';
import type { CurvaAbcItem, RelatorioVendas } from '../lib/types';
import { Badge, Card, Empty, ErrorState, Field, Input, Kpi, PageHeader, Segmented, Skeleton, TableSkeleton } from '../components/ui';
import { BarChart, Meter } from '../components/charts';

type Preset = '7' | '30' | 'mes' | '90' | 'custom';

export function Relatorios() {
  const [preset, setPreset] = useState<Preset>('30');
  const [ini, setIni] = useState(daysAgo(29));
  const [fim, setFim] = useState(today());

  const aplicar = (p: Preset) => {
    setPreset(p);
    if (p === '7') { setIni(daysAgo(6)); setFim(today()); }
    if (p === '30') { setIni(daysAgo(29)); setFim(today()); }
    if (p === '90') { setIni(daysAgo(89)); setFim(today()); }
    if (p === 'mes') { setIni(monthStart()); setFim(today()); }
  };

  const vendas = useAsync(() => api.get<RelatorioVendas>('/relatorios/vendas', { inicio: ini, fim }), [ini, fim]);
  const abc = useAsync(() => api.get<CurvaAbcItem[]>('/relatorios/curva-abc', { inicio: ini, fim }), [ini, fim]);
  const t = vendas.data?.totais;
  const lucro = abc.data?.reduce((s, i) => s + i.lucroBruto, 0) ?? 0;
  const fat = abc.data?.reduce((s, i) => s + i.faturamento, 0) ?? 0;
  const contagem = { A: 0, B: 0, C: 0 } as Record<'A' | 'B' | 'C', number>;
  abc.data?.forEach((i) => { contagem[i.classe] += 1; });

  return (
    <>
      <PageHeader title="Relatórios" sub="Vendas confirmadas e faturadas no período." />
      <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Segmented label="Período" value={preset} onChange={aplicar}
          options={[{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: 'mes', label: 'Este mês' }, { value: '90', label: '90 dias' }, { value: 'custom', label: 'Personalizado' }]} />
        {preset === 'custom' && (
          <>
            <Field label="De">{(i) => <Input id={i} type="date" value={ini} max={fim} onChange={(e) => setIni(e.target.value)} style={{ width: 160 }} />}</Field>
            <Field label="Até">{(i) => <Input id={i} type="date" value={fim} min={ini} onChange={(e) => setFim(e.target.value)} style={{ width: 160 }} />}</Field>
          </>
        )}
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        {!t || !abc.data ? [1, 2, 3, 4].map((i) => <div key={i} className="card kpi"><Skeleton w={110} h={12} /><div style={{ height: 14 }} /><Skeleton w={130} h={28} /></div>) : (
          <>
            <Kpi icon="coins" label="Faturamento" value={money(t.faturamento)} foot={plural(t.quantidadeVendas, 'venda')} />
            <Kpi icon="receipt" label="Ticket médio" value={money(t.ticketMedio)} />
            <Kpi icon="chart" label="Lucro bruto" value={money(lucro)} foot="Venda − custo médio na data da venda" />
            <Kpi icon="tag" label="Margem bruta" value={percent(fat > 0 ? (lucro / fat) * 100 : 0)} />
          </>
        )}
      </div>

      <Card title="Faturamento por dia" className="" >
        <div className="card-body">
          {vendas.error ? <ErrorState message={vendas.error} onRetry={vendas.reload} />
            : !vendas.data ? <Skeleton h={240} r={8} />
            : <BarChart data={preencher(vendas.data.porDia, ini, fim).map((d) => ({ label: dayShort(d.dia), value: d.total, sub: plural(d.quantidade, 'venda') }))} format={money} />}
        </div>
      </Card>

      <div style={{ height: 16 }} />
      <Card title="Curva ABC de produtos" actions={abc.data && abc.data.length > 0 && (
        <div className="row"><Badge tone="success" plain>A · {contagem.A}</Badge><Badge tone="warning" plain>B · {contagem.B}</Badge><Badge plain>C · {contagem.C}</Badge></div>)}>
        {abc.error ? <ErrorState message={abc.error} onRetry={abc.reload} />
          : !abc.data ? <TableSkeleton cols={6} />
          : abc.data.length === 0 ? <Empty icon="chart" title="Sem vendas no período" text="A curva ABC aparece quando houver vendas confirmadas no intervalo escolhido." />
          : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th style={{ width: 56 }}>Classe</th><th>Produto</th><th className="right">Qtd.</th><th className="right">Faturamento</th><th className="right">Lucro bruto</th><th style={{ width: '22%' }}>Participação</th><th className="right">Acumulado</th></tr></thead>
                <tbody>
                  {abc.data.map((i) => (
                    <tr key={i.produtoId}>
                      <td><Badge tone={i.classe === 'A' ? 'success' : i.classe === 'B' ? 'warning' : 'neutral'} plain>{i.classe}</Badge></td>
                      <td><div className="cell-title">{i.descricao}</div><div className="cell-sub mono">{i.codigo}</div></td>
                      <td className="right num">{qty(i.quantidade)}</td>
                      <td className="right num" style={{ fontWeight: 500 }}>{money(i.faturamento)}</td>
                      <td className={`right num ${i.lucroBruto < 0 ? 'neg' : ''}`}>{money(i.lucroBruto)}</td>
                      <td><div className="row"><div className="grow"><Meter value={i.percentual} max={abc.data![0].percentual} /></div><span className="num muted" style={{ width: 48, textAlign: 'right', fontSize: 12 }}>{percent(i.percentual)}</span></div></td>
                      <td className="right num muted">{percent(i.percentualAcumulado)}</td>
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

function preencher(rows: { dia: string; quantidade: number; total: number }[], ini: string, fim: string) {
  const map = new Map(rows.map((r) => [r.dia, r]));
  const out: { dia: string; quantidade: number; total: number }[] = [];
  const d = new Date(`${ini}T12:00:00`);
  const end = new Date(`${fim}T12:00:00`);
  let guard = 0;
  while (d <= end && guard++ < 400) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(map.get(iso) ?? { dia: iso, quantidade: 0, total: 0 });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
