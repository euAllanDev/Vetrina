import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { date, initials, ROLE_LABEL } from '../lib/format';
import { useAuth } from '../lib/auth';
import type { Page, Role, Usuario } from '../lib/types';
import { Alert, Badge, Button, Card, ErrorState, Field, Input, PageHeader, Select, TableSkeleton } from '../components/ui';
import { Drawer, useToast } from '../components/overlay';

const DESCR: Record<Role, string> = {
  ADMIN: 'Tudo, inclusive usuários e dados da empresa.',
  GERENTE: 'Operação completa, financeiro, relatórios e cancelamentos.',
  VENDEDOR: 'PDV, vendas, clientes e emissão de NF-e.',
  ESTOQUISTA: 'Produtos, estoque, compras e fornecedores.',
  FINANCEIRO: 'Contas a pagar e receber, fornecedores e notas.',
};

export function Usuarios() {
  const { usuario: eu } = useAuth();
  const lista = useAsync(() => api.get<Page<Usuario>>('/usuarios', { size: 100, sort: 'nome' }), []);
  const [edit, setEdit] = useState<Usuario | 'novo' | null>(null);

  return (
    <>
      <PageHeader title="Usuários" sub="Quem acessa o sistema e o que cada perfil pode fazer."
        actions={<Button variant="primary" icon="plus" onClick={() => setEdit('novo')}>Novo usuário</Button>} />
      <Card>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} /> : !lista.data ? <TableSkeleton cols={4} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Usuário</th><th>Perfil</th><th>Desde</th><th>Situação</th></tr></thead>
              <tbody>
                {lista.data.content.map((u) => (
                  <tr key={u.id} className="clickable" tabIndex={0} onClick={() => setEdit(u)} onKeyDown={(e) => e.key === 'Enter' && setEdit(u)}>
                    <td><div className="row"><span className="avatar">{initials(u.nome)}</span><div><div className="cell-title">{u.nome}{u.id === eu?.id && <span className="muted"> (você)</span>}</div><div className="cell-sub">{u.email}</div></div></div></td>
                    <td><div>{ROLE_LABEL[u.role]}</div><div className="cell-sub">{DESCR[u.role]}</div></td>
                    <td className="num muted">{date(u.criadoEm)}</td>
                    <td>{u.ativo ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit && <UsuarioDrawer u={edit === 'novo' ? null : edit} proprio={edit !== 'novo' && edit.id === eu?.id} onClose={() => setEdit(null)} onSaved={lista.reload} />}
    </>
  );
}

function UsuarioDrawer({ u, proprio, onClose, onSaved }: { u: Usuario | null; proprio: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [nome, setNome] = useState(u?.nome ?? '');
  const [email, setEmail] = useState(u?.email ?? '');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<Role>(u?.role ?? 'VENDEDOR');
  const [ativo, setAtivo] = useState(u?.ativo ?? true);

  const salvar = async () => {
    const body = { nome, email, senha: senha || null, role, ativo };
    const r = await act.run(() => (u ? api.put<Usuario>(`/usuarios/${u.id}`, body) : api.post<Usuario>('/usuarios', body)));
    if (r) { toast.ok(u ? 'Usuário atualizado' : `${r.nome} pode entrar com ${r.email}`); onSaved(); onClose(); }
  };

  return (
    <Drawer open onClose={onClose} title={u ? u.nome : 'Novo usuário'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={act.busy} disabled={!nome || !email || (!u && senha.length < 6)} onClick={salvar}>{u ? 'Salvar alterações' : 'Criar usuário'}</Button></>}>
      <div className="stack">
        {act.error && <Alert>{act.error}</Alert>}
        <div className="form-grid">
          <Field label="Nome" className="col-12" error={act.fieldErrors.nome}>{(i) => <Input id={i} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />}</Field>
          <Field label="E-mail" className="col-12" error={act.fieldErrors.email}>{(i) => <Input id={i} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label={u ? 'Nova senha' : 'Senha'} className="col-12" error={act.fieldErrors.senha} hint={u ? 'Deixe em branco para manter a atual.' : 'Mínimo de 6 caracteres.'}>
            {(i) => <Input id={i} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
          </Field>
          <Field label="Perfil" className="col-12" hint={DESCR[role]}>{(i) => (
            <Select id={i} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={proprio}>
              {(Object.keys(DESCR) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>)}</Field>
          {u && !proprio && <div className="col-12"><label className="check"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Usuário ativo (pode entrar no sistema)</label></div>}
        </div>
      </div>
    </Drawer>
  );
}
