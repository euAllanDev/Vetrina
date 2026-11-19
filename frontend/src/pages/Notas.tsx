import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { chave, dateTime, money, qty } from '../lib/format';
import { href, navigate, useRoute } from '../lib/router';
import { useAuth } from '../lib/auth';
import type { NotaFiscal, Page, StatusNota } from '../lib/types';
import { Alert, Button, Card, Empty, ErrorState, Field, NotaBadge, PageHeader, Pagination, Segmented, TableSkeleton, Textarea } from '../components/ui';
import { Confirm, Drawer, useToast } from '../components/overlay';
import { Icon } from '../components/icons';
import { baixarDanfe, imprimirDanfe } from '../lib/danfe';

export function Notas() {
  const { query } = useRoute();
  const [status, setStatus] = useState<'TODAS' | StatusNota>('TODAS');
  const [page, setPage] = useState(0);
  const lista = useAsync(() => api.get<Page<NotaFiscal>>('/notas-fiscais', { status: status === 'TODAS' ? undefined : status, page, size: 20, sort: 'id,desc' }), [status, page]);
  const id = query.get('id');

  return (
    <>
      <PageHeader title="Notas fiscais" sub="NF-e modelo 55 emitidas a partir das vendas confirmadas." />
      <Card>
        <div className="toolbar">
          <Segmented label="Status" value={status} onChange={(v) => { setStatus(v); setPage(0); }}
            options={[{ value: 'TODAS', label: 'Todas' }, { value: 'AUTORIZADA', label: 'Autorizadas' }, { value: 'REJEITADA', label: 'Rejeitadas' }, { value: 'CANCELADA', label: 'Canceladas' }]} />
        </div>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton />
          : lista.data.content.length === 0 ? <Empty icon="file" title="Nenhuma nota fiscal" text="Emita a NF-e na tela da venda ou logo após finalizar no PDV."
              action={<a className="btn btn-secondary" href={href('/vendas')}>Ver vendas</a>} />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Número</th><th>Destinatário</th><th>Chave de acesso</th><th>Status</th><th className="right">Valor</th></tr></thead>
                  <tbody>
                    {lista.data.content.map((n) => (
                      <tr key={n.id} className="clickable" tabIndex={0} onClick={() => navigate(`/notas?id=${n.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/notas?id=${n.id}`)}>
                        <td><div className="cell-title num">{n.numero} <span className="muted">· série {n.serie}</span></div><div className="cell-sub">{dateTime(n.dataEmissao)}</div></td>
                        <td><div>{n.clienteNome}</div><div className="cell-sub">Venda #{n.vendaId}</div></td>
                        <td className="chave muted" style={{ fontSize: 12 }}>{chave(n.chaveAcesso)}</td>
                        <td><NotaBadge s={n.status} /></td>
                        <td className="right num" style={{ fontWeight: 500 }}>{money(n.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={lista.data.page.totalPages} total={lista.data.page.totalElements} onPage={setPage} label="notas" />
            </>
          )}
      </Card>
      {id && <NotaDrawer id={Number(id)} onClose={() => navigate('/notas')} onChange={lista.reload} />}
    </>
  );
}

function NotaDrawer({ id, onClose, onChange }: { id: number; onClose: () => void; onChange: () => void }) {
  const { pode } = useAuth();
  const toast = useToast();
  const nota = useAsync(() => api.get<NotaFiscal>(`/notas-fiscais/${id}`), [id]);
  const act = useAction();
  const [cancelando, setCancelando] = useState(false);
  const [just, setJust] = useState('');
  const [pdf, setPdf] = useState<'imprimir' | 'baixar' | null>(null);
  const n = nota.data;

  const runPdf = async (modo: 'imprimir' | 'baixar') => {
    if (!n) return;
    setPdf(modo);
    try {
      if (modo === 'imprimir') await imprimirDanfe(n.id); else await baixarDanfe(n.id, n.chaveAcesso);
    } catch (e) {
      toast.err(e instanceof Error ? e.message : 'Não foi possível gerar o DANFE');
    } finally {
      setPdf(null);
    }
  };

  const baixarXml = async () => {
    const xml = await act.run(() => api.text(`/notas-fiscais/${id}/xml`));
    if (!xml || !n) return;
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url; a.download = `NFe${n.chaveAcesso}.xml`; a.click();
    URL.revokeObjectURL(url);
  };
  const copiar = async () => {
    if (!n) return;
    try { await navigator.clipboard.writeText(n.chaveAcesso); toast.ok('Chave de acesso copiada'); } catch { toast.err('Não foi possível copiar'); }
  };
  const cancelar = async () => {
    const r = await act.run(() => api.post<NotaFiscal>(`/notas-fiscais/${id}/cancelar`, { justificativa: just }));
    if (r) { nota.setData(r); setCancelando(false); setJust(''); toast.ok(`NF-e ${r.numero} cancelada. A venda voltou para confirmada.`); onChange(); }
  };

  return (
    <Drawer open onClose={onClose} wide title={n ? <span className="row">NF-e {n.numero} · série {n.serie} <NotaBadge s={n.status} /></span> : 'Nota fiscal'}
      sub={n && `${n.naturezaOperacao} · ${n.ambiente === 2 ? 'homologação' : 'produção'}`}
      footer={n && <>
        {pode('GERENTE') && n.status === 'AUTORIZADA' && <Button variant="ghost" onClick={() => setCancelando(true)}>Cancelar NF-e</Button>}
        <span className="grow" />
        <a className="btn btn-secondary" href={href(`/vendas?id=${n.vendaId}`)}>Venda #{n.vendaId}</a>
        <Button icon="download" onClick={baixarXml}>XML</Button>
        <Button icon="download" loading={pdf === 'baixar'} onClick={() => runPdf('baixar')}>PDF</Button>
        <Button variant="primary" icon="printer" loading={pdf === 'imprimir'} onClick={() => runPdf('imprimir')}>Imprimir DANFE</Button>
      </>}>
      {nota.error ? <ErrorState message={nota.error} onRetry={nota.reload} /> : !n ? <TableSkeleton rows={5} cols={3} /> : (
        <div className="stack">
          {act.error && <Alert>{act.error}</Alert>}
          {n.status === 'REJEITADA' && <Alert>Rejeitada pela SEFAZ: {n.motivoStatus}. Corrija o cadastro e emita novamente pela venda.</Alert>}
          {n.status === 'CANCELADA' && <Alert tone="warning">Cancelada em {dateTime(n.dataCancelamento)}: {n.justificativaCancelamento}</Alert>}
          <div className="card card-pad">
            <div className="row-between">
              <span className="field-label">Chave de acesso</span>
              <Button size="sm" variant="ghost" icon="copy" onClick={copiar}>Copiar</Button>
            </div>
            <p className="chave" style={{ fontSize: 15, marginTop: 6 }}>{chave(n.chaveAcesso)}</p>
          </div>
          <dl className="dl">
            <dt>Destinatário</dt><dd>{n.clienteNome}</dd>
            <dt>Emissão</dt><dd>{dateTime(n.dataEmissao)}</dd>
            <dt>Autorização</dt><dd>{dateTime(n.dataAutorizacao)}{n.protocolo && <span className="muted mono"> · protocolo {n.protocolo}</span>}</dd>
            <dt>Retorno SEFAZ</dt><dd>{n.motivoStatus ?? '—'}</dd>
          </dl>
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>#</th><th>Produto</th><th>NCM / CFOP</th><th>CST</th><th className="right">Qtd.</th><th className="right">Valor</th><th className="right">ICMS</th></tr></thead>
                <tbody>{n.itens.map((i) => (
                  <tr key={i.numeroItem}>
                    <td className="muted num">{i.numeroItem}</td>
                    <td><div className="cell-title">{i.descricao}</div><div className="cell-sub mono">{i.codigo}</div></td>
                    <td className="mono">{i.ncm ?? '—'} · {i.cfop}</td>
                    <td className="mono">{i.cstIcms}</td>
                    <td className="right num">{qty(i.quantidade)} {i.unidade}</td>
                    <td className="right num">{money(i.valorBruto - i.valorDesconto + i.valorFrete)}</td>
                    <td className="right num muted">{i.valorIcms > 0 ? money(i.valorIcms) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="totals" style={{ maxWidth: 360, marginLeft: 'auto' }}>
            <span className="muted">Produtos</span><span className="right">{money(n.valorProdutos)}</span>
            <span className="muted">Desconto</span><span className="right">− {money(n.valorDesconto)}</span>
            <span className="muted">Frete</span><span className="right">{money(n.valorFrete)}</span>
            <span className="muted">Base ICMS · ICMS</span><span className="right">{money(n.baseIcms)} · {money(n.valorIcms)}</span>
            <span className="muted">IPI · PIS · COFINS</span><span className="right">{money(n.valorIpi)} · {money(n.valorPis)} · {money(n.valorCofins)}</span>
            <span className="grand">Total da nota</span><span className="grand right">{money(n.valorTotal)}</span>
          </div>
          {n.ambiente === 2 && <p className="muted row" style={{ fontSize: 12 }}><Icon name="info" size={14} />Emitida em homologação: sem valor fiscal.</p>}
        </div>
      )}
      <Confirm open={cancelando} onClose={() => setCancelando(false)} danger busy={act.busy} confirmLabel="Cancelar NF-e" onConfirm={cancelar}
        title={`Cancelar a NF-e ${n?.numero ?? ''}?`} text="O cancelamento é enviado à SEFAZ e não pode ser desfeito. A venda volta para confirmada.">
        <Field label="Justificativa" hint={`${just.trim().length}/15 caracteres no mínimo, exigência da SEFAZ.`}>
          {(fid) => <Textarea id={fid} value={just} onChange={(e) => setJust(e.target.value)} data-autofocus />}
        </Field>
      </Confirm>
    </Drawer>
  );
}
