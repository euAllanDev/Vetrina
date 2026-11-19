import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync, useDebounced } from '../lib/hooks';
import { documento } from '../lib/format';
import { navigate, useRoute } from '../lib/router';
import type { Fornecedor, Page } from '../lib/types';
import { Alert, Badge, Button, Card, Empty, ErrorState, Field, Input, PageHeader, Pagination, SearchInput, TableSkeleton } from '../components/ui';
import { Drawer, useToast } from '../components/overlay';
import { enderecoParaApi, PESSOA_VAZIA, PessoaFields, type PessoaForm } from '../components/pessoa';

export function Fornecedores() {
  const { query } = useRoute();
  const [termo, setTermo] = useState('');
  const dt = useDebounced(termo);
  const [page, setPage] = useState(0);
  const lista = useAsync(() => api.get<Page<Fornecedor>>('/fornecedores', { termo: dt, page, size: 25, sort: 'razaoSocial' }), [dt, page]);
  useEffect(() => setPage(0), [dt]);
  const id = query.get('id');
  const novo = query.get('novo') === '1';

  return (
    <>
      <PageHeader title="Fornecedores" sub="De quem você compra mercadoria."
        actions={<Button variant="primary" icon="plus" onClick={() => navigate('/fornecedores?novo=1')}>Novo fornecedor</Button>} />
      <Card>
        <div className="toolbar"><SearchInput value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Razão social, fantasia ou CNPJ" aria-label="Buscar fornecedores" /></div>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton cols={4} />
          : lista.data.content.length === 0 ? <Empty icon="factory" title={termo ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
              action={!termo && <Button variant="primary" icon="plus" onClick={() => navigate('/fornecedores?novo=1')}>Novo fornecedor</Button>} />
          : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fornecedor</th><th>Documento</th><th>Contato</th><th>Cidade</th></tr></thead>
                  <tbody>
                    {lista.data.content.map((f) => (
                      <tr key={f.id} className="clickable" tabIndex={0} onClick={() => navigate(`/fornecedores?id=${f.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/fornecedores?id=${f.id}`)}>
                        <td><div className="cell-title row">{f.razaoSocial}{!f.ativo && <Badge plain>Inativo</Badge>}</div><div className="cell-sub">{f.nomeFantasia}</div></td>
                        <td className="mono">{documento(f.documento)}</td>
                        <td><div>{f.contato ?? f.email ?? '—'}</div><div className="cell-sub">{f.telefone}</div></td>
                        <td className="ink-2">{f.endereco?.municipio ? `${f.endereco.municipio}/${f.endereco.uf}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={lista.data.page.totalPages} total={lista.data.page.totalElements} onPage={setPage} label="fornecedores" />
            </>
          )}
      </Card>
      {(id || novo) && <FornecedorDrawer id={id ? Number(id) : null} onClose={() => navigate('/fornecedores')} onSaved={lista.reload} />}
    </>
  );
}

function FornecedorDrawer({ id, onClose, onSaved }: { id: number | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [f, setF] = useState<PessoaForm>({ ...PESSOA_VAZIA, tipoPessoa: 'JURIDICA' });
  const [contato, setContato] = useState('');
  const [ativo, setAtivo] = useState(true);
  const forn = useAsync(() => (id ? api.get<Fornecedor>(`/fornecedores/${id}`) : Promise.resolve(undefined)), [id]);

  useEffect(() => {
    const x = forn.data;
    if (!x) return;
    setF({ tipoPessoa: x.tipoPessoa, nome: x.razaoSocial, nomeFantasia: x.nomeFantasia ?? '', documento: x.documento, inscricaoEstadual: x.inscricaoEstadual ?? '',
      email: x.email ?? '', telefone: x.telefone ?? '', endereco: x.endereco ?? {} });
    setContato(x.contato ?? ''); setAtivo(x.ativo);
  }, [forn.data]);

  const salvar = async () => {
    const body = { tipoPessoa: f.tipoPessoa, razaoSocial: f.nome, nomeFantasia: f.nomeFantasia || null, documento: f.documento,
      inscricaoEstadual: f.inscricaoEstadual || null, email: f.email || null, telefone: f.telefone || null, contato: contato || null,
      endereco: enderecoParaApi(f.endereco), ativo };
    const r = await act.run(() => (id ? api.put<Fornecedor>(`/fornecedores/${id}`, body) : api.post<Fornecedor>('/fornecedores', body)));
    if (r) { toast.ok(id ? 'Fornecedor atualizado' : `${r.razaoSocial} cadastrado`); onSaved(); onClose(); }
  };

  return (
    <Drawer open onClose={onClose} wide title={id ? (forn.data?.razaoSocial ?? 'Fornecedor') : 'Novo fornecedor'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={act.busy} onClick={salvar}>{id ? 'Salvar alterações' : 'Cadastrar fornecedor'}</Button></>}>
      <div className="stack">
        {act.error && <Alert>{act.error}</Alert>}
        <PessoaFields f={f} set={(p) => setF((x) => ({ ...x, ...p }))} errors={act.fieldErrors} fantasia nomeLabel={f.tipoPessoa === 'FISICA' ? 'Nome completo' : 'Razão social'} />
        <div className="form-grid">
          <Field label="Pessoa de contato" className="col-6">{(i) => <Input id={i} value={contato} onChange={(e) => setContato(e.target.value)} />}</Field>
          {id && <div className="col-6" style={{ alignSelf: 'center' }}><label className="check"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Fornecedor ativo</label></div>}
        </div>
      </div>
    </Drawer>
  );
}
