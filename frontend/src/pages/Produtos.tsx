import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync, useDebounced } from '../lib/hooks';
import { dateTime, money, ORIGEM_LABEL, qty } from '../lib/format';
import { navigate, useRoute } from '../lib/router';
import { useAuth } from '../lib/auth';
import type { Categoria, Movimentacao, Page, Produto } from '../lib/types';
import { Alert, Badge, Button, Card, Empty, ErrorState, Field, Input, NumberInput, PageHeader, Pagination, SearchInput, Segmented, Select, TableSkeleton, Tabs, Textarea } from '../components/ui';
import { OfertasProduto } from '../components/ofertas';
import { Drawer, useToast } from '../components/overlay';
import { FotoUpload, ProdutoFoto } from '../components/foto';
import { reduzirImagem } from '../lib/imagem';

export function Produtos() {
  const { query } = useRoute();
  const { pode } = useAuth();
  const [termo, setTermo] = useState('');
  const dt = useDebounced(termo);
  const [cat, setCat] = useState('');
  const [ativo, setAtivo] = useState<'true' | 'false' | 'todos'>('true');
  const [page, setPage] = useState(0);
  const cats = useAsync(() => api.get<Categoria[]>('/categorias'), []);
  const lista = useAsync(() => api.get<Page<Produto>>('/produtos', {
    termo: dt, categoriaId: cat || undefined, ativo: ativo === 'todos' ? undefined : ativo, page, size: 25, sort: 'descricao',
  }), [dt, cat, ativo, page]);
  useEffect(() => setPage(0), [dt, cat, ativo]);

  const editar = pode('GERENTE', 'ESTOQUISTA');
  const id = query.get('id');
  const novo = query.get('novo') === '1';

  return (
    <>
      <PageHeader title="Produtos" sub="Cadastro, preços, estoque e dados fiscais."
        actions={editar && <Button variant="primary" icon="plus" onClick={() => navigate('/produtos?novo=1')}>Novo produto</Button>} />
      <Card>
        <div className="toolbar">
          <SearchInput value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome, código ou EAN" aria-label="Buscar produtos" />
          <Select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 200 }}>
            <option value="">Todas as categorias</option>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
          <div style={{ marginLeft: 'auto' }}>
            <Segmented label="Situação" value={ativo} onChange={setAtivo} options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }, { value: 'todos', label: 'Todos' }]} />
          </div>
        </div>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton cols={6} />
          : lista.data.content.length === 0 ? <Empty icon="package" title={termo ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
              text={termo ? `Nada corresponde a “${termo}”.` : 'Cadastre o primeiro produto para começar a vender e controlar o estoque.'}
              action={editar && !termo && <Button variant="primary" icon="plus" onClick={() => navigate('/produtos?novo=1')}>Novo produto</Button>} />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Produto</th><th>Categoria</th><th className="right">Custo</th><th className="right">Preço</th><th className="right">Margem</th><th className="right">Estoque</th></tr></thead>
                  <tbody>
                    {lista.data.content.map((p) => {
                      const margem = p.precoVenda > 0 ? ((p.precoVenda - p.precoCusto) / p.precoVenda) * 100 : 0;
                      return (
                        <tr key={p.id} className="clickable" tabIndex={0} onClick={() => navigate(`/produtos?id=${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/produtos?id=${p.id}`)}>
                          <td>
                            <div className="row" style={{ gap: 12 }}>
                              <ProdutoFoto url={p.imagemUrl} alt="" size={40} />
                              <div>
                                <div className="cell-title row">{p.descricao}{!p.ativo && <Badge plain>Inativo</Badge>}</div>
                                <div className="cell-sub mono">{p.codigo}{p.ean ? ` · ${p.ean}` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="ink-2">{p.categoriaNome ?? '—'}</td>
                          <td className="right num muted">{money(p.precoCusto)}</td>
                          <td className="right num" style={{ fontWeight: 500 }}>{money(p.precoVenda)}</td>
                          <td className="right num ink-2">{margem.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td>
                          <td className="right">
                            {p.estoqueAtual <= 0 ? <Badge tone="danger">{qty(p.estoqueAtual)} {p.unidade}</Badge>
                              : p.abaixoDoMinimo ? <Badge tone="warning">{qty(p.estoqueAtual)} {p.unidade}</Badge>
                              : <span className="num">{qty(p.estoqueAtual)} {p.unidade}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={lista.data.page.totalPages} total={lista.data.page.totalElements} onPage={setPage} label="produtos" />
            </>
          )}
      </Card>
      {(id || novo) && <ProdutoDrawer id={id ? Number(id) : null} categorias={cats.data ?? []} podeEditar={editar}
        onClose={() => navigate('/produtos')} onSaved={lista.reload} />}
    </>
  );
}

interface Form {
  codigo: string; descricao: string; ean: string; categoriaId: string; unidade: string;
  precoCusto: number | ''; precoVenda: number | ''; estoqueMinimo: number | ''; estoqueInicial: number | ''; ativo: boolean;
  ncm: string; cest: string; cfop: string; origem: string; cstIcms: string;
  aliquotaIcms: number | ''; aliquotaIpi: number | ''; aliquotaPis: number | ''; aliquotaCofins: number | '';
  precoAnterior: number | ''; detalhes: string;
}
const VAZIO: Form = {
  codigo: '', descricao: '', ean: '', categoriaId: '', unidade: 'UN', precoCusto: '', precoVenda: '', estoqueMinimo: '', estoqueInicial: '',
  ativo: true, ncm: '', cest: '', cfop: '5102', origem: '0', cstIcms: '102', aliquotaIcms: '', aliquotaIpi: '', aliquotaPis: '', aliquotaCofins: '', precoAnterior: '', detalhes: '',
};

function ProdutoDrawer({ id, categorias, podeEditar, onClose, onSaved }:
  { id: number | null; categorias: Categoria[]; podeEditar: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'dados' | 'fiscal' | 'ofertas' | 'historico'>('dados');
  const [f, setF] = useState<Form>(VAZIO);
  const prod = useAsync(() => (id ? api.get<Produto>(`/produtos/${id}`) : Promise.resolve(undefined)), [id]);
  const movs = useAsync(() => (id && tab === 'historico' ? api.get<Page<Movimentacao>>('/estoque/movimentacoes', { produtoId: id, size: 30 }) : Promise.resolve(undefined)), [id, tab]);
  const act = useAction();
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoPendente, setFotoPendente] = useState<Blob | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  useEffect(() => () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview); }, [fotoPreview]);

  const enviarFoto = async (produtoId: number, blob: Blob) => {
    const form = new FormData();
    form.append('arquivo', blob, 'foto.jpg');
    return api.upload<Produto>(`/produtos/${produtoId}/imagem`, form);
  };

  const escolherFoto = async (arquivo: File) => {
    setEnviandoFoto(true);
    try {
      const reduzida = await reduzirImagem(arquivo);
      if (id) {
        const p = await enviarFoto(id, reduzida);
        prod.setData(p);
        onSaved();
        toast.ok('Foto atualizada');
      } else {
        setFotoPendente(reduzida);
        setFotoPreview(URL.createObjectURL(reduzida));
      }
    } catch (e) {
      toast.err(e instanceof Error ? e.message : 'Não foi possível usar esta imagem');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = async () => {
    if (!id) { setFotoPendente(null); setFotoPreview(null); return; }
    setEnviandoFoto(true);
    try {
      const p = await api.del<Produto>(`/produtos/${id}/imagem`);
      prod.setData(p);
      onSaved();
      toast.ok('Foto removida');
    } catch (e) {
      toast.err(e instanceof Error ? e.message : 'Não foi possível remover a foto');
    } finally {
      setEnviandoFoto(false);
    }
  };

  useEffect(() => {
    const p = prod.data;
    if (!p) { setF(VAZIO); return; }
    setF({
      codigo: p.codigo, descricao: p.descricao, ean: p.ean ?? '', categoriaId: p.categoriaId ? String(p.categoriaId) : '', unidade: p.unidade,
      precoCusto: p.precoCusto, precoVenda: p.precoVenda, estoqueMinimo: p.estoqueMinimo, estoqueInicial: '', ativo: p.ativo,
      ncm: p.ncm ?? '', cest: p.cest ?? '', cfop: p.cfop, origem: String(p.origem), cstIcms: p.cstIcms,
      aliquotaIcms: p.aliquotaIcms, aliquotaIpi: p.aliquotaIpi, aliquotaPis: p.aliquotaPis, aliquotaCofins: p.aliquotaCofins,
      precoAnterior: p.precoAnterior ?? '', detalhes: p.detalhes ?? '',
    });
  }, [prod.data]);

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = act.fieldErrors;

  const salvar = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = {
      ...f, ean: f.ean || null, categoriaId: f.categoriaId ? Number(f.categoriaId) : null, ncm: f.ncm || null, cest: f.cest || null,
      origem: Number(f.origem), precoCusto: Number(f.precoCusto || 0), precoVenda: Number(f.precoVenda || 0),
      estoqueMinimo: Number(f.estoqueMinimo || 0), estoqueInicial: id ? null : Number(f.estoqueInicial || 0),
      aliquotaIcms: Number(f.aliquotaIcms || 0), aliquotaIpi: Number(f.aliquotaIpi || 0), aliquotaPis: Number(f.aliquotaPis || 0), aliquotaCofins: Number(f.aliquotaCofins || 0),
      precoAnterior: f.precoAnterior === '' ? null : Number(f.precoAnterior), detalhes: f.detalhes || null,
    };
    const p = await act.run(async () => {
      const salvo = await (id ? api.put<Produto>(`/produtos/${id}`, body) : api.post<Produto>('/produtos', body));
      if (!id && fotoPendente) await enviarFoto(salvo.id, fotoPendente);
      return salvo;
    });
    if (p) { toast.ok(id ? 'Produto atualizado' : `Produto ${p.codigo} cadastrado`); onSaved(); onClose(); }
  };

  const p = prod.data;
  const margem = Number(f.precoVenda) > 0 ? ((Number(f.precoVenda) - Number(f.precoCusto || 0)) / Number(f.precoVenda)) * 100 : null;
  const ro = !podeEditar;

  return (
    <Drawer open onClose={onClose} wide title={id ? (p?.descricao ?? 'Produto') : 'Novo produto'}
      sub={p && <span className="row"><span className="mono">{p.codigo}</span>· {qty(p.estoqueAtual)} {p.unidade} em estoque</span>}
      footer={podeEditar && tab !== 'ofertas' && <><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={act.busy} onClick={() => salvar()}>{id ? 'Salvar alterações' : 'Cadastrar produto'}</Button></>}>
      {id && prod.error ? <ErrorState message={prod.error} onRetry={prod.reload} /> : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'dados', label: 'Dados gerais' }, { value: 'fiscal', label: 'Fiscal' }, ...(id ? [{ value: 'ofertas' as const, label: 'Ofertas (afiliados)' }, { value: 'historico' as const, label: 'Movimentações' }] : [])]} />
          {act.error && <div style={{ marginBottom: 16 }}><Alert>{act.error}</Alert></div>}
          <form onSubmit={salvar}>
            <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
              {tab === 'dados' && (
                <>
                <div className="produto-topo">
                  <FotoUpload url={id ? (p?.imagemUrl ?? null) : fotoPreview} enviando={enviandoFoto} desabilitado={ro}
                    onEscolher={escolherFoto} onRemover={removerFoto} />
                  <div className="form-grid grow">
                    <Field label="Código (SKU)" className="col-12" error={fe.codigo}>{(i) => <Input id={i} value={f.codigo} onChange={(e) => set('codigo')(e.target.value)} required autoFocus={!id} />}</Field>
                    <Field label="Descrição" className="col-12" error={fe.descricao}>{(i) => <Input id={i} value={f.descricao} onChange={(e) => set('descricao')(e.target.value)} required />}</Field>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Código de barras (EAN)" className="col-6" error={fe.ean}>{(i) => <Input id={i} inputMode="numeric" value={f.ean} onChange={(e) => set('ean')(e.target.value.replace(/\D/g, ''))} />}</Field>
                  <Field label="Categoria" className="col-4">{(i) => (
                    <Select id={i} value={f.categoriaId} onChange={(e) => set('categoriaId')(e.target.value)}>
                      <option value="">Sem categoria</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </Select>)}</Field>
                  <Field label="Unidade" className="col-2">{(i) => <Input id={i} value={f.unidade} maxLength={6} onChange={(e) => set('unidade')(e.target.value.toUpperCase())} />}</Field>
                  <div className="form-section">Preço</div>
                  <Field label="Custo (R$)" className="col-4" hint={id ? 'Recalculado pelo custo médio a cada entrada.' : undefined}>{(i) => <NumberInput id={i} value={f.precoCusto} onChange={set('precoCusto')} />}</Field>
                  <Field label="Preço de venda (R$)" className="col-4" error={fe.precoVenda}>{(i) => <NumberInput id={i} value={f.precoVenda} onChange={set('precoVenda')} />}</Field>
                  <div className="field col-4"><span className="field-label">Margem</span><div className="input num" style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)' }}>
                    {margem === null ? '—' : `${margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</div></div>
                  <Field label="Preço anterior na loja (R$)" className="col-4" hint="Opcional. Se maior que o preço de venda, a loja mostra “de/por” e o % de desconto.">{(i) => <NumberInput id={i} value={f.precoAnterior} onChange={set('precoAnterior')} />}</Field>
                  <Field label="Descrição para a loja" className="col-8" hint="Aparece na página do produto. Uma linha em branco separa parágrafos.">{(i) => <Textarea id={i} rows={3} value={f.detalhes} onChange={(e) => set('detalhes')(e.target.value)} />}</Field>
                  <div className="form-section">Estoque</div>
                  {!id && <Field label="Estoque inicial" className="col-4" hint="Gera uma entrada no histórico.">{(i) => <NumberInput id={i} step="0.001" value={f.estoqueInicial} onChange={set('estoqueInicial')} />}</Field>}
                  <Field label="Estoque mínimo" className="col-4" hint="Abaixo disso o produto aparece em alerta.">{(i) => <NumberInput id={i} step="0.001" value={f.estoqueMinimo} onChange={set('estoqueMinimo')} />}</Field>
                  {id && <div className="col-8" style={{ alignSelf: 'center' }}><label className="check"><input type="checkbox" checked={f.ativo} onChange={(e) => set('ativo')(e.target.checked)} />Produto ativo (aparece no PDV)</label></div>}
                </div>
                </>
              )}
              {tab === 'fiscal' && (
                <div className="form-grid">
                  <Field label="NCM" className="col-4" error={fe.ncm} hint="8 dígitos, obrigatório na NF-e.">{(i) => <Input id={i} className="mono" inputMode="numeric" maxLength={8} value={f.ncm} onChange={(e) => set('ncm')(e.target.value.replace(/\D/g, ''))} />}</Field>
                  <Field label="CEST" className="col-4" error={fe.cest}>{(i) => <Input id={i} className="mono" inputMode="numeric" maxLength={7} value={f.cest} onChange={(e) => set('cest')(e.target.value.replace(/\D/g, ''))} />}</Field>
                  <Field label="CFOP" className="col-4" error={fe.cfop}>{(i) => <Input id={i} className="mono" inputMode="numeric" maxLength={4} value={f.cfop} onChange={(e) => set('cfop')(e.target.value.replace(/\D/g, ''))} />}</Field>
                  <Field label="Origem da mercadoria" className="col-6">{(i) => (
                    <Select id={i} value={f.origem} onChange={(e) => set('origem')(e.target.value)}>
                      <option value="0">0 · Nacional</option><option value="1">1 · Estrangeira, importação direta</option>
                      <option value="2">2 · Estrangeira, mercado interno</option><option value="5">5 · Nacional, conteúdo importado ≤ 40%</option>
                    </Select>)}</Field>
                  <Field label="CST / CSOSN" className="col-6" error={fe.cstIcms} hint="Simples: CSOSN (ex.: 102). Regime normal: CST (ex.: 00).">{(i) => <Input id={i} className="mono" maxLength={3} value={f.cstIcms} onChange={(e) => set('cstIcms')(e.target.value.replace(/\D/g, ''))} />}</Field>
                  <div className="form-section">Alíquotas (%) — usadas no regime normal</div>
                  <Field label="ICMS" className="col-3">{(i) => <NumberInput id={i} value={f.aliquotaIcms} onChange={set('aliquotaIcms')} />}</Field>
                  <Field label="IPI" className="col-3">{(i) => <NumberInput id={i} value={f.aliquotaIpi} onChange={set('aliquotaIpi')} />}</Field>
                  <Field label="PIS" className="col-3">{(i) => <NumberInput id={i} value={f.aliquotaPis} onChange={set('aliquotaPis')} />}</Field>
                  <Field label="COFINS" className="col-3">{(i) => <NumberInput id={i} value={f.aliquotaCofins} onChange={set('aliquotaCofins')} />}</Field>
                </div>
              )}
            </fieldset>
            <button type="submit" hidden />
          </form>
          {tab === 'ofertas' && id && <OfertasProduto produtoId={id} podeEditar={podeEditar} />}
          {tab === 'historico' && (
            movs.error ? <ErrorState message={movs.error} onRetry={movs.reload} />
              : !movs.data ? <TableSkeleton rows={4} cols={4} />
              : movs.data.content.length === 0 ? <Empty icon="boxes" title="Sem movimentações" />
              : (
                <div className="card">
                  <table className="table">
                    <thead><tr><th>Data</th><th>Origem</th><th className="right">Quantidade</th><th className="right">Saldo</th></tr></thead>
                    <tbody>
                      {movs.data.content.map((m) => (
                        <tr key={m.id}>
                          <td className="nowrap"><div>{dateTime(m.data)}</div><div className="cell-sub">{m.usuario}</div></td>
                          <td><div>{ORIGEM_LABEL[m.origem] ?? m.origem}{m.referenciaId ? <span className="muted"> #{m.referenciaId}</span> : null}</div>{m.observacao && <div className="cell-sub">{m.observacao}</div>}</td>
                          <td className={`right num ${m.tipo === 'ENTRADA' ? 'pos' : 'neg'}`}>{m.tipo === 'ENTRADA' ? '+' : '−'}{qty(m.quantidade)}</td>
                          <td className="right num">{qty(m.saldoPosterior)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}
        </>
      )}
    </Drawer>
  );
}
