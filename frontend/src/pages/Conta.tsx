import { useState } from 'react';
import { api } from '../lib/api';
import { useAction } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';
import { Alert, Button, Card, Field, Input, PageHeader } from '../components/ui';
import { useToast } from '../components/overlay';

export function Conta() {
  const { usuario } = useAuth();
  const toast = useToast();
  const act = useAction();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const diferente = conf.length > 0 && conf !== nova;

  const salvar = async () => {
    const ok = await act.run(() => api.put<void>('/auth/me/senha', { senhaAtual: atual, novaSenha: nova }).then(() => true));
    if (ok) { toast.ok('Senha alterada'); setAtual(''); setNova(''); setConf(''); }
  };

  return (
    <>
      <PageHeader title="Minha conta" sub={`${usuario?.nome} · ${usuario?.email} · ${ROLE_LABEL[usuario?.role ?? '']}`} />
      <div style={{ maxWidth: 520 }}>
        <Card title="Alterar senha" pad>
          <div className="stack">
            {act.error && <Alert>{act.error}</Alert>}
            <Field label="Senha atual">{(i) => <Input id={i} type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} />}</Field>
            <Field label="Nova senha" hint="Mínimo de 6 caracteres.">{(i) => <Input id={i} type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />}</Field>
            <Field label="Repita a nova senha" error={diferente ? 'As senhas não conferem.' : undefined}>{(i) => <Input id={i} type="password" autoComplete="new-password" value={conf} invalid={diferente} onChange={(e) => setConf(e.target.value)} />}</Field>
            <div><Button variant="primary" loading={act.busy} disabled={!atual || nova.length < 6 || nova !== conf} onClick={salvar}>Alterar senha</Button></div>
          </div>
        </Card>
      </div>
    </>
  );
}
