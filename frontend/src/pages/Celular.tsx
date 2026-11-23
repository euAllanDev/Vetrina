import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction, useAsync } from '../lib/hooks';
import { navigate, useRoute } from '../lib/router';
import { money } from '../lib/format';
import type { CapturaResultado, RelatorioCliques } from '../lib/types';
import type { Capturado } from '../lib/capturar';
import { lerTexto, pegarCompartilhado } from '../lib/compartilhado';
import { Alert, Button, Segmented } from '../components/ui';
import { Icon } from '../components/icons';
import { BarChart } from '../components/charts';
import { CapturaDrawer } from '../components/Captura';

/**
 * App do celular para o dono: ver como a loja está indo e subir produto compartilhando o link direto do app da loja.
 * Instalável (Adicionar à tela inicial). No Android, aparece na lista de "Compartilhar" do Mercado Livre e da Shein.
 */
export function Celular() {
  const { query } = useRoute();
  const { usuario, sair } = useAuth();
  const aba = query.get('aba') === 'adicionar' ? 'adicionar' : 'resumo';
  const ir = (a: string) => navigate(a === 'resumo' ? '/celular' : `/celular?aba=${a}`);

  // Chegou algo pelo "Compartilhar"? Vai direto para adicionar.
  const [compartilhado] = useState(() => pegarCompartilhado());
  useEffect(() => { if (compartilhado && aba !== 'adicionar') ir('adicionar'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cel">
      <header className="cel-top">
        <div>
          <div className="cel-marca">Vetrina</div>
          <div className="cel-sub">Olá, {usuario?.nome?.split(' ')[0] ?? 'dono'}</div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <a className="btn btn-ghost btn-sm" href="/loja" target="_blank" rel="noopener noreferrer" aria-label="Abrir a loja"><Icon name="store" size={18} /></a>
          <a className="btn btn-ghost btn-sm" href="#/afiliados" aria-label="Painel completo"><Icon name="dashboard" size={18} /></a>
          <button className="btn btn-ghost btn-sm" onClick={sair} aria-label="Sair"><Icon name="logout" size={18} /></button>
        </div>
      </header>

      <main className="cel-main">
        {aba === 'resumo' ? <Resumo onAdicionar={() => ir('adicionar')} /> : <Adicionar inicial={compartilhado} />}
      </main>

      <nav className="cel-tabs" aria-label="Seções">
        <button className={aba === 'resumo' ? 'on' : ''} onClick={() => ir('resumo')}><Icon name="chart" size={22} /><span>Resumo</span></button>
        <button className={aba === 'adicionar' ? 'on' : ''} onClick={() => ir('adicionar')}><Icon name="plus" size={22} /><span>Adicionar</span></button>
      </nav>
    </div>
  );
}

/* ============================== resumo ============================== */
const fmtDia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const hojeIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function Resumo({ onAdicionar }: { onAdicionar: () => void }) {
  const [dias, setDias] = useState('7');
  const rel = useAsync(() => api.get<RelatorioCliques>('/relatorios/cliques', { dias }), [dias]);
  const cat = useAsync(() => fetch('/api/catalogo').then((r) => r.json() as Promise<{ produtos: { id: number }[] }>), []);
  const r = rel.data;
  const hoje = r?.porDia.find((d) => d.dia === hojeIso())?.cliques ?? 0;
  const ontem = r?.porDia.at(-2)?.cliques ?? 0;

  return (
    <div className="cel-stack">
      <div className="cel-kpis">
        <div className="cel-kpi destaque">
          <span>Cliques hoje</span>
          <strong>{r ? hoje : '—'}</strong>
          {r && <small>{ontem ? `ontem: ${ontem}` : 'cada clique é alguém indo comprar'}</small>}
        </div>
        <div className="cel-kpi"><span>Cliques em {dias} dias</span><strong>{r ? r.total : '—'}</strong></div>
        <div className="cel-kpi"><span>Produtos na loja</span><strong>{cat.data ? cat.data.produtos.length : '—'}</strong></div>
        <div className="cel-kpi"><span>Pedidos de aviso</span><strong>{r ? r.avisosAtivos : '—'}</strong></div>
      </div>

      {rel.error && <Alert>{rel.error}</Alert>}

      <section className="cel-card">
        <div className="cel-card-head">
          <h2>Cliques por dia</h2>
          <Segmented value={dias} onChange={setDias} options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }]} label="Período" />
        </div>
        {r ? <BarChart data={r.porDia.map((d) => ({ label: dias === '7' ? fmtDia(d.dia) : d.dia.slice(8), value: d.cliques }))} height={150}
          format={(v) => `${v} ${v === 1 ? 'clique' : 'cliques'}`} emptyText="Nenhum clique no período ainda." /> : <div className="cel-esqueleto" style={{ height: 150 }} />}
      </section>

      <section className="cel-card">
        <h2>Mais clicados</h2>
        {!r ? <div className="cel-esqueleto" /> : r.topProdutos.length === 0 ? <p className="muted">Ainda sem cliques. Divulgue um link da loja no WhatsApp!</p> : (
          <ol className="cel-lista">
            {r.topProdutos.slice(0, 8).map((p) => (
              <li key={p.produtoId}>
                <a href={`/loja/p/${p.produtoId}`} target="_blank" rel="noopener noreferrer">
                  <span className="nome">{p.nome}</span>
                  <span className="muted">{p.categoria}{p.avisos ? ` · ${p.avisos} ${p.avisos === 1 ? 'aviso' : 'avisos'}` : ''}</span>
                </a>
                <strong>{p.cliques}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      {r && r.porParceiro.length > 0 && (
        <section className="cel-card">
          <h2>Por loja</h2>
          <ul className="cel-barras">
            {r.porParceiro.map((p) => (
              <li key={p.parceiroId}>
                <span>{p.nome}</span>
                <div className="meter"><span style={{ width: `${(p.cliques / Math.max(1, r.total)) * 100}%` }} /></div>
                <strong>{p.cliques}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.porCategoria.length > 0 && (
        <section className="cel-card">
          <h2>Por categoria</h2>
          <ul className="cel-barras">
            {r.porCategoria.slice(0, 8).map((c) => (
              <li key={c.nome}>
                <span>{c.nome}</span>
                <div className="meter"><span style={{ width: `${(c.cliques / Math.max(1, ...r.porCategoria.map((x) => x.cliques))) * 100}%` }} /></div>
                <strong>{c.cliques}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.parados.length > 0 && (
        <section className="cel-card">
          <h2>Sem nenhum clique em {dias} dias</h2>
          <p className="muted" style={{ margin: '0 0 8px' }}>Vale divulgar, trocar a foto ou conferir o preço.</p>
          <ul className="cel-lista simples">
            {r.parados.slice(0, 6).map((p) => (
              <li key={p.produtoId}><span className="nome">{p.nome}</span><span className="muted">{money(p.preco)}</span></li>
            ))}
          </ul>
          {r.parados.length > 6 && <p className="muted" style={{ marginTop: 8 }}>e mais {r.parados.length - 6}.</p>}
        </section>
      )}

      <Button variant="primary" icon="plus" onClick={onAdicionar}>Adicionar produto</Button>
      <Instalar />
    </div>
  );
}

/* ============================== adicionar ============================== */
type Enviado = { id: number; nome: string; preco: number; novo: boolean; quando: number };
const CHAVE_ENVIADOS = 'vetrina.enviados';
const lerEnviados = (): Enviado[] => { try { return JSON.parse(localStorage.getItem(CHAVE_ENVIADOS) || '[]'); } catch { return []; } };

interface Lido {
  loja: string | null; nome: string | null; preco: number | null; precoAnterior: number | null; freteGratis: boolean | null;
  nota: number | null; imagem: string | null; urlProduto: string | null; codigo: string | null; detalhes: string | null; link: string; avisos: string[];
}

function Adicionar({ inicial }: { inicial: string | null }) {
  const [texto, setTexto] = useState(inicial ?? '');
  const [captura, setCaptura] = useState<Capturado | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [enviados, setEnviados] = useState<Enviado[]>(lerEnviados);
  const ler = useAction();
  const disparou = useRef(false);
  const podeColar = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

  const processar = async (t: string) => {
    const tx = lerTexto(t);
    if (!tx.link) { ler.setError('Não achei um link nessa mensagem. Cole o link do produto.'); return; }
    const l = await ler.run(() => api.post<Lido>('/integracoes/captura/ler', { link: tx.link }));
    if (!l) return;
    if (!l.loja) { setAvisos(l.avisos); setCaptura(null); return; }
    // O que a página trouxe vale mais; a mensagem completa o que faltou (a Shein manda o preço no texto).
    const preco = l.preco ?? tx.preco ?? 0;
    const anterior = l.precoAnterior ?? (tx.desconto && preco ? Math.round((preco / (1 - tx.desconto / 100)) * 100) / 100 : null);
    setAvisos(l.avisos.filter((a) => !(tx.preco && /preço/i.test(a)) && !(tx.nome && /nome/i.test(a))));
    setCaptura({
      loja: l.loja, nome: l.nome ?? tx.nome ?? '', preco, precoAnterior: anterior, freteGratis: l.freteGratis ?? undefined,
      nota: l.nota, imagem: l.imagem ?? undefined, urlProduto: l.urlProduto && !l.urlProduto.includes('/social/') ? l.urlProduto : tx.link, codigo: l.codigo,
      detalhes: l.detalhes ?? undefined, link: tx.link,
    });
  };

  useEffect(() => {
    if (inicial && !disparou.current) { disparou.current = true; void processar(inicial); }
  }, [inicial]); // eslint-disable-line react-hooks/exhaustive-deps

  const colar = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { setTexto(t); void processar(t); }
    } catch { /* o usuário negou: cola à mão */ }
  };

  const salvo = (r: CapturaResultado) => {
    const lista = [{ id: r.produtoId, nome: r.nome, preco: Number(r.preco), novo: r.novo, quando: Date.now() }, ...enviados.filter((e) => e.id !== r.produtoId)].slice(0, 20);
    setEnviados(lista);
    try { localStorage.setItem(CHAVE_ENVIADOS, JSON.stringify(lista)); } catch { /* sem espaço */ }
    setTexto('');
  };

  return (
    <div className="cel-stack">
      <section className="cel-card">
        <h2>Adicionar produto</h2>
        <p className="muted" style={{ margin: '0 0 12px' }}>Cole o link (meli.la, Shein…) ou a mensagem inteira que o app da loja gera. Nome, preço e foto vêm sozinhos.</p>
        <textarea className="input cel-texto" rows={4} value={texto} placeholder="https://meli.la/…"
          onChange={(e) => setTexto(e.target.value)} />
        <div className="cel-botoes">
          {podeColar && <Button icon="clipboard" onClick={colar}>Colar</Button>}
          <Button variant="primary" icon="check" loading={ler.busy} disabled={!texto.trim()} onClick={() => void processar(texto)}>Ler produto</Button>
        </div>
        {ler.error && <div style={{ marginTop: 12 }}><Alert>{ler.error}</Alert></div>}
        {!captura && avisos.length > 0 && <div style={{ marginTop: 12 }}><Alert tone="warning">{avisos.join(' ')}</Alert></div>}
      </section>

      <section className="cel-card dica">
        <h2>Mais rápido: compartilhe direto</h2>
        <ol className="cel-passos">
          <li>Instale este app no celular (botão abaixo ou menu do navegador → <strong>Adicionar à tela inicial</strong>).</li>
          <li>No app do Mercado Livre ou da Shein, toque em <strong>Compartilhar</strong> no produto e escolha <strong>Vetrina Gestão</strong>.</li>
          <li>Confira, escolha a categoria e publique.</li>
        </ol>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>No iPhone o atalho de compartilhar não existe: copie o link e toque em Colar.</p>
      </section>

      {enviados.length > 0 && (
        <section className="cel-card">
          <h2>Enviados por aqui</h2>
          <ul className="cel-lista simples">
            {enviados.map((e) => (
              <li key={e.id}>
                <a href={`/loja/p/${e.id}`} target="_blank" rel="noopener noreferrer"><span className="nome">{e.nome}</span></a>
                <span className="muted">{money(e.preco)}{e.novo ? ' · novo' : ' · preço atualizado'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Instalar />

      <CapturaDrawer captura={captura} avisos={avisos} onClose={() => setCaptura(null)} onSaved={salvo} />
    </div>
  );
}

/* ============================== instalar ============================== */
type PedidoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let pedidoGuardado: PedidoInstalar | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoGuardado = e as PedidoInstalar; });
}

function Instalar() {
  const [pedido, setPedido] = useState<PedidoInstalar | null>(pedidoGuardado);
  const instalado = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); pedidoGuardado = e as PedidoInstalar; setPedido(pedidoGuardado); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (instalado) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (pedido) {
    return <Button icon="download" onClick={async () => { await pedido.prompt(); pedidoGuardado = null; setPedido(null); }}>Instalar o app no celular</Button>;
  }
  return (
    <p className="muted cel-instalar">
      {ios ? <>Para instalar: no Safari, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>.</>
        : <>Para instalar: no menu do Chrome (⋮), toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</>}
    </p>
  );
}
