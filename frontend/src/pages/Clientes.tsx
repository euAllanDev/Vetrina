import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync, useDebounced } from '../lib/hooks';
import { date, documento, formaLabel, money } from '../lib/format';
import { navigate, useRoute } from '../lib/router';
import { useAuth } from '../lib/auth';
import type { Cliente, ContaReceber, Page, Venda } from '../lib/types';
import { Alert, Badge, Button, Card, Empty, ErrorState, Field, NumberInput, PageHeader, Pagination, SearchInput, TableSkeleton, Tabs, TituloBadge, VendaBadge } from '../components/ui';
import { Drawer, useToast } from '../components/overlay';
import { enderecoParaApi, PESSOA_VAZIA, PessoaFields, type PessoaForm } from '../components/pessoa';

export function Clientes() {
  const { query } = useRoute();
  const { pode } = useAuth();
  const [termo, setTermo] = useState('');
  const dt = useDebounced(termo);
  const [page, setPage] = useState(0);
  const lista = useAsync(() => api.get<Page<Cliente>>('/clientes', { termo: dt, page, size: 25, sort: 'nome' }), [dt, page]);
  useEffect(() => setPage(0), [dt]);
  const id = query.get('id');
  const novo = query.get('novo') === '1';
  const editar = pode('GERENTE', 'VENDEDOR');

  return (
    <>
      <PageHeader title="Clientes" sub="Pessoas e empresas que compram de você."
        actions={editar && <Button variant="primary" icon="plus" onClick={() => navigate('/clientes?novo=1')}>Novo cliente</Button>} />
      <Card>
        <div className="toolbar"><SearchInput value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome, e-mail, CPF ou CNPJ" aria-label="Buscar clientes" /></div>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton cols={5} />
          : lista.data.content.length === 0 ? <Empty icon="users" title={termo ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              text={termo ? `Nada corresponde a “${termo}”.` : 'Vendas a prazo exigem cliente cadastrado.'}
              action={editar && !termo && <Button variant="primary" icon="plus" onClick={() => navigate('/clientes?novo=1')}>Novo cliente</Button>} />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Cliente</th><th>Documento</th><th>Contato</th><th>Cidade</th><th className="right">Limite de crédito</th></tr></thead>
                  <tbody>
                    {lista.data.content.map((c) => (
                      <tr key={c.id} className="clickable" tabIndex={0} onClick={() => navigate(`/clientes?id=${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/clientes?id=${c.id}`)}>
                        <td><div className="cell-title row">{c.nome}{!c.ativo && <Badge plain>Inativo</Badge>}</div><div className="cell-sub">{c.tipoPessoa === 'FISICA' ? 'Pessoa física' : 'Pessoa jurídica'}</div></td>
                        <td className="mono">{documento(c.documento)}</td>
                        <td><div>{c.email ?? '—'}</div><div className="cell-sub">{c.telefone}</div></td>
                        <td className="ink-2">{c.endereco?.municipio ? `${c.endereco.municipio}/${c.endereco.uf}` : '—'}</td>
                        <td className="right num">{c.limiteCredito > 0 ? money(c.limiteCredito) : <span className="muted">Sem limite</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={lista.data.page.totalPages} total={lista.data.page.totalElements} onPage={setPage} label="clientes" />
            </>
          )}
      </Card>
      {(id || novo) && <ClienteDrawer id={id ? Number(id) : null} podeEditar={editar} onClose={() => navigate('/clientes')} onSaved={lista.reload} />}
    </>
  );
}

function ClienteDrawer({ id, podeEditar, onClose, onSaved }: { id: number | null; podeEditar: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [tab, setTab] = useState<'dados' | 'compras' | 'financeiro'>('dados');
  const [f, setF] = useState<PessoaForm>(PESSOA_VAZIA);
  const [limite, setLimite] = useState<number | ''>('');
  const [ativo, setAtivo] = useState(true);
  const cli = useAsync(() => (id ? api.get<Cliente>(`/clientes/${id}`) : Promise.resolve(undefined)), [id]);
  const vendas = useAsync(() => (id && tab === 'compras' ? api.get<Page<Venda>>('/vendas', { clienteId: id, size: 20, sort: 'id,desc' }) : Promise.resolve(undefined)), [id, tab]);
  const titulos = useAsync(() => (id && tab === 'financeiro' ? api.get<Page<ContaReceber>>('/financeiro/receber', { clienteId: id, size: 30 }).catch(() => undefined) : Promise.resolve(undefined)), [id, tab]);

  useEffect(() => {
    const c = cli.data;
    if (!c) { setF(PESSOA_VAZIA); setLimite(''); setAtivo(true); return; }
    setF({ tipoPessoa: c.tipoPessoa, nome: c.nome, nomeFantasia: '', documento: c.documento, inscricaoEstadual: c.inscricaoEstadual ?? '',
      email: c.email ?? '', telefone: c.telefone ?? '', endereco: c.endereco ?? {} });
    setLimite(c.limiteCredito); setAtivo(c.ativo);
  }, [cli.data]);

  const salvar = async () => {
    const body = { tipoPessoa: f.tipoPessoa, nome: f.nome, documento: f.documento, inscricaoEstadual: f.inscricaoEstadual || null,
      email: f.email || null, telefone: f.telefone || null, endereco: enderecoParaApi(f.endereco), limiteCredito: Number(limite || 0), ativo };
    const c = await act.run(() => (id ? api.put<Cliente>(`/clientes/${id}`, body) : api.post<Cliente>('/clientes', body)));
    if (c) { toast.ok(id ? 'Cliente atualizado' : `${c.nome} cadastrado`); onSaved(); onClose(); }
  };

  return (
    <Drawer open onClose={onClose} wide title={id ? (cli.data?.nome ?? 'Cliente') : 'Novo cliente'} sub={cli.data && <span className="mono">{documento(cli.data.documento)}</span>}
      footer={podeEditar && tab === 'dados' && <><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={act.busy} onClick={salvar}>{id ? 'Salvar alterações' : 'Cadastrar cliente'}</Button></>}>
      {id && <Tabs value={tab} onChange={setTab} tabs={[{ value: 'dados', label: 'Dados' }, { value: 'compras', label: 'Compras' }, { value: 'financeiro', label: 'Financeiro' }]} />}
      {tab === 'dados' && (
        <fieldset disabled={!podeEditar} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          {act.error && <Alert>{act.error}</Alert>}
          <PessoaFields f={f} set={(p) => setF((x) => ({ ...x, ...p }))} errors={act.fieldErrors} />
          <div className="form-grid">
            <div className="form-section">Crédito</div>
            <Field label="Limite de crédito (R$)" className="col-6" hint="Vale para vendas a prazo. Zero = sem limite.">{(i) => <NumberInput id={i} value={limite} onChange={setLimite} />}</Field>
            {id && <div className="col-6" style={{ alignSelf: 'center' }}><label className="check"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Cliente ativo</label></div>}
          </div>
        </fieldset>
      )}
      {tab === 'compras' && (!vendas.data ? <TableSkeleton rows={4} cols={4} /> : vendas.data.content.length === 0 ? <Empty icon="receipt" title="Sem compras" /> : (
        <div className="card"><table className="table">
          <thead><tr><th>Venda</th><th>Pagamento</th><th>Status</th><th className="right">Total</th></tr></thead>
          <tbody>{vendas.data.content.map((v) => (
            <tr key={v.id} className="clickable" onClick={() => navigate(`/vendas?id=${v.id}`)}>
              <td><div className="cell-title num">#{v.id}</div><div className="cell-sub">{date(v.criadoEm)}</div></td>
              <td>{formaLabel(v.formaPagamento)}</td><td><VendaBadge s={v.status} /></td><td className="right num">{money(v.valorTotal)}</td></tr>
          ))}</tbody>
        </table></div>
      ))}
      {tab === 'financeiro' && (!titulos.data ? (titulos.loading ? <TableSkeleton rows={4} cols={4} /> : <Empty icon="shield" title="Sem acesso ao financeiro" />)
        : titulos.data.content.length === 0 ? <Empty icon="wallet" title="Nenhum título" /> : (
        <div className="card"><table className="table">
          <thead><tr><th>Descrição</th><th>Vencimento</th><th>Status</th><th className="right">Valor</th></tr></thead>
          <tbody>{titulos.data.content.map((t) => (
            <tr key={t.id}><td>{t.descricao}</td><td className="num">{date(t.vencimento)}</td><td><TituloBadge s={t.status} vencida={t.vencida} pagoLabel="Recebido" /></td><td className="right num">{money(t.valor)}</td></tr>
          ))}</tbody>
        </table></div>
      ))}
    </Drawer>
  );
}
