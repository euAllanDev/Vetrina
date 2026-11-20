import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { dateTime, money } from '../lib/format';
import type { OfertaAdmin, Parceiro, RedeAfiliado } from '../lib/types';
import { Alert, Badge, Button, Empty, ErrorState, Field, Input, NumberInput, Select, TableSkeleton } from './ui';
import { Confirm, useToast } from './overlay';

export const REDE_LABEL: Record<RedeAfiliado, string> = {
  MERCADO_LIVRE: 'Mercado Livre', ALIEXPRESS: 'AliExpress', SHOPEE: 'Shopee', AWIN: 'Awin', OUTRA: 'Outra',
};

/** Onde gerar o link de afiliado em cada rede (texto de ajuda). */
const ONDE_GERAR: Record<RedeAfiliado, string> = {
  MERCADO_LIVRE: 'Gere no painel de Afiliados do Mercado Livre (link curto meli.la) e cole aqui.',
  ALIEXPRESS: 'Gere no Portal de Afiliados do AliExpress (s.click.aliexpress.com) e cole aqui.',
  SHOPEE: 'Gere em Shopee Afiliados → Link personalizado (s.shopee.com.br) e cole aqui.',
  AWIN: 'Pode deixar em branco se a loja tiver o ID de anunciante Awin e o servidor tiver o AWIN_PUBLISHER_ID: o link é montado sozinho.',
  OUTRA: 'Cole o link de afiliado completo.',
};

export function MarcaParceiro({ nome, cor, size = 22 }: { nome: string; cor: string | null; size?: number }) {
  const bg = cor ?? '#111111';
  const m = /^#?([0-9a-f]{6})$/i.exec(bg);
  const n = m ? parseInt(m[1], 16) : 0;
  const claro = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
  return (
    <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', flex: 'none', width: size, height: size, borderRadius: 6,
      background: bg, color: claro ? '#111' : '#fff', fontWeight: 700, fontSize: size * 0.5, lineHeight: 1 }}>
      {nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}

interface Form {
  parceiroId: string; url: string; urlProduto: string; preco: number | ''; precoAnterior: number | '';
  freteTipo: 'nao' | 'gratis' | 'valor'; frete: number | ''; parcelamento: string; nota: number | ''; avaliacoes: number | '';
  disponivel: boolean; ativo: boolean; codigoExterno: string; atualizacaoAuto: boolean;
}
const VAZIO: Form = { parceiroId: '', url: '', urlProduto: '', preco: '', precoAnterior: '', freteTipo: 'nao', frete: '', parcelamento: '', nota: '', avaliacoes: '', disponivel: true, ativo: true, codigoExterno: '', atualizacaoAuto: true };

function deOferta(o: OfertaAdmin): Form {
  return {
    parceiroId: String(o.parceiroId), url: o.url, urlProduto: o.urlProduto ?? '', preco: o.preco, precoAnterior: o.precoAnterior ?? '',
    freteTipo: o.frete == null ? 'nao' : o.frete === 0 ? 'gratis' : 'valor', frete: o.frete && o.frete > 0 ? o.frete : '',
    parcelamento: o.parcelamento ?? '', nota: o.nota ?? '', avaliacoes: o.avaliacoes ?? '', disponivel: o.disponivel, ativo: o.ativo,
    codigoExterno: o.codigoExterno ?? '', atualizacaoAuto: o.atualizacaoAuto,
  };
}

/** Aba "Ofertas" do produto: lojas parceiras onde ele é vendido, com link de afiliado e preço. */
export function OfertasProduto({ produtoId, podeEditar }: { produtoId: number; podeEditar: boolean }) {
  const toast = useToast();
  const lista = useAsync(() => api.get<OfertaAdmin[]>(`/produtos/${produtoId}/ofertas`), [produtoId]);
  const parceiros = useAsync(() => api.get<Parceiro[]>('/parceiros'), []);
  const [editando, setEditando] = useState<number | 'nova' | null>(null);
  const [f, setF] = useState<Form>(VAZIO);
  const [excluir, setExcluir] = useState<OfertaAdmin | null>(null);
  const act = useAction();
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = act.fieldErrors;
  const parceiroSel = parceiros.data?.find((p) => String(p.id) === f.parceiroId);

  const abrir = (o: OfertaAdmin | null) => {
    act.setError(null);
    if (o) { setF(deOferta(o)); setEditando(o.id); }
    else {
      const usados = new Set(lista.data?.map((x) => x.parceiroId));
      const livre = parceiros.data?.find((p) => p.ativo && !usados.has(p.id));
      setF({ ...VAZIO, parceiroId: livre ? String(livre.id) : '' });
      setEditando('nova');
    }
  };

  const salvar = async () => {
    const body = {
      parceiroId: f.parceiroId ? Number(f.parceiroId) : null,
      url: f.url.trim() || null, urlProduto: f.urlProduto.trim() || null,
      preco: f.preco === '' ? null : Number(f.preco),
      precoAnterior: f.precoAnterior === '' ? null : Number(f.precoAnterior),
      frete: f.freteTipo === 'nao' ? null : f.freteTipo === 'gratis' ? 0 : (f.frete === '' ? null : Number(f.frete)),
      parcelamento: f.parcelamento.trim() || null,
      nota: f.nota === '' ? null : Number(f.nota), avaliacoes: f.avaliacoes === '' ? null : Number(f.avaliacoes),
      disponivel: f.disponivel, ativo: f.ativo,
      codigoExterno: f.codigoExterno.trim() || null, atualizacaoAuto: f.atualizacaoAuto,
    };
    const r = await act.run(() => (editando === 'nova'
      ? api.post<OfertaAdmin>(`/produtos/${produtoId}/ofertas`, body)
      : api.put<OfertaAdmin>(`/ofertas/${editando}`, body)));
    if (r) { toast.ok(editando === 'nova' ? `Oferta da ${r.parceiroNome} adicionada` : 'Oferta atualizada'); setEditando(null); lista.reload(); }
  };

  const conferir = async (o: OfertaAdmin) => {
    const r = await act.run(() => api.post<OfertaAdmin>(`/ofertas/${o.id}/conferir`));
    if (r) { toast.ok(`Preço da ${o.parceiroNome} marcado como conferido`); lista.reload(); }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    const ok = await act.run(async () => { await api.del(`/ofertas/${excluir.id}`); return true; });
    if (ok) { toast.ok('Oferta removida'); setExcluir(null); lista.reload(); }
  };

  if (lista.error) return <ErrorState message={lista.error} onRetry={lista.reload} />;
  if (!lista.data || !parceiros.data) return <TableSkeleton rows={3} cols={5} />;

  return (
    <div style={{ display: 'grid', gap: 16, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <p className="ink-2" style={{ margin: 0 }}>
        Com pelo menos uma oferta ativa, o produto vira <strong>comparação de preços</strong> na loja: o preço exibido é o menor entre as lojas
        e o botão leva ao seu link de afiliado (cada clique é contado).
      </p>
      {act.error && !editando && <Alert>{act.error}</Alert>}

      {lista.data.length === 0 && editando !== 'nova' ? (
        <Empty icon="link" title="Nenhuma oferta ainda" text="Adicione o link de afiliado deste produto em uma das lojas parceiras."
          action={podeEditar && <Button variant="primary" icon="plus" onClick={() => abrir(null)}>Adicionar oferta</Button>} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Loja</th><th className="right">Preço</th><th>Frete</th><th className="right">Cliques</th>{podeEditar && <th />}</tr></thead>
            <tbody>
              {lista.data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <MarcaParceiro nome={o.parceiroNome} cor={o.parceiroCor} />
                      <div>
                        <div className="cell-title row">{o.parceiroNome}
                          {!o.ativo && <Badge plain>Oculta</Badge>}{!o.disponivel && <Badge tone="warning">Indisponível</Badge>}
                          {o.rede === 'MERCADO_LIVRE' && o.atualizacaoAuto && !o.erroSincronizacao && <Badge tone="success" plain>Auto</Badge>}
                          {o.erroSincronizacao && <span title={o.erroSincronizacao}><Badge tone="danger">Erro no robô</Badge></span>}</div>
                        <a className="cell-sub" href={o.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{o.url}</a>
                      </div>
                    </div>
                  </td>
                  <td className="right num"><div>{money(o.preco)}</div>{o.precoAnterior && <div className="cell-sub" style={{ textDecoration: 'line-through' }}>{money(o.precoAnterior)}</div>}</td>
                  <td className="ink-2"><div>{o.frete == null ? '—' : o.frete === 0 ? 'Grátis' : money(o.frete)}</div>
                    {o.verificadoEm && <div className="cell-sub nowrap" title={`Preço conferido em ${dateTime(o.verificadoEm)}`}>conferido {dateTime(o.verificadoEm).slice(0, 5)}</div>}</td>
                  <td className="right num">{o.cliques}</td>
                  {podeEditar && (
                    <td className="right nowrap">
                      <Button variant="ghost" size="sm" icon="refresh" aria-label="Preço continua o mesmo (marcar como conferido)" title="Preço conferido agora" onClick={() => conferir(o)} />
                      <Button variant="ghost" size="sm" icon="edit" aria-label="Editar oferta" onClick={() => abrir(o)} />
                      <Button variant="ghost" size="sm" icon="trash" aria-label="Remover oferta" onClick={() => setExcluir(o)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar && editando === null && lista.data.length > 0 && (
        <div><Button icon="plus" onClick={() => abrir(null)}>Adicionar oferta</Button></div>
      )}

      {editando !== null && (
        <div className="card" style={{ padding: 16 }}>
          <div className="form-section" style={{ marginTop: 0 }}>{editando === 'nova' ? 'Nova oferta' : 'Editar oferta'}</div>
          {act.error && <div style={{ marginBottom: 12 }}><Alert>{act.error}</Alert></div>}
          <div className="form-grid">
            <Field label="Loja parceira" className="col-4" error={fe.parceiroId}>{(i) => (
              <Select id={i} value={f.parceiroId} onChange={(e) => set('parceiroId')(e.target.value)}>
                <option value="">Escolha…</option>
                {parceiros.data!.filter((p) => p.ativo || String(p.id) === f.parceiroId).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>)}</Field>
            <Field label="Link de afiliado" className="col-8" error={fe.url} hint={parceiroSel ? ONDE_GERAR[parceiroSel.rede] : 'Link gerado no painel da rede de afiliados.'}>
              {(i) => <Input id={i} type="url" inputMode="url" placeholder="https://" value={f.url} onChange={(e) => set('url')(e.target.value)} />}</Field>
            <Field label="Endereço do produto na loja (opcional)" className="col-12" error={fe.urlProduto} hint="O endereço normal, sem afiliado. Serve para conferência e para montar links da Awin.">
              {(i) => <Input id={i} type="url" inputMode="url" placeholder="https://" value={f.urlProduto} onChange={(e) => set('urlProduto')(e.target.value)} />}</Field>
            <Field label="Preço (R$)" className="col-3" error={fe.preco}>{(i) => <NumberInput id={i} value={f.preco} onChange={set('preco')} />}</Field>
            <Field label="Preço anterior (R$)" className="col-3" hint="Opcional: o “de” riscado.">{(i) => <NumberInput id={i} value={f.precoAnterior} onChange={set('precoAnterior')} />}</Field>
            <Field label="Frete" className="col-3">{(i) => (
              <Select id={i} value={f.freteTipo} onChange={(e) => set('freteTipo')(e.target.value as Form['freteTipo'])}>
                <option value="nao">Não informado</option><option value="gratis">Grátis</option><option value="valor">Valor</option>
              </Select>)}</Field>
            <Field label="Valor do frete (R$)" className="col-3">{(i) => <NumberInput id={i} value={f.frete} onChange={set('frete')} disabled={f.freteTipo !== 'valor'} />}</Field>
            <Field label="Parcelamento" className="col-4" hint="Como aparece na loja. Ex.: 10x sem juros">{(i) => <Input id={i} maxLength={60} value={f.parcelamento} onChange={(e) => set('parcelamento')(e.target.value)} />}</Field>
            <Field label="Nota na loja (0 a 5)" className="col-4" error={fe.nota}>{(i) => <NumberInput id={i} step="0.1" value={f.nota} onChange={set('nota')} />}</Field>
            <Field label="Nº de avaliações" className="col-4">{(i) => <NumberInput id={i} step="1" value={f.avaliacoes} onChange={set('avaliacoes')} />}</Field>
            {parceiroSel?.rede === 'MERCADO_LIVRE' && (
              <Field label="Código no Mercado Livre" className="col-4" hint="Opcional: sai sozinho do endereço do produto (MLB…).">{(i) => <Input id={i} className="mono" maxLength={40} value={f.codigoExterno} onChange={(e) => set('codigoExterno')(e.target.value.toUpperCase())} />}</Field>
            )}
            <div className="col-12 row" style={{ gap: 20, flexWrap: 'wrap' }}>
              {parceiroSel?.rede === 'MERCADO_LIVRE' && <label className="check"><input type="checkbox" checked={f.atualizacaoAuto} onChange={(e) => set('atualizacaoAuto')(e.target.checked)} />Robô atualiza preço sozinho</label>}
              <label className="check"><input type="checkbox" checked={f.disponivel} onChange={(e) => set('disponivel')(e.target.checked)} />Disponível na loja</label>
              <label className="check"><input type="checkbox" checked={f.ativo} onChange={(e) => set('ativo')(e.target.checked)} />Mostrar na vitrine</label>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => setEditando(null)}>Cancelar</Button>
            <Button variant="primary" loading={act.busy} onClick={salvar}>{editando === 'nova' ? 'Adicionar oferta' : 'Salvar oferta'}</Button>
          </div>
        </div>
      )}

      <Confirm open={!!excluir} title="Remover oferta?" danger busy={act.busy} confirmLabel="Remover"
        text={excluir ? `A oferta da ${excluir.parceiroNome} e o histórico de preço dela serão apagados.` : ''}
        onConfirm={confirmarExclusao} onClose={() => setExcluir(null)} />
    </div>
  );
}
