import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import type { CapturaResultado, CapturaVerificacao, Categoria } from '../lib/types';
import { money } from '../lib/format';
import { Alert, Button, Field, Input, NumberInput, Select } from './ui';
import type { Capturado } from '../lib/capturar';
import { reduzirImagem } from '../lib/imagem';
import { Drawer, useToast } from './overlay';

/**
 * Gaveta que publica um produto capturado (pelo favorito do navegador ou pelo app do celular).
 * Confere se já existe na loja, sugere juntar com produto parecido e envia a foto.
 */
export function CapturaDrawer({ captura, onClose, onSaved, avisos }: { captura: Capturado | null; onClose: () => void; onSaved: (r: CapturaResultado) => void; avisos?: string[] }) {
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
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const fotoPrevia = useMemo(() => (fotoArquivo ? URL.createObjectURL(fotoArquivo) : null), [fotoArquivo]);
  useEffect(() => () => { if (fotoPrevia) URL.revokeObjectURL(fotoPrevia); }, [fotoPrevia]);
  const chave = captura ? `${captura.urlProduto}|${captura.preco}` : '';

  useEffect(() => {
    if (!captura) return;
    setV(null);
    setNome(captura.nome);
    setPreco(captura.preco || '');
    setAnterior(captura.precoAnterior ?? '');
    setLink(captura.link);
    setCategoriaId('');
    setJuntar(null);
    setFotoArquivo(null);
    void ver.run(() => api.post<CapturaVerificacao>('/integracoes/captura/verificar',
      { loja: captura.loja, nome: captura.nome, urlProduto: captura.urlProduto ?? captura.link, codigo: captura.codigo ?? null })).then((r) => {
      if (!r) return;
      setV(r);
      // Awin: o link de comissão é montado pelo servidor a partir do endereço do produto.
      if (r.linkAutomatico && !/awin1\.com/.test(captura.link)) setLink('');
      if (r.existente) {
        if (r.existente.link) setLink(r.existente.link);
        if (r.existente.categoriaId) setCategoriaId(String(r.existente.categoriaId));
      }
    });
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!captura) return null;
  const ex = v?.existente ?? null;
  const p = preco === '' ? 0 : preco;

  const enviarArquivo = async (produtoId: number, blob: Blob) => {
    const img = await reduzirImagem(blob, 1200);
    const fd = new FormData();
    fd.append('arquivo', new File([img], 'produto.jpg', { type: img.type || 'image/jpeg' }));
    await api.upload(`/produtos/${produtoId}/imagem`, fd);
    return true;
  };

  const enviarFoto = async (produtoId: number) => {
    // Foto escolhida no celular vale mais que a da página.
    if (fotoArquivo) {
      try { return await enviarArquivo(produtoId, fotoArquivo); } catch { return false; }
    }
    if (!captura.imagem) return false;
    // Primeiro o servidor baixa direto da loja (não depende do navegador); se não der, o navegador tenta.
    try {
      const s = await api.post<{ ok: boolean }>('/integracoes/captura/foto', { produtoId, imagem: captura.imagem });
      if (s.ok) return true;
    } catch { /* tenta pelo navegador */ }
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
    let foto = r.temFoto && !fotoArquivo;
    if (!foto) foto = await enviarFoto(r.produtoId) || r.temFoto;
    if (r.novo && juntar) toast.ok(`Oferta ${v?.parceiro ? `${daLoja(v.parceiro)} ` : ''}adicionada a ${r.nome}: agora ele compara lojas`);
    else if (r.novo) toast.ok(`${r.nome} publicado na loja${foto ? '' : ' (sem foto: envie em Produtos)'}`);
    else if (r.precoAntes != null && r.precoAntes !== r.preco) toast.ok(`Preço atualizado: ${money(r.precoAntes)} → ${money(r.preco)}${r.baixou ? ' · selo "Baixou" ligado' : ''}`);
    else toast.ok(`Preço conferido: continua ${money(r.preco)}`);
    onSaved(r);
    onClose();
  };

  return (
    <Drawer open onClose={onClose} title={ex ? 'Atualizar preço' : 'Publicar produto capturado'}
      sub={v ? `${v.parceiro}${v.codigo ? ` · ${v.codigo}` : ''}` : 'Conferindo…'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" icon={ex ? 'refresh' : 'check'} loading={salvar.busy} disabled={!v || !nome.trim() || !p || (!link.trim() && !v.linkAutomatico)} onClick={publicar}>
          {ex ? (ex.preco !== p ? `Atualizar: ${money(ex.preco)} → ${money(p)}` : 'Confirmar preço') : juntar ? 'Adicionar ao produto' : 'Publicar na loja'}
        </Button>
      </>}>
      {ver.error && <Alert>{ver.error}</Alert>}
      {avisos && avisos.length > 0 && <div style={{ marginBottom: 12 }}><Alert tone="warning">{avisos.join(' ')}</Alert></div>}
      {salvar.error && <div style={{ marginBottom: 12 }}><Alert>{salvar.error}</Alert></div>}
      {ex && <div style={{ marginBottom: 16 }}><Alert tone="info">Este produto já está na loja (<a href={`#/produtos?id=${ex.produtoId}`}>{ex.nome}</a>). Salvar só atualiza o preço e registra no histórico.</Alert></div>}
      <div className="captura-prev">
        <label className="captura-foto" title="Trocar a foto">
          {fotoPrevia || captura.imagem ? <img src={fotoPrevia ?? captura.imagem} alt="" referrerPolicy="no-referrer" /> : <div className="captura-sem-foto">sem foto</div>}
          <span className="captura-foto-btn">{fotoPrevia || captura.imagem ? 'Trocar foto' : 'Escolher foto'}</span>
          <input type="file" accept="image/*" hidden onChange={(e) => setFotoArquivo(e.target.files?.[0] ?? null)} />
        </label>
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
        {v?.avisoLink && <div className="col-12"><Alert tone="warning">{v.avisoLink}</Alert></div>}
        <Field label="Seu link de afiliado" className="col-12" hint={v?.linkAutomatico && !link.trim()
          ? 'Pode deixar vazio: o link da Awin com a sua comissão é montado automaticamente.'
          : 'É para onde o botão “Ver na loja” leva. Se preferir, cole o link curto (meli.la/…) que você gerou.'}>
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
export const daLoja = (nome: string) => `${/^(mercado|magazine)/i.test(nome) ? 'do' : 'da'} ${nome}`;

