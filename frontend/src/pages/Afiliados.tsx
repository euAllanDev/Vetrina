import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { navigate, useRoute } from '../lib/router';
import type { CapturaResultado, CapturaVerificacao, Categoria, ImportacaoMl, Parceiro, RedeAfiliado, RelatorioCliques, StatusMercadoLivre } from '../lib/types';
import { dateTime, money } from '../lib/format';
import { Alert, Badge, Button, Card, Empty, ErrorState, Field, Input, Kpi, NumberInput, PageHeader, Segmented, Select, TableSkeleton } from '../components/ui';
import { lerCaptura, linkDoFavorito, type Capturado } from '../lib/capturar';
import { reduzirImagem } from '../lib/imagem';
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

      <CapturaFavorito />
      <div style={{ height: 16 }} />
      <AutomacaoMl query={query} />
      <CapturaDrawer captura={lerCaptura(query.get('captura'))} onClose={() => navigate('/afiliados')} onSaved={parceiros.reload} />

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label={`Cliques em ${dias} dias`} value={rel.data ? rel.data.total.toLocaleString('pt-BR') : '—'} icon="external" />
        <Kpi label="Lojas parceiras ativas" value={parceiros.data ? parceiros.data.filter((p) => p.ativo).length : '—'} icon="store" />
        <Kpi label="Ofertas cadastradas" value={parceiros.data ? totalOfertas : '—'} icon="link" />
        <Kpi label="Pedidos de aviso de preço" value={rel.data ? rel.data.avisosAtivos.toLocaleString('pt-BR') : '—'} icon="bell" />
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
                      <td><div className="cell-title">{p.nome}</div><div className="cell-sub">{p.categoria}{p.avisos > 0 ? ` · ${p.avisos} ${p.avisos === 1 ? 'pedido' : 'pedidos'} de aviso` : ''}</div></td>
                      <td className="right num">{p.cliques}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="Por categoria">
          {!rel.data ? <TableSkeleton rows={3} cols={2} /> : rel.data.porCategoria.length === 0
            ? <Empty icon="package" title="Sem produtos ainda" />
            : (() => {
              const max = Math.max(1, ...rel.data!.porCategoria.map((c) => c.cliques));
              return (
                <table className="table">
                  <tbody>
                    {rel.data!.porCategoria.map((c) => (
                      <tr key={c.nome}>
                        <td><div className="cell-title">{c.nome}</div><div className="cell-sub">{c.produtos} {c.produtos === 1 ? 'produto' : 'produtos'} · {c.produtos ? (c.cliques / c.produtos).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0} por produto</div></td>
                        <td className="right num">{c.cliques}</td>
                        <td style={{ width: '36%' }}><div className="meter"><span style={{ width: `${(c.cliques / max) * 100}%` }} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
        </Card>
        <Card title="Produtos parados" actions={rel.data && rel.data.parados.length > 0 ? <Badge tone="warning">{rel.data.parados.length} sem cliques</Badge> : undefined}>
          {!rel.data ? <TableSkeleton rows={3} cols={2} /> : rel.data.parados.length === 0
            ? <Empty icon="check" title="Todos tiveram cliques" text="Nenhum produto à venda ficou sem clique no período." />
            : (
              <>
                <p className="muted" style={{ fontSize: 13, margin: '12px 16px 4px' }}>Ninguém clicou em “Ver na loja” nestes produtos no período. Vale trocar a foto, conferir o preço ou substituir.</p>
                <table className="table">
                  <tbody>
                    {rel.data.parados.slice(0, 10).map((p) => (
                      <tr key={p.produtoId} className="clickable" onClick={() => navigate(`/produtos?id=${p.produtoId}`)}>
                        <td><div className="cell-title">{p.nome}</div><div className="cell-sub">{p.categoria}{p.avisos > 0 ? ` · ${p.avisos} ${p.avisos === 1 ? 'pedido' : 'pedidos'} de aviso` : ''}</div></td>
                        <td className="right num">{money(p.preco)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rel.data.parados.length > 10 && <p className="muted" style={{ fontSize: 12, margin: '8px 16px 12px' }}>e mais {rel.data.parados.length - 10}.</p>}
              </>
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

/* ============================== automação Mercado Livre ============================== */
function AutomacaoMl({ query }: { query: URLSearchParams }) {
  const toast = useToast();
  const st = useAsync(() => api.get<StatusMercadoLivre>('/integracoes/mercadolivre'), []);
  const cats = useAsync(() => api.get<Categoria[]>('/categorias'), []);
  const act = useAction();
  const imp = useAction();
  const [urlProduto, setUrlProduto] = useState('');
  const [url, setUrl] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [ultimo, setUltimo] = useState<ImportacaoMl | null>(null);
  const retorno = query.get('ml');
  const msg = query.get('msg');

  useEffect(() => {
    if (retorno === 'ok') toast.ok('Conta do Mercado Livre conectada');
  }, [retorno]); // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async () => {
    const r = await act.run(() => api.post<{ url: string }>('/integracoes/mercadolivre/conectar'));
    if (r) window.location.href = r.url;
  };
  const atualizar = async () => {
    const r = await act.run(async () => { await api.post('/integracoes/sincronizar'); return true; });
    if (r) { toast.ok('Robô iniciado: os preços vão sendo atualizados em segundo plano'); window.setTimeout(st.reload, 8000); }
  };
  const importar = async () => {
    const r = await imp.run(() => api.post<ImportacaoMl>('/integracoes/mercadolivre/importar',
      { urlProduto: urlProduto.trim(), url: url.trim(), categoriaId: categoriaId ? Number(categoriaId) : null }));
    if (r) { setUltimo(r); setUrlProduto(''); setUrl(''); toast.ok(`${r.nome} publicado`); }
  };

  const s = st.data;
  // Sem o app do Mercado Livre configurado no servidor, a captura pelo navegador faz esse papel.
  if (s && !s.configurado && retorno !== 'erro') return null;
  return (
    <>
    <Card title="Mercado Livre: importação e robô de preços"
      actions={s?.conectado ? <Badge tone="success">Conectado{s.apelido ? ` · ${s.apelido}` : ''}</Badge> : s ? <Badge tone="warning">Não conectado</Badge> : null}>
      <div className="card-body" style={{ display: 'grid', gap: 16 }}>
        {retorno === 'erro' && <Alert>{msg ?? 'Não foi possível conectar a conta.'}</Alert>}
        {act.error && <Alert>{act.error}</Alert>}
        {st.error ? <ErrorState message={st.error} onRetry={st.reload} /> : !s ? <TableSkeleton rows={2} cols={2} /> : !s.configurado ? (
          <Alert tone="info">Falta configurar o app do Mercado Livre no servidor (variáveis ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI no Render).</Alert>
        ) : !s.conectado ? (
          <div className="row" style={{ justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <p className="ink-2" style={{ margin: 0, maxWidth: '60ch' }}>Conecte a sua conta do Mercado Livre para importar produtos pelo link e deixar o robô conferir os preços sozinho a cada 6 horas.</p>
            <Button variant="primary" icon="link" loading={act.busy} onClick={conectar}>Conectar Mercado Livre</Button>
          </div>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="cell-title">Robô de preços</div>
                <div className="cell-sub">{s.ultimaSincronizacao ? `Última conferência: ${dateTime(s.ultimaSincronizacao)} · ${s.ultimoResumo ?? ''}` : 'Ainda não rodou.'}</div>
                <div className="cell-sub">{s.agendadorExterno ? 'Agendado a cada 6 horas.' : 'Roda a cada 6 horas enquanto o servidor estiver acordado (configure o agendador do GitHub para garantir).'}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Button icon="refresh" loading={act.busy} onClick={atualizar}>Atualizar preços agora</Button>
                <Button variant="ghost" onClick={conectar}>Reconectar</Button>
              </div>
            </div>
            <div className="form-section" style={{ margin: 0 }}>Importar produto pelo link</div>
            {imp.error && <Alert>{imp.error}</Alert>}
            <div className="form-grid">
              <Field label="Endereço do produto no Mercado Livre" className="col-12" hint="Abra o produto no Mercado Livre e copie o endereço da barra do navegador (tem MLB no meio).">
                {(i) => <Input id={i} type="url" placeholder="https://www.mercadolivre.com.br/…" value={urlProduto} onChange={(e) => setUrlProduto(e.target.value)} />}</Field>
              <Field label="Seu link de afiliado" className="col-6" hint="O link curto que o Mercado Livre gera para você (meli.la).">
                {(i) => <Input id={i} type="url" placeholder="https://meli.la/…" value={url} onChange={(e) => setUrl(e.target.value)} />}</Field>
              <Field label="Categoria na loja" className="col-6">{(i) => (
                <Select id={i} value={categoriaId} disabled={juntar != null} onChange={(e) => setCategoriaId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {cats.data?.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>)}</Field>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              {ultimo ? (
                <span className="ink-2">Último importado: <a href={`#/produtos?id=${ultimo.produtoId}`}>{ultimo.nome}</a> · {money(ultimo.preco)}{ultimo.precoAnterior ? ` (de ${money(ultimo.precoAnterior)})` : ''}{ultimo.foto ? '' : ' · sem foto'}</span>
              ) : <span className="ink-2">Nome, foto, preço e frete vêm do Mercado Livre. O produto entra na vitrine na hora.</span>}
              <Button variant="primary" icon="download" loading={imp.busy} disabled={!urlProduto.trim() || !url.trim()} onClick={importar}>Importar e publicar</Button>
            </div>
          </>
        )}
      </div>
    </Card>
    <div style={{ height: 16 }} />
    </>
  );
}

/* ============================== captura pelo navegador ============================== */
function CapturaFavorito() {
  const ref = useRef<HTMLAnchorElement>(null);
  // React bloqueia "javascript:" em href; o favorito precisa disso, então o endereço é posto direto no elemento.
  useEffect(() => { ref.current?.setAttribute('href', linkDoFavorito()); }, []);
  return (
    <Card title="Cadastrar produtos com 1 clique" actions={<Badge tone="success">Mercado Livre · Shein · outras lojas</Badge>}>
      <div className="card-body captura-fav">
        <div>
          <a ref={ref} className="btn btn-primary captura-btn" draggable onClick={(e) => e.preventDefault()}
            title="Arraste para a barra de favoritos">★ Enviar para a Vetrina</a>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Arraste este botão para a barra de favoritos (Ctrl+Shift+B mostra a barra).</p>
        </div>
        <ol className="captura-passos">
          <li>Abra o seu link de afiliado (ex.: <span className="mono">meli.la/…</span>) ou a página do produto.</li>
          <li>Clique no favorito <strong>Enviar para a Vetrina</strong>.</li>
          <li>O painel abre com nome, foto e preço. Escolha a categoria e publique. Se o produto já estiver na loja, só o preço é atualizado e entra no histórico.</li>
        </ol>
      </div>
    </Card>
  );
}

function CapturaDrawer({ captura, onClose, onSaved }: { captura: Capturado | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const cats = useAsync(() => api.get<Categoria[]>('/categorias'), []);
  const ver = useAction();
  const salvar = useAction();
  const [v, setV] = useState<CapturaVerificacao | null>(null);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState<number | ''>('');
  const [anterior, setAnterior] = useState<number | ''>('');
  const [link, setLink] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [juntar, setJuntar] = useState<number | null>(null);
  const chave = captura ? `${captura.urlProduto}|${captura.preco}` : '';

  useEffect(() => {
    if (!captura) return;
    setV(null);
    setNome(captura.nome);
    setPreco(captura.preco);
    setAnterior(captura.precoAnterior ?? '');
    setLink(captura.link);
    setCategoriaId('');
    setJuntar(null);
    void ver.run(() => api.post<CapturaVerificacao>('/integracoes/captura/verificar',
      { loja: captura.loja, nome: captura.nome, urlProduto: captura.urlProduto ?? captura.link, codigo: captura.codigo ?? null })).then((r) => {
      if (!r) return;
      setV(r);
      if (r.existente) {
        if (r.existente.link) setLink(r.existente.link);
        if (r.existente.categoriaId) setCategoriaId(String(r.existente.categoriaId));
      }
    });
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!captura) return null;
  const ex = v?.existente ?? null;
  const p = preco === '' ? 0 : preco;

  const enviarFoto = async (produtoId: number) => {
    if (!captura.imagem) return false;
    try {
      const r = await fetch(captura.imagem);
      if (!r.ok) return false;
      const img = await reduzirImagem(await r.blob(), 1200);
      const fd = new FormData();
      fd.append('arquivo', new File([img], 'produto.jpg', { type: img.type || 'image/jpeg' }));
      await api.upload(`/produtos/${produtoId}/imagem`, fd);
      return true;
    } catch {
      return false;
    }
  };

  const publicar = async () => {
    const r = await salvar.run(() => api.post<CapturaResultado>('/integracoes/captura', {
      loja: captura.loja, nome: nome.trim(), preco: p, precoAnterior: anterior === '' ? null : anterior,
      freteGratis: captura.freteGratis ?? null, nota: captura.nota ?? null, urlProduto: captura.urlProduto ?? captura.link,
      codigo: captura.codigo ?? null, linkAfiliado: link.trim(), categoriaId: categoriaId ? Number(categoriaId) : null,
      detalhes: captura.detalhes ?? null, produtoId: ex ? null : juntar,
    }));
    if (!r) return;
    let foto = r.temFoto;
    if (!foto) foto = await enviarFoto(r.produtoId);
    if (r.novo && juntar) toast.ok(`Oferta ${v?.parceiro ? `${daLoja(v.parceiro)} ` : ''}adicionada a ${r.nome}: agora ele compara lojas`);
    else if (r.novo) toast.ok(`${r.nome} publicado na loja${foto ? '' : ' (sem foto: envie em Produtos)'}`);
    else if (r.precoAntes != null && r.precoAntes !== r.preco) toast.ok(`Preço atualizado: ${money(r.precoAntes)} → ${money(r.preco)}${r.baixou ? ' · selo "Baixou" ligado' : ''}`);
    else toast.ok(`Preço conferido: continua ${money(r.preco)}`);
    onSaved();
    onClose();
  };

  return (
    <Drawer open onClose={onClose} title={ex ? 'Atualizar preço' : 'Publicar produto capturado'}
      sub={v ? `${v.parceiro}${v.codigo ? ` · ${v.codigo}` : ''}` : 'Conferindo…'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" icon={ex ? 'refresh' : 'check'} loading={salvar.busy} disabled={!v || !nome.trim() || !p || !link.trim()} onClick={publicar}>
          {ex ? (ex.preco !== p ? `Atualizar: ${money(ex.preco)} → ${money(p)}` : 'Confirmar preço') : juntar ? 'Adicionar ao produto' : 'Publicar na loja'}
        </Button>
      </>}>
      {ver.error && <Alert>{ver.error}</Alert>}
      {salvar.error && <div style={{ marginBottom: 12 }}><Alert>{salvar.error}</Alert></div>}
      {ex && <div style={{ marginBottom: 16 }}><Alert tone="info">Este produto já está na loja (<a href={`#/produtos?id=${ex.produtoId}`}>{ex.nome}</a>). Salvar só atualiza o preço e registra no histórico.</Alert></div>}
      <div className="captura-prev">
        {captura.imagem ? <img src={captura.imagem} alt="" referrerPolicy="no-referrer" /> : <div className="captura-sem-foto">sem foto</div>}
        <div className="form-grid" style={{ flex: 1 }}>
          <Field label="Nome na loja" className="col-12">{(i) => <Input id={i} value={nome} maxLength={120} disabled={!!ex || juntar != null} onChange={(e) => setNome(e.target.value)} />}</Field>
          <Field label="Preço" className="col-6">{(i) => <NumberInput id={i} value={preco} onChange={setPreco} />}</Field>
          <Field label="Preço antes (riscado)" className="col-6" hint="Deixe vazio se não houver desconto.">{(i) => <NumberInput id={i} value={anterior} onChange={setAnterior} />}</Field>
        </div>
      </div>
      {!ex && v && v.parecidos.length > 0 && (
        <fieldset className="captura-juntar">
          <legend>Já tem algo parecido na loja. É o mesmo produto em outra loja?</legend>
          <label className={`captura-opcao ${juntar == null ? 'on' : ''}`}>
            <input type="radio" name="juntar" checked={juntar == null} onChange={() => setJuntar(null)} />
            <span><strong>Não, é outro produto</strong><small>Publica como produto novo</small></span>
          </label>
          {v.parecidos.map((pp) => (
            <label key={pp.produtoId} className={`captura-opcao ${juntar === pp.produtoId ? 'on' : ''}`}>
              <input type="radio" name="juntar" checked={juntar === pp.produtoId} onChange={() => setJuntar(pp.produtoId)} />
              <span>
                <strong>Sim: {pp.nome}</strong>
                <small>{money(pp.preco)} · {pp.lojas.join(', ') || 'sem ofertas'}{pp.jaTemEstaLoja ? ` · já tem oferta ${daLoja(v.parceiro)} (vai atualizar o preço)` : ` · ganha a oferta ${daLoja(v.parceiro)}`}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="form-grid" style={{ marginTop: 16 }}>
        <Field label="Seu link de afiliado" className="col-12" hint="É para onde o botão “Ver na loja” leva. Se preferir, cole o link curto (meli.la/…) que você gerou.">
          {(i) => <Input id={i} type="url" value={link} onChange={(e) => setLink(e.target.value)} />}</Field>
        <Field label="Categoria na loja" className="col-12">{(i) => (
          <Select id={i} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">{ex ? 'Manter a atual' : 'Sem categoria'}</option>
            {cats.data?.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>)}</Field>
      </div>
      {captura.freteGratis && <p className="muted" style={{ marginTop: 12 }}>Frete grátis detectado na página.</p>}
    </Drawer>
  );
}

/** "do Mercado Livre", "da Shein". */
const daLoja = (nome: string) => `${/^(mercado|magazine)/i.test(nome) ? 'do' : 'da'} ${nome}`;
