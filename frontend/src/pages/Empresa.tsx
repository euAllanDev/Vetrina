import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAction } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { Empresa } from '../lib/types';
import { Alert, Button, Card, Field, Input, NumberInput, PageHeader, Select, Skeleton } from '../components/ui';
import { useToast } from '../components/overlay';
import { enderecoParaApi, PessoaFields, type PessoaForm } from '../components/pessoa';

const UFS: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53,
};

export function EmpresaPage() {
  const { empresa, recarregarEmpresa, pode } = useAuth();
  const toast = useToast();
  const act = useAction();
  const [f, setF] = useState<PessoaForm | null>(null);
  const [fiscal, setFiscal] = useState({ inscricaoMunicipal: '', crt: 1, serieNfe: 1 as number | '', proximoNumeroNfe: 1 as number | '', ambienteNfe: 2 });

  useEffect(() => {
    if (!empresa) return;
    setF({ tipoPessoa: 'JURIDICA', nome: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia ?? '', documento: empresa.cnpj,
      inscricaoEstadual: empresa.inscricaoEstadual ?? '', email: empresa.email ?? '', telefone: empresa.telefone ?? '', endereco: empresa.endereco ?? {} });
    setFiscal({ inscricaoMunicipal: empresa.inscricaoMunicipal ?? '', crt: empresa.crt, serieNfe: empresa.serieNfe, proximoNumeroNfe: empresa.proximoNumeroNfe, ambienteNfe: empresa.ambienteNfe });
  }, [empresa]);

  if (!f) return <><PageHeader title="Empresa e NF-e" /><Card pad><Skeleton h={300} /></Card></>;

  const uf = (f.endereco.uf ?? '').toUpperCase();
  const salvar = async () => {
    const body = {
      razaoSocial: f.nome, nomeFantasia: f.nomeFantasia || null, cnpj: f.documento, inscricaoEstadual: f.inscricaoEstadual || null,
      inscricaoMunicipal: fiscal.inscricaoMunicipal || null, crt: fiscal.crt, telefone: f.telefone || null, email: f.email || null,
      endereco: enderecoParaApi(f.endereco) ?? {}, codigoUf: UFS[uf] ?? empresa?.codigoUf, serieNfe: Number(fiscal.serieNfe), proximoNumeroNfe: Number(fiscal.proximoNumeroNfe),
      ambienteNfe: fiscal.ambienteNfe,
    };
    const r = await act.run(() => api.put<Empresa>('/empresa', body));
    if (r) { toast.ok('Dados da empresa salvos'); recarregarEmpresa(); }
  };
  const ro = !pode();

  return (
    <>
      <PageHeader title="Empresa e NF-e" sub="Dados do emitente usados em todas as notas fiscais."
        actions={!ro && <Button variant="primary" loading={act.busy} onClick={salvar}>Salvar alterações</Button>} />
      {act.error && <div style={{ marginBottom: 16 }}><Alert>{act.error}</Alert></div>}
      <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }} className="grid grid-3-1">
        <Card title="Emitente" pad>
          <PessoaFields f={f} set={(p) => setF((x) => (x ? { ...x, ...p, tipoPessoa: 'JURIDICA' } : x))} errors={act.fieldErrors} fantasia />
        </Card>
        <div className="stack">
          <Card title="Emissão de NF-e" pad>
            <div className="form-grid">
              <Field label="Regime tributário (CRT)" className="col-12">{(i) => (
                <Select id={i} value={fiscal.crt} onChange={(e) => setFiscal({ ...fiscal, crt: Number(e.target.value) })}>
                  <option value={1}>1 · Simples Nacional</option><option value={2}>2 · Simples, excesso de sublimite</option><option value={3}>3 · Regime normal</option>
                </Select>)}</Field>
              <Field label="Ambiente" className="col-12" hint="Use homologação até validar com a SEFAZ.">{(i) => (
                <Select id={i} value={fiscal.ambienteNfe} onChange={(e) => setFiscal({ ...fiscal, ambienteNfe: Number(e.target.value) })}>
                  <option value={2}>Homologação (testes, sem valor fiscal)</option><option value={1}>Produção</option>
                </Select>)}</Field>
              <Field label="Série" className="col-6">{(i) => <NumberInput id={i} step="1" value={fiscal.serieNfe} onChange={(v) => setFiscal({ ...fiscal, serieNfe: v })} />}</Field>
              <Field label="Próximo número" className="col-6">{(i) => <NumberInput id={i} step="1" min={1} value={fiscal.proximoNumeroNfe} onChange={(v) => setFiscal({ ...fiscal, proximoNumeroNfe: v })} />}</Field>
              <Field label="Inscrição municipal" className="col-12">{(i) => <Input id={i} value={fiscal.inscricaoMunicipal} onChange={(e) => setFiscal({ ...fiscal, inscricaoMunicipal: e.target.value })} />}</Field>
              <div className="col-12 muted" style={{ fontSize: 12 }}>Código da UF na chave de acesso: <span className="mono">{UFS[uf] ?? '—'}</span> ({uf || 'informe a UF'})</div>
            </div>
          </Card>
          <Alert tone="info">A transmissão para a SEFAZ está em modo simulado. Para emitir de verdade, configure o certificado A1 no backend.</Alert>
        </div>
      </fieldset>
    </>
  );
}
