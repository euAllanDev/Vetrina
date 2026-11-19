import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { navigate, useRoute } from '../lib/router';
import type { Parceiro, RedeAfiliado, RelatorioCliques } from '../lib/types';
import { Alert, Badge, Button, Card, Empty, ErrorState, Field, Input, Kpi, PageHeader, Segmented, Select, TableSkeleton } from '../components/ui';
import { Drawer, useToast } from '../components/overlay';
import { BarChart } from '../components/charts';
import { MarcaParceiro, REDE_LABEL } from '../components/ofertas';

const PERIODOS = [{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }];
const fmtDia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function Afiliados() {
  const { query } = useRoute();
  const [dias, setDias] = useState('30');
  const rel = useAsync(() => api.get<RelatorioCliques>('/relatorios/cliques', { dias }), [dias]);
  const parceiros = useAsync(() => api.get<Parceiro[]>('/parceiros'), []);
  const id = query.get('loja');
  const novo = query.get('novo') === '1';
  const totalOfertas = parceiros.data?.reduce((s, p) => s + p.ofertas, 0) ?? 0;

  return (
    <>
      <PageHeader title="Afiliados" sub={<>Lojas parceiras e cliques em “Ver na loja”. As ofertas de cada produto ficam em <a href="#/produtos">Produtos</a> → aba Ofertas.</>}
        actions={<Button variant="primary" icon="plus" onClick={() => navigate('/afiliados?novo=1')}>Nova loja parceira</Button>} />

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label={`Cliques em ${dias} dias`} value={rel.data ? rel.data.total.toLocaleString('pt-BR') : '—'} icon="external" />
        <Kpi label="Lojas parceiras ativas" value={parceiros.data ? parceiros.data.filter((p) => p.ativo).length : '—'} icon="store" />
        <Kpi label="Ofertas cadastradas" value={parceiros.data ? totalOfertas : '—'} icon="link" />
      </div>

      <Card title="Cliques por dia" actions={<Segmented value={dias} onChange={setDias} options={PERIODOS} label="Período" />}>
        {rel.error ? <ErrorState message={rel.error} onRetry={rel.reload} />
          : !rel.data ? <TableSkeleton rows={4} cols={3} />
          : <BarChart data={rel.data.porDia.map((d) => ({ label: fmtDia(d.dia), value: d.cliques }))} height={220}
              format={(v) => `${v} ${v === 1 ? 'clique' : 'cliques'}`} emptyText="Nenhum clique no período ainda." />}
      </Card>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="Por loja">
          {!rel.data ? <TableSkeleton rows={3} cols={2} /> : rel.data.porParceiro.length === 0
            ? <Empty icon="store" title="Sem cliques ainda" text="Quando alguém clicar em “Ver na loja”, aparece aqui." />
            : (
              <table className="table">
                <tbody>
                  {rel.data.porParceiro.map((p) => (
                    <tr key={p.parceiroId}>
                      <td><div className="row" style={{ gap: 10 }}><MarcaParceiro nome={p.nome} cor={p.cor} />{p.nome}</div></td>
                      <td className="right num">{p.cliques}</td>
                      <td style={{ width: '40%' }}>
                        <div className="meter"><span style={{ width: `${(p.cliques / Math.max(1, rel.data!.total)) * 100}%` }} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
        <Card title="Produtos mais clicados">
          {!rel.data ? <TableSkeleton rows={3} cols={2} /> : rel.data.topProdutos.length === 0
            ? <Empty icon="package" title="Sem cliques ainda" />
            : (
              <table className="table">
                <tbody>
                  {rel.data.topProdutos.map((p, i) => (
                    <tr key={p.produtoId} className="clickable" onClick={() => navigate(`/produtos?id=${p.produtoId}`)}>
                      <td className="ink-2 num" style={{ width: 28 }}>{i + 1}</td>
                      <td>{p.nome}</td>
                      <td className="right num">{p.cliques}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      </div>

      <div style={{ height: 16 }} />
      <Card title="Lojas parceiras">
        {parceiros.error ? <ErrorState message={parceiros.error} onRetry={parceiros.reload} />
          : !parceiros.data ? <TableSkeleton rows={4} cols={4} />
          : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Loja</th><th>Rede</th><th>Site</th><th className="right">Ofertas</th></tr></thead>
                <tbody>
                  {parceiros.data.map((p) => (
                    <tr key={p.id} className="clickable" tabIndex={0} onClick={() => navigate(`/afiliados?loja=${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/afiliados?loja=${p.id}`)}>
                      <td><div className="row" style={{ gap: 10 }}><MarcaParceiro nome={p.nome} cor={p.cor} /><span className="cell-title">{p.nome}</span>{!p.ativo && <Badge plain>Inativa</Badge>}</div></td>
                      <td>{REDE_LABEL[p.rede]}{p.rede === 'AWIN' && p.awinMerchantId && <span className="cell-sub mono"> · {p.awinMerchantId}</span>}</td>
                      <td className="ink-2">{p.site ? p.site.replace(/^https?:\/\//, '') : '—'}</td>
                      <td className="right num">{p.ofertas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {(id || novo) && parceiros.data && (
        <ParceiroDrawer p={id ? parceiros.data.find((x) => x.id === Number(id)) ?? null : null}
          onClose={() => navigate('/afiliados')} onSaved={parceiros.reload} />
      )}
    </>
  );
}

function ParceiroDrawer({ p, onClose, onSaved }: { p: Parceiro | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [nome, setNome] = useState('');
  const [rede, setRede] = useState<RedeAfiliado>('OUTRA');
  const [cor, setCor] = useState('#111111');
  const [site, setSite] = useState('');
  const [awin, setAwin] = useState('');
  const [ativo, setAtivo] = useState(true);
  useEffect(() => {
    if (!p) return;
    setNome(p.nome); setRede(p.rede); setCor(p.cor ?? '#111111'); setSite(p.site ?? ''); setAwin(p.awinMerchantId ?? ''); setAtivo(p.ativo);
  }, [p]);
  const fe = act.fieldErrors;

  const salvar = async () => {
    const body = { nome, rede, cor: cor || null, site: site.trim() || null, awinMerchantId: rede === 'AWIN' ? (awin.trim() || null) : null, ativo };
    const r = await act.run(() => (p ? api.put<Parceiro>(`/parceiros/${p.id}`, body) : api.post<Parceiro>('/parceiros', body)));
    if (r) { toast.ok(p ? 'Loja atualizada' : `${r.nome} cadastrada`); onSaved(); onClose(); }
  };

  return (
    <Drawer open onClose={onClose} title={p ? p.nome : 'Nova loja parceira'} sub={p ? `${p.ofertas} ${p.ofertas === 1 ? 'oferta' : 'ofertas'}` : undefined}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={act.busy} onClick={salvar}>{p ? 'Salvar' : 'Cadastrar'}</Button></>}>
      {act.error && <div style={{ marginBottom: 16 }}><Alert>{act.error}</Alert></div>}
      <div className="form-grid">
        <Field label="Nome" className="col-8" error={fe.nome}>{(i) => <Input id={i} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} autoFocus={!p} />}</Field>
        <Field label="Cor da etiqueta" className="col-4" error={fe.cor}>{(i) => <Input id={i} type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ padding: 4, height: 40 }} />}</Field>
        <Field label="Rede de afiliados" className="col-6">{(i) => (
          <Select id={i} value={rede} onChange={(e) => setRede(e.target.value as RedeAfiliado)}>
            {(Object.keys(REDE_LABEL) as RedeAfiliado[]).map((r) => <option key={r} value={r}>{REDE_LABEL[r]}</option>)}
          </Select>)}</Field>
        <Field label="Site" className="col-6" error={fe.site}>{(i) => <Input id={i} type="url" placeholder="https://" value={site} onChange={(e) => setSite(e.target.value)} />}</Field>
        {rede === 'AWIN' && (
          <Field label="ID do anunciante na Awin (awinmid)" className="col-12" error={fe.awinMerchantId}
            hint="Fica na página do anunciante no painel da Awin. Com ele e o AWIN_PUBLISHER_ID no servidor, basta colar o endereço do produto que o link de afiliado é montado sozinho.">
            {(i) => <Input id={i} className="mono" inputMode="numeric" value={awin} onChange={(e) => setAwin(e.target.value.replace(/\D/g, ''))} />}</Field>
        )}
        <div className="col-12"><label className="check"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Loja ativa (as ofertas dela aparecem na vitrine)</label></div>
      </div>
    </Drawer>
  );
}
