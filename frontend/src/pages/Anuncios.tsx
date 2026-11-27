import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { date } from '../lib/format';
import { reduzirImagem } from '../lib/imagem';
import { Alert, Badge, Button, Card, Empty, ErrorState, Field, Input, PageHeader, Select, TableSkeleton } from '../components/ui';
import { Drawer, useToast } from '../components/overlay';

type Posicao = 'HOME_TOPO' | 'HOME_MEIO' | 'LISTA' | 'PRODUTO' | 'RODAPE';
interface BannerAdmin {
  id: number; titulo: string; link: string; posicao: Posicao; inicio: string | null; fim: string | null;
  ativo: boolean; ordem: number; cliques: number; imagemUrl: string | null; noAr: boolean;
}
interface Adsense { cliente: string | null; slot: string | null }

const POSICOES: { v: Posicao; t: string; dica: string }[] = [
  { v: 'HOME_TOPO', t: 'Início · logo abaixo do destaque', dica: 'O lugar mais visto. Bom para a campanha principal da semana.' },
  { v: 'HOME_MEIO', t: 'Início · entre as fileiras', dica: 'Aparece depois das categorias e seleções.' },
  { v: 'LISTA', t: 'Listas e categorias · no meio da grade', dica: 'Entra depois do 8º produto de qualquer lista.' },
  { v: 'PRODUTO', t: 'Página do produto · abaixo das ofertas', dica: 'Quem está decidindo a compra vê aqui.' },
  { v: 'RODAPE', t: 'Todas as páginas · acima do rodapé', dica: 'Aparece em todo o site, no final da página.' },
];
const nomePosicao = (p: Posicao) => POSICOES.find((x) => x.v === p)?.t ?? p;

export function Anuncios() {
  const lista = useAsync(() => api.get<BannerAdmin[]>('/anuncios/admin'), []);
  const [editando, setEditando] = useState<BannerAdmin | 'novo' | null>(null);
  const toast = useToast();
  const remover = useAction();
  const total = lista.data?.reduce((s, b) => s + b.cliques, 0) ?? 0;

  const apagar = async (b: BannerAdmin) => {
    if (!window.confirm(`Apagar o anúncio "${b.titulo}"? Isso não tem volta.`)) return;
    const ok = await remover.run(async () => { await api.del(`/anuncios/admin/${b.id}`); return true; });
    if (ok) { toast.ok('Anúncio apagado'); lista.reload(); }
  };

  return (
    <>
      <PageHeader title="Anúncios" sub="Banners das suas campanhas (com link de afiliado) e Google AdSense, nos lugares da loja que você escolher. Cada espaço mostra o seu banner; sem banner, entra o AdSense, se estiver ligado."
        actions={<Button variant="primary" icon="plus" onClick={() => setEditando('novo')}>Novo anúncio</Button>} />

      {remover.error && <div style={{ marginBottom: 12 }}><Alert>{remover.error}</Alert></div>}

      <Card title="Seus banners" actions={lista.data && lista.data.length > 0 ? <Badge tone="info">{total} {total === 1 ? 'clique' : 'cliques'} no total</Badge> : undefined}>
        {lista.error ? <ErrorState message={lista.error} onRetry={lista.reload} />
          : !lista.data ? <TableSkeleton rows={3} cols={4} />
          : lista.data.length === 0 ? (
            <Empty icon="tag" title="Nenhum anúncio ainda"
              text="Crie um banner para uma campanha (ex.: Black Friday Mercado Livre) com o seu link de afiliado, ou para uma página da própria loja (ex.: /loja/s/natal)."
              action={<Button variant="primary" icon="plus" onClick={() => setEditando('novo')}>Criar o primeiro</Button>} />
          ) : (
            <div className="anuncios-lista">
              {lista.data.map((b) => (
                <div key={b.id} className="anuncio-item">
                  <button className="anuncio-prev" onClick={() => setEditando(b)} aria-label={`Editar ${b.titulo}`}>
                    {b.imagemUrl ? <img src={b.imagemUrl} alt="" /> : <span>sem imagem</span>}
                  </button>
                  <div className="anuncio-info">
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <strong>{b.titulo}</strong>
                      {b.noAr ? <Badge tone="success">No ar</Badge> : !b.ativo ? <Badge>Pausado</Badge> : !b.imagemUrl ? <Badge tone="warning">Falta a imagem</Badge> : <Badge tone="warning">Fora do período</Badge>}
                    </div>
                    <div className="muted">{nomePosicao(b.posicao)}</div>
                    <div className="muted">{b.inicio || b.fim ? `${b.inicio ? date(b.inicio) : 'já'} até ${b.fim ? date(b.fim) : 'sem data para acabar'}` : 'Sem data para acabar'} · {b.cliques} {b.cliques === 1 ? 'clique' : 'cliques'}</div>
                    <div className="muted mono anuncio-link">{b.link}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Button size="sm" icon="edit" onClick={() => setEditando(b)}>Editar</Button>
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => apagar(b)} aria-label="Apagar" />
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>

      <div style={{ height: 16 }} />
      <AdsenseCard />

      {editando && <BannerDrawer b={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} onSaved={lista.reload} />}
    </>
  );
}

/* ============================== criar e editar ============================== */
function BannerDrawer({ b, onClose, onSaved }: { b: BannerAdmin | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const act = useAction();
  const [titulo, setTitulo] = useState(b?.titulo ?? '');
  const [link, setLink] = useState(b?.link ?? '');
  const [posicao, setPosicao] = useState<Posicao>(b?.posicao ?? 'HOME_TOPO');
  const [inicio, setInicio] = useState(b?.inicio ?? '');
  const [fim, setFim] = useState(b?.fim ?? '');
  const [ativo, setAtivo] = useState(b?.ativo ?? true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const previa = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : b?.imagemUrl ?? null), [arquivo, b]);
  useEffect(() => () => { if (arquivo && previa) URL.revokeObjectURL(previa); }, [arquivo, previa]);

  const salvar = async () => {
    if (!b && !arquivo) { act.setError('Escolha a imagem do banner.'); return; }
    const corpo = { titulo, link, posicao, inicio: inicio || null, fim: fim || null, ativo, ordem: b?.ordem ?? 0 };
    const r = await act.run(async () => {
      const salvo = b ? await api.put<BannerAdmin>(`/anuncios/admin/${b.id}`, corpo) : await api.post<BannerAdmin>('/anuncios/admin', corpo);
      if (arquivo) {
        const img = await reduzirImagem(arquivo, 1800);
        const fd = new FormData();
        fd.append('arquivo', new File([img], 'banner.jpg', { type: img.type || 'image/jpeg' }));
        return api.upload<BannerAdmin>(`/anuncios/admin/${salvo.id}/imagem`, fd);
      }
      return salvo;
    });
    if (r) { toast.ok(r.noAr ? 'Anúncio no ar (a loja atualiza em até 1 minuto)' : 'Anúncio salvo'); onSaved(); onClose(); }
  };

  const dica = POSICOES.find((x) => x.v === posicao)?.dica;
  return (
    <Drawer open onClose={onClose} title={b ? 'Editar anúncio' : 'Novo anúncio'} sub={b ? `${b.cliques} ${b.cliques === 1 ? 'clique' : 'cliques'}` : 'Banner próprio da loja'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={act.busy} onClick={salvar}>{b ? 'Salvar' : 'Publicar anúncio'}</Button></>}>
      {act.error && <div style={{ marginBottom: 16 }}><Alert>{act.error}</Alert></div>}
      <label className="banner-upload">
        {previa ? <img src={previa} alt="" /> : <span>Escolher imagem do banner</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      <p className="muted" style={{ fontSize: 12, margin: '6px 0 16px' }}>
        Tamanho ideal: <strong>1500 × 500</strong> (3 por 1). A imagem aparece inteira, no computador e no celular; no celular ela fica menor, então use letras grandes. JPG, PNG ou WebP.
      </p>
      <div className="form-grid">
        <Field label="Nome do anúncio" className="col-12" hint="Aparece só para você e para leitores de tela (ex.: Black Friday Mercado Livre).">
          {(i) => <Input id={i} value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} autoFocus={!b} />}</Field>
        <Field label="Link" className="col-12" hint="Seu link de afiliado da campanha (https://…) ou uma página da loja (ex.: /loja/s/natal). O clique é contado antes de ir.">
          {(i) => <Input id={i} value={link} placeholder="https://meli.la/…" onChange={(e) => setLink(e.target.value)} />}</Field>
        <Field label="Onde aparece" className="col-12" hint={dica}>{(i) => (
          <Select id={i} value={posicao} onChange={(e) => setPosicao(e.target.value as Posicao)}>
            {POSICOES.map((p) => <option key={p.v} value={p.v}>{p.t}</option>)}
          </Select>)}</Field>
        <Field label="Começa em" className="col-6" hint="Vazio: já começa.">{(i) => <Input id={i} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />}</Field>
        <Field label="Termina em" className="col-6" hint="Vazio: fica até você pausar.">{(i) => <Input id={i} type="date" value={fim} onChange={(e) => setFim(e.target.value)} />}</Field>
        <div className="col-12"><label className="check"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Anúncio ativo</label></div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>A loja marca todo banner como “Publicidade”, como pedem o Conar e os programas de afiliados.</p>
    </Drawer>
  );
}

/* ============================== Google AdSense ============================== */
function AdsenseCard() {
  const cfg = useAsync(() => api.get<Adsense>('/anuncios/adsense'), []);
  const act = useAction();
  const toast = useToast();
  const [cliente, setCliente] = useState('');
  const [slot, setSlot] = useState('');
  useEffect(() => { if (cfg.data) { setCliente(cfg.data.cliente ?? ''); setSlot(cfg.data.slot ?? ''); } }, [cfg.data]);
  const ligado = !!cfg.data?.cliente;
  const vercel = typeof window !== 'undefined' && /\.vercel\.app$/.test(window.location.hostname);

  const salvar = async (limpar = false) => {
    const r = await act.run(() => api.put<Adsense>('/anuncios/adsense', limpar ? { cliente: '', slot: '' } : { cliente, slot }));
    if (r) { toast.ok(r.cliente ? 'AdSense ligado nos espaços sem banner' : 'AdSense desligado'); cfg.reload(); }
  };

  return (
    <Card title="Google AdSense" actions={<Badge tone={ligado ? 'success' : 'neutral'}>{ligado ? 'Ligado' : 'Desligado'}</Badge>}>
      <div className="card-body">
        {vercel && (
          <div style={{ marginBottom: 12 }}>
            <Alert tone="info">O AdSense só aprova site com <strong>domínio próprio</strong> (ex.: vetrina.com.br). No endereço atual da Vercel o pedido é recusado. Quando tiver o domínio, peça a aprovação no AdSense, cole os dados abaixo e o anúncio do Google entra sozinho nos espaços sem banner seu. O arquivo ads.txt já fica pronto em /ads.txt.</Alert>
          </div>
        )}
        {act.error && <div style={{ marginBottom: 12 }}><Alert>{act.error}</Alert></div>}
        <div className="form-grid">
          <Field label="ID de editor" className="col-6" hint="AdSense → Conta → Informações da conta (ca-pub-…).">
            {(i) => <Input id={i} className="mono" value={cliente} placeholder="ca-pub-0000000000000000" onChange={(e) => setCliente(e.target.value.trim())} />}</Field>
          <Field label="ID do bloco de anúncio" className="col-6" hint="AdSense → Anúncios → Por bloco de anúncios → Display (só números).">
            {(i) => <Input id={i} className="mono" inputMode="numeric" value={slot} placeholder="1234567890" onChange={(e) => setSlot(e.target.value.replace(/\D/g, ''))} />}</Field>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Button variant="primary" loading={act.busy} disabled={!cliente || !slot} onClick={() => salvar()}>{ligado ? 'Salvar' : 'Ligar AdSense'}</Button>
          {ligado && <Button variant="ghost" onClick={() => salvar(true)}>Desligar</Button>}
        </div>
      </div>
    </Card>
  );
}
