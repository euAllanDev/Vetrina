import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { Alert, Badge, Button, Field, Input } from '../components/ui';
import { Icon } from '../components/icons';
import { ApiError } from '../lib/api';

export function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    try {
      await entrar(email.trim(), senha);
    } catch (err) {
      setErro(err instanceof ApiError && err.status === 401 ? 'E-mail ou senha incorretos.' : err instanceof Error ? err.message : 'Falha ao entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-form">
        <div className="brand" style={{ padding: 0, marginBottom: 48 }}>
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div className="brand-name" style={{ fontSize: 15 }}>ERP</div>
        </div>
        <h1>Entrar</h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 28 }}>Use o e-mail e a senha cadastrados pelo administrador.</p>
        <form onSubmit={submit} className="stack" noValidate>
          {erro && <Alert>{erro}</Alert>}
          <Field label="E-mail">
            {(id) => <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}
          </Field>
          <Field label="Senha">
            {(id) => <Input id={id} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!email || !senha}>Entrar</Button>
        </form>
        <p className="muted" style={{ fontSize: 12, marginTop: 40 }}>
          Primeiro acesso no ambiente de demonstração: admin@erp.com / admin123
        </p>
        <p style={{ fontSize: 13, marginTop: 8 }}><a href="/loja">Ir para a loja</a></p>
      </div>

      <div className="login-art" aria-hidden="true">
        <div className="preview">
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.8px', lineHeight: 1.15 }}>Do balcão à nota fiscal.</p>
            <p className="ink-2" style={{ marginTop: 8, maxWidth: '46ch' }}>
              Ao confirmar uma venda, o estoque baixa, os títulos entram no financeiro e a NF-e fica a um clique.
            </p>
          </div>
          <div className="card card-pad">
            <div className="row-between">
              <span className="section-title">Venda no balcão</span>
              <div className="row">
                <Badge>Orçamento</Badge><Icon name="arrowRight" size={14} className="muted" />
                <Badge tone="info">Confirmada</Badge><Icon name="arrowRight" size={14} className="muted" />
                <Badge tone="success">Faturada</Badge>
              </div>
            </div>
            <div className="divider" style={{ margin: '16px 0' }} />
            <div className="stack-sm">
              {[72, 54, 63].map((w, i) => (
                <div key={i} className="row-between">
                  <div className="row"><span className="rank">{i + 1}</span><div className="skeleton" style={{ width: w * 3, height: 10 }} /></div>
                  <div className="skeleton" style={{ width: 64, height: 10 }} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-2">
            <div className="card card-pad">
              <div className="kpi-label"><Icon name="boxes" size={15} />Estoque</div>
              <div className="row" style={{ marginTop: 14, gap: 6, alignItems: 'flex-end', height: 56 }}>
                {[38, 52, 30, 64, 46, 58, 72, 50, 66, 80].map((h, i) => (
                  <span key={i} style={{ flex: 1, height: `${h}%`, background: i === 9 ? 'var(--primary)' : 'var(--surface-3)', borderRadius: 3 }} />
                ))}
              </div>
            </div>
            <div className="card card-pad">
              <div className="kpi-label"><Icon name="file" size={15} />NF-e modelo 55</div>
              <div className="chave muted" style={{ marginTop: 14, lineHeight: 1.7 }}>3526 1111 2223 3300 0181 5500 1000 0000 0115 2049 1977</div>
              <div style={{ marginTop: 8 }}><Badge tone="success">Autorizada</Badge></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
