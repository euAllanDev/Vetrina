import { useState } from 'react';
import { Field, Input, Segmented } from './ui';
import { onlyDigits } from '../lib/format';
import type { Endereco, TipoPessoa } from '../lib/types';

export interface PessoaForm {
  tipoPessoa: TipoPessoa; nome: string; nomeFantasia: string; documento: string; inscricaoEstadual: string;
  email: string; telefone: string; endereco: Endereco;
}
export const PESSOA_VAZIA: PessoaForm = {
  tipoPessoa: 'FISICA', nome: '', nomeFantasia: '', documento: '', inscricaoEstadual: '', email: '', telefone: '', endereco: {},
};

function mascaraDoc(v: string, tipo: TipoPessoa) {
  const d = tipo === 'FISICA' ? onlyDigits(v).slice(0, 11) : v.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 14);
  // [tamanho do bloco, separador antes do bloco]
  const blocos: [number, string][] = tipo === 'FISICA'
    ? [[3, ''], [3, '.'], [3, '.'], [2, '-']]
    : [[2, ''], [3, '.'], [3, '.'], [4, '/'], [2, '-']];
  let out = '';
  let pos = 0;
  for (const [n, sep] of blocos) {
    if (pos >= d.length) break;
    out += (pos > 0 ? sep : '') + d.slice(pos, pos + n);
    pos += n;
  }
  return out;
}

/** Campos comuns de cliente e fornecedor, com busca de endereço pelo CEP (ViaCEP). */
export function PessoaFields({ f, set, errors, fantasia, nomeLabel }:
  { f: PessoaForm; set: (patch: Partial<PessoaForm>) => void; errors: Record<string, string>; fantasia?: boolean; nomeLabel?: string }) {
  const [cepStatus, setCepStatus] = useState<string | null>(null);
  const end = f.endereco;
  const setEnd = (patch: Partial<Endereco>) => set({ endereco: { ...end, ...patch } });

  const buscarCep = async () => {
    const cep = onlyDigits(end.cep ?? '');
    if (cep.length !== 8) return;
    setCepStatus('Buscando endereço…');
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j.erro) { setCepStatus('CEP não encontrado.'); return; }
      setEnd({ cep, logradouro: j.logradouro || end.logradouro, bairro: j.bairro || end.bairro, municipio: j.localidade, uf: j.uf, codigoMunicipio: j.ibge });
      setCepStatus(null);
    } catch {
      setCepStatus('Não foi possível consultar o CEP; preencha manualmente.');
    }
  };

  const pf = f.tipoPessoa === 'FISICA';
  return (
    <div className="form-grid">
      <div className="col-12">
        <Segmented label="Tipo de pessoa" value={f.tipoPessoa} onChange={(v) => set({ tipoPessoa: v, documento: '' })}
          options={[{ value: 'FISICA', label: 'Pessoa física' }, { value: 'JURIDICA', label: 'Pessoa jurídica' }]} />
      </div>
      <Field label={pf ? 'CPF' : 'CNPJ'} className="col-6" error={errors.documento}>
        {(i) => <Input id={i} className="mono" value={mascaraDoc(f.documento, f.tipoPessoa)} onChange={(e) => set({ documento: e.target.value })} placeholder={pf ? '000.000.000-00' : '00.000.000/0000-00'} />}
      </Field>
      <Field label="Inscrição estadual" className="col-6" hint={pf ? undefined : 'Deixe em branco se isento.'}>{(i) => <Input id={i} value={f.inscricaoEstadual} onChange={(e) => set({ inscricaoEstadual: e.target.value })} />}</Field>
      <Field label={nomeLabel ?? (pf ? 'Nome completo' : 'Razão social')} className={fantasia ? 'col-6' : 'col-12'} error={errors.nome || errors.razaoSocial}>
        {(i) => <Input id={i} value={f.nome} onChange={(e) => set({ nome: e.target.value })} />}
      </Field>
      {fantasia && <Field label="Nome fantasia" className="col-6">{(i) => <Input id={i} value={f.nomeFantasia} onChange={(e) => set({ nomeFantasia: e.target.value })} />}</Field>}
      <Field label="E-mail" className="col-6" error={errors.email}>{(i) => <Input id={i} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />}</Field>
      <Field label="Telefone" className="col-6">{(i) => <Input id={i} type="tel" value={f.telefone} onChange={(e) => set({ telefone: e.target.value })} />}</Field>

      <div className="form-section">Endereço</div>
      <Field label="CEP" className="col-4" error={errors['endereco.cep']} hint={cepStatus ?? 'Preenche o endereço automaticamente.'}>
        {(i) => <Input id={i} className="mono" inputMode="numeric" value={end.cep ?? ''} maxLength={9}
          onChange={(e) => setEnd({ cep: onlyDigits(e.target.value).slice(0, 8) })} onBlur={buscarCep} />}
      </Field>
      <Field label="Logradouro" className="col-8">{(i) => <Input id={i} value={end.logradouro ?? ''} onChange={(e) => setEnd({ logradouro: e.target.value })} />}</Field>
      <Field label="Número" className="col-3">{(i) => <Input id={i} value={end.numero ?? ''} onChange={(e) => setEnd({ numero: e.target.value })} />}</Field>
      <Field label="Complemento" className="col-4">{(i) => <Input id={i} value={end.complemento ?? ''} onChange={(e) => setEnd({ complemento: e.target.value })} />}</Field>
      <Field label="Bairro" className="col-5">{(i) => <Input id={i} value={end.bairro ?? ''} onChange={(e) => setEnd({ bairro: e.target.value })} />}</Field>
      <Field label="Município" className="col-6">{(i) => <Input id={i} value={end.municipio ?? ''} onChange={(e) => setEnd({ municipio: e.target.value })} />}</Field>
      <Field label="UF" className="col-2" error={errors['endereco.uf']}>{(i) => <Input id={i} maxLength={2} value={end.uf ?? ''} onChange={(e) => setEnd({ uf: e.target.value.toUpperCase() })} />}</Field>
      <Field label="Cód. IBGE" className="col-4" error={errors['endereco.codigoMunicipio']}>{(i) => <Input id={i} className="mono" inputMode="numeric" maxLength={7} value={end.codigoMunicipio ?? ''} onChange={(e) => setEnd({ codigoMunicipio: onlyDigits(e.target.value) })} />}</Field>
    </div>
  );
}

/** Remove strings vazias do endereço para não violar os padrões do backend (CEP, UF, IBGE). */
export function enderecoParaApi(e: Endereco): Endereco | null {
  const limpo: Endereco = {};
  let algum = false;
  for (const [k, v] of Object.entries(e)) {
    if (v !== null && v !== undefined && String(v).trim() !== '') { (limpo as Record<string, string>)[k] = String(v).trim(); algum = true; }
  }
  return algum ? limpo : null;
}
