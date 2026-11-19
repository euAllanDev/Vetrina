import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Icon } from '../components/icons';
import { money, onlyDigits } from '../lib/format';
import { Home } from './Home';
import { Lista } from './Lista';
import { Pdp } from './Pdp';
import {
  Foto, Preco, Seta, ehAfiliado, emOferta, inicial, lerRota, limiteDe, reduzMovimento, transicao, urlDe,
  type Catalogo, type Loja, type Produto, type Rota,
} from './shared';
import './store.css';

type Sacola = Record<number, number>;
type Forma = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO';

const FORMAS: { value: Forma; label: string }[] = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
];

/* ============================== sacola (estado) ============================== */
function useSacola(): [Sacola, (id: number, delta: number, max?: number) => void, (id: number) => void, () => void] {
  const [sacola, setSacola] = useState<Sacola>(() => {
    try { return JSON.parse(localStorage.getItem('loja.sacola') || '{}'); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem('loja.sacola', JSON.stringify(sacola)); } catch { /* sem storage */ } }, [sacola]);
  const mudar = useCallback((id: number, delta: number, max = 99) => setSacola((s) => {
    const q = Math.max(0, Math.min(max, (s[id] ?? 0) + delta));
    const n = { ...s };
    if (q === 0) delete n[id]; else n[id] = q;
    return n;
  }), []);
  const remover = useCallback((id: number) => setSacola((s) => { const n = { ...s }; delete n[id]; return n; }), []);
  const limpar = useCallback(() => setSacola({}), []);
  return [sacola, mudar, remover, limpar];
}

/** Miniatura que "voa" da foto até o ícone da sacola. */
function voarParaSacola(origem: Element | null, destino: Element | null, imagem: string | null) {
  if (!origem || !destino || reduzMovimento()) return Promise.resolve();
  const a = origem.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 's-fly';
  if (imagem) { const img = document.createElement('img'); img.src = imagem; img.alt = ''; el.appendChild(img); }
  const w = 64, h = 80;
  const x0 = a.left + a.width / 2 - w / 2, y0 = a.top + Math.min(a.height, window.innerHeight) / 2 - h / 2;
  const x1 = b.left + b.width / 2 - w / 2, y1 = b.top + b.height / 2 - h / 2;
  el.style.left = `${x0}px`;
  el.style.top = `${y0}px`;
  document.body.appendChild(el);
  const dx = x1 - x0, dy = y1 - y0;
  const anim = el.animate([
    { transform: 'translate(0,0) scale(1.5) rotate(0deg)', opacity: 0, offset: 0 },
    { transform: 'translate(0,-12px) scale(1.25) rotate(-5deg)', opacity: 1, offset: 0.12 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 160}px) scale(0.9) rotate(7deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(0deg)`, opacity: 0.2, offset: 1 },
  ], { duration: 860, easing: 'cubic-bezier(0.5, 0, 0.2, 1)' });
  return anim.finished.then(() => el.remove(), () => el.remove());
}

const AVISOS = (loja: Loja | undefined, comparador = false) => comparador ? [
  'Compare preços entre lojas parceiras',
  'Você compra direto na loja, sem custo extra',
  'Histórico de preço em cada produto',
] : [
  'Peça sem pagar agora · confirmamos por telefone',
  'Pague com Pix, cartão ou dinheiro',
  loja?.cidade ? `Atendimento a partir de ${loja.cidade}${loja.uf ? `/${loja.uf}` : ''}` : 'Sua sacola fica salva neste aparelho',
];

/* ============================== app da loja ============================== */
export function Store() {
  const [dados, setDados] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rota, setRota] = useState<Rota>(lerRota);
  const [sacolaAberta, setSacolaAberta] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [sacola, mudar, remover, limpar] = useSacola();
  const [toast, setToast] = useState<{ id: number; p: Produto; q: number } | { id: number; texto: string } | null>(null);
  const [bump, setBump] = useState(0);
  const bagRef = useRef<HTMLButtonElement>(null);

  // O servidor gratuito dorme quando fica sem acesso e leva alguns minutos para acordar.
  // Em vez de mostrar erro, tenta de novo sozinho por até ~5 minutos.
  const [acordando, setAcordando] = useState(false);
  const carregar = useCallback(() => {
    let vivo = true;
    let tentativa = 0;
    const inicio = Date.now();
    setErro(null);
    const tentar = () => {
      const ctl = new AbortController();
      const limite = window.setTimeout(() => ctl.abort(), 25000);
      fetch('/api/catalogo', { signal: ctl.signal })
        .then((r) => { if (!r.ok) throw new Error(`Erro ${r.status}`); return r.json(); })
        .then((d: Catalogo) => { if (vivo) { setDados(d); setAcordando(false); } })
        .catch(() => {
          if (!vivo) return;
          tentativa++;
          if (Date.now() - inicio < 5 * 60_000) {
            if (tentativa >= 1) setAcordando(true);
            window.setTimeout(tentar, 4000);
          } else {
            setAcordando(false);
            setErro('Não foi possível carregar a vitrine agora.');
          }
        })
        .finally(() => window.clearTimeout(limite));
    };
    tentar();
    return () => { vivo = false; };
  }, []);
  useEffect(carregar, [carregar]);

  // Navegação: URL é a fonte da verdade; voltar/avançar do navegador funcionam.
  useEffect(() => {
    const on = () => transicao(() => setRota(lerRota()));
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  const ir = useCallback((r: Rota) => {
    const url = urlDe(r);
    if (url !== window.location.pathname + window.location.search) window.history.pushState(null, '', url);
    setMenuAberto(false);
    transicao(() => setRota(r));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const abrir = useCallback((p: Produto, foto: HTMLElement | null) => {
    document.querySelectorAll<HTMLElement>('[style*="foto-sel"]').forEach((el) => { if (el !== foto) el.style.viewTransitionName = ''; });
    if (foto) foto.style.viewTransitionName = 'foto-sel';
    window.history.pushState(null, '', urlDe({ p: p.id }));
    transicao(() => { if (foto) foto.style.viewTransitionName = ''; setRota({ p: p.id }); });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const produto = dados && rota.p ? dados.produtos.find((p) => p.id === rota.p) : undefined;

  useEffect(() => {
    const nome = dados?.loja.nome ?? 'Loja';
    const cat = dados?.categorias.find((c) => c.id === rota.c);
    const lj = dados?.parceiros?.find((x) => x.id === rota.l);
    document.title = produto ? `${produto.nome} — ${nome}` : lj ? `${lj.nome} — ${nome}` : cat ? `${cat.nome} — ${nome}` : rota.q ? `Busca: ${rota.q} — ${nome}` : nome;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
  }, [dados, rota, produto]);

  // Trava a rolagem do fundo com sacola ou menu abertos; Esc fecha.
  useEffect(() => {
    if (!sacolaAberta && !menuAberto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSacolaAberta(false); setMenuAberto(false); } };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [sacolaAberta, menuAberto]);

  const qtdSacola = Object.values(sacola).reduce((s, q) => s + q, 0);

  const adicionar = async (p: Produto, origem: Element | null, quantidade = 1) => {
    if (ehAfiliado(p)) { abrir(p, null); return; }
    const atual = sacola[p.id] ?? 0;
    if (atual + quantidade > limiteDe(p)) {
      setToast({ id: Date.now(), texto: `Só temos ${limiteDe(p)} ${limiteDe(p) === 1 ? 'unidade' : 'unidades'} de ${p.nome}.` });
      return;
    }
    const voo = voarParaSacola(origem, bagRef.current, p.imagemUrl);
    mudar(p.id, quantidade, limiteDe(p));
    await voo;
    setBump((b) => b + 1);
    setToast({ id: Date.now(), p, q: quantidade });
  };

  const view = !dados ? null
    : rota.p ? (produto
      ? <Pdp key={produto.id} p={produto} dados={dados} naSacola={sacola[produto.id] ?? 0} ir={ir} onAbrir={abrir} onAdicionar={adicionar} />
      : <div className="s-vazio"><span className="s-display sm">Produto indisponível</span><p>Este produto não está mais na vitrine.</p><button className="s-btn" onClick={() => ir({})}>Voltar à loja</button></div>)
    : (rota.c || rota.q || rota.v || rota.l) ? <Lista dados={dados} rota={rota} ir={ir} onAbrir={abrir} onAdicionar={adicionar} />
    : <Home dados={dados} ir={ir} onAbrir={abrir} onAdicionar={adicionar} />;

  return (
    <div className="s-root">
      <a className="s-skip" href="#s-main">Pular para o conteúdo</a>
      <Avisos itens={AVISOS(dados?.loja, !!dados?.produtos.some(ehAfiliado))} />
      <Cabecalho dados={dados} rota={rota} ir={ir} abrir={abrir} qtd={qtdSacola} bump={bump} bagRef={bagRef}
        onSacola={() => { setToast(null); setSacolaAberta(true); }} onMenu={() => setMenuAberto(true)} />

      <main id="s-main" className="s-main">
        {erro ? (
          <div className="s-vazio"><span className="s-display sm">Vitrine indisponível</span><p>{erro}</p><button className="s-btn" onClick={() => carregar()}>Tentar de novo</button></div>
        ) : !dados ? (acordando ? <Acordando nome={'a loja'} /> : <Carregando />) : view}
      </main>

      {dados && <Rodape dados={dados} ir={ir} />}

      {menuAberto && dados && <MenuMobile dados={dados} ir={ir} onFechar={() => setMenuAberto(false)} />}

      {sacolaAberta && dados && (
        <SacolaPainel produtos={dados.produtos} sacola={sacola} mudar={mudar} remover={remover} limpar={limpar}
          onFechar={() => setSacolaAberta(false)} />
      )}

      {toast && (
        <div key={toast.id} className="s-toast" role="status" onAnimationEnd={(e) => { if (e.animationName === 's-toast-out') setToast(null); }}>
          {'p' in toast ? (
            <>
              <div className="s-toast-img">{toast.p.imagemUrl ? <img src={toast.p.imagemUrl} alt="" /> : <span>{inicial(toast.p.nome)}</span>}</div>
              <div className="s-toast-txt">
                <span className="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>Adicionado à sacola</span>
                <strong>{toast.p.nome}</strong>
                <span>{toast.q > 1 ? `${toast.q} × ` : ''}{money(toast.p.preco)}</span>
              </div>
              <button className="s-btn sm" onClick={() => { setToast(null); setSacolaAberta(true); }}>Ver sacola</button>
            </>
          ) : <span className="s-toast-txt"><strong>{toast.texto}</strong></span>}
        </div>
      )}
    </div>
  );
}

/* ============================== barra de avisos ============================== */
function Avisos({ itens }: { itens: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduzMovimento()) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % itens.length), 4500);
    return () => window.clearInterval(t);
  }, [itens.length]);
  return (
    <div className="s-avisos" role="region" aria-label="Avisos">
      {itens.map((t, n) => <span key={n} className={n === i ? 'on' : ''} aria-hidden={n !== i}>{t}</span>)}
    </div>
  );
}

/* ============================== cabeçalho ============================== */
const MAIS = -2;
function Cabecalho({ dados, rota, ir, abrir, qtd, bump, bagRef, onSacola, onMenu }: {
  dados: Catalogo | null; rota: Rota; ir: (r: Rota) => void; abrir: (p: Produto, el: HTMLElement | null) => void;
  qtd: number; bump: number; bagRef: RefObject<HTMLButtonElement | null>; onSacola: () => void; onMenu: () => void;
}) {
  const [oculto, setOculto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [mega, setMega] = useState<number | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    let ultimo = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      setRolou(y > 4);
      if (Math.abs(y - ultimo) > 6) { setOculto(y > ultimo && y > 160); ultimo = y; }
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (oculto) setMega(null);
    document.documentElement.style.setProperty('--s-head-off', oculto ? '0px' : '64px');
  }, [oculto]);

  const entrar = (id: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMega(id), mega === null ? 140 : 0); };
  const sair = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMega(null), 160); };

  const temOfertas = dados?.produtos.some((p) => emOferta(p) && p.disponivel);
  const temNovos = dados?.produtos.some((p) => p.novo);

  // Menu "prioridade +": mostra os itens que cabem e joga o resto em "Mais".
  type ItemNav = { k: string; t: string; r: Rota; mega: number; atual: boolean; sale?: boolean };
  const itens: ItemNav[] = [
    ...(temNovos ? [{ k: 'nov', t: 'Novidades', r: { v: 'novidades' as const }, mega: -1, atual: rota.v === 'novidades' }] : []),
    ...(dados?.categorias ?? []).map((c) => ({ k: `c${c.id}`, t: c.nome, r: { c: c.id }, mega: c.id, atual: rota.c === c.id })),
  ];
  const ofertas: ItemNav | null = temOfertas ? { k: 'of', t: 'Ofertas', r: { v: 'ofertas' }, mega: -1, atual: rota.v === 'ofertas', sale: true } : null;
  const navRef = useRef<HTMLElement>(null);
  const reguaRef = useRef<HTMLDivElement>(null);
  const [cabem, setCabem] = useState(99);
  const chaveItens = itens.map((x) => x.t).join('|');
  useEffect(() => {
    const nav = navRef.current, regua = reguaRef.current;
    if (!nav || !regua) return;
    const medir = () => {
      const w = [...regua.children].map((el) => (el as HTMLElement).offsetWidth);
      const n = itens.length;
      const wMais = w[n] ?? 80;
      const wOf = ofertas ? (w[n + 1] ?? 0) : 0;
      const livre = nav.clientWidth - 8;
      let total = wOf, c = 0;
      for (let i = 0; i < n; i++) {
        const resto = i < n - 1 ? wMais : 0;
        if (total + w[i] + resto <= livre) { total += w[i]; c++; } else break;
      }
      setCabem(c);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(nav);
    document.fonts?.ready.then(medir).catch(() => {});
    return () => ro.disconnect();
  }, [chaveItens, !!ofertas]); // eslint-disable-line react-hooks/exhaustive-deps
  const visiveis = itens.slice(0, cabem);
  const sobra = itens.slice(cabem);
  const catMega = dados?.categorias.find((c) => c.id === mega);
  const prodMega = catMega ? dados!.produtos.filter((p) => p.categoriaId === catMega.id && p.imagemUrl)
    .sort((a, b) => Number(b.maisVendido) - Number(a.maisVendido) || Number(b.novo) - Number(a.novo)).slice(0, 4) : [];

  return (
    <header className={`s-head ${oculto ? 'oculto' : ''} ${rolou ? 'rolou' : ''}`} onMouseLeave={sair}>
      <div className="s-head-row">
        <button className="s-icon-btn s-only-mobile" aria-label="Abrir menu" onClick={onMenu}><Icon name="menu" size={22} /></button>
        <a className="s-brand" href="/loja" onClick={(e) => { e.preventDefault(); ir({}); }}>{dados?.loja.nome ?? ' '}</a>

        <nav className="s-nav" aria-label="Categorias" ref={navRef}>
          {visiveis.map((x) => (
            <a key={x.k} href={urlDe(x.r)} aria-current={x.atual ? 'page' : undefined}
              className={`${x.sale ? 'sale' : ''} ${mega === x.mega && x.mega > 0 ? 'hover' : ''}`}
              onMouseEnter={() => entrar(x.mega)} onFocus={() => setMega(null)}
              onClick={(e) => { e.preventDefault(); setMega(null); ir(x.r); }}>{x.t}</a>
          ))}
          {sobra.length > 0 && (
            <button type="button" className={`s-nav-mais ${mega === MAIS ? 'hover' : ''}`} aria-haspopup="true" aria-expanded={mega === MAIS}
              onMouseEnter={() => entrar(MAIS)} onClick={() => setMega((m) => (m === MAIS ? null : MAIS))}>
              Mais <Seta dir="down" size={14} />
            </button>
          )}
          {ofertas && (
            <a href={urlDe(ofertas.r)} className="sale" aria-current={ofertas.atual ? 'page' : undefined}
              onMouseEnter={() => entrar(-1)} onClick={(e) => { e.preventDefault(); setMega(null); ir(ofertas.r); }}>{ofertas.t}</a>
          )}
          {/* régua invisível: mede a largura de cada item para decidir quantos cabem */}
          <div className="s-nav-regua" aria-hidden="true" ref={reguaRef}>
            {itens.map((x) => <span key={x.k}>{x.t}</span>)}
            <span>Mais ⌄</span>
            {ofertas && <span>{ofertas.t}</span>}
          </div>
        </nav>

        <div className="s-head-tools">
          {dados && <Busca dados={dados} ir={ir} abrir={abrir} inicial={rota.q ?? ''} />}
          <button ref={bagRef} className="s-icon-btn s-bag-btn" aria-label={`Sacola, ${qtd} ${qtd === 1 ? 'item' : 'itens'}`} onClick={onSacola}>
            <Icon name="bag" size={22} />
            {qtd > 0 && <span key={bump} className={`s-count ${bump ? 'bump' : ''}`}>{qtd}</span>}
          </button>
        </div>
      </div>

      <div className={`s-mega ${catMega || mega === MAIS ? 'on' : ''}`} onMouseEnter={() => window.clearTimeout(timer.current)} aria-hidden={!catMega && mega !== MAIS}>
        {mega === MAIS && sobra.length > 0 && dados && (
          <div className="s-mega-in mais" key="mais">
            <div className="s-mega-side">
              <span className="s-slide-kicker dark">Mais categorias</span>
              <span className="s-display sm">Explore</span>
              <a className="s-link-strong" href={urlDe({ v: 'todos' })} tabIndex={-1}
                onClick={(e) => { e.preventDefault(); setMega(null); ir({ v: 'todos' }); }}>Todos os produtos <Seta size={16} /></a>
            </div>
            <div className="s-mega-grid">
              {sobra.map((x, n) => {
                const capa = dados.produtos.find((p) => p.imagemUrl && (x.mega > 0 ? p.categoriaId === x.mega : p.novo));
                return (
                  <a key={x.k} href={urlDe(x.r)} className="s-mega-item cat" style={{ ['--i' as string]: n }} tabIndex={-1}
                    onClick={(e) => { e.preventDefault(); setMega(null); ir(x.r); }}>
                    {capa ? <Foto p={capa} /> : <div className="s-foto vazia" />}
                    <span className="nome">{x.t}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
        {catMega && (
          <div className="s-mega-in" key={catMega.id}>
            <div className="s-mega-side">
              <span className="s-slide-kicker dark">{catMega.quantidade} {catMega.quantidade === 1 ? 'produto' : 'produtos'}</span>
              <span className="s-display sm">{catMega.nome}</span>
              <a className="s-link-strong" href={urlDe({ c: catMega.id })} tabIndex={-1}
                onClick={(e) => { e.preventDefault(); setMega(null); ir({ c: catMega.id }); }}>Ver tudo <Seta size={16} /></a>
            </div>
            <div className="s-mega-grid">
              {prodMega.map((p, n) => (
                <a key={p.id} href={urlDe({ p: p.id })} className="s-mega-item" style={{ ['--i' as string]: n }} tabIndex={-1}
                  onClick={(e) => { e.preventDefault(); setMega(null); abrir(p, null); }}>
                  <Foto p={p} />
                  <span className="nome">{p.nome}</span>
                  <Preco p={p} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* ============================== busca com sugestões ============================== */
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Busca({ dados, ir, abrir, inicial: ini }: { dados: Catalogo; ir: (r: Rota) => void; abrir: (p: Produto, el: HTMLElement | null) => void; inicial: string }) {
  const [t, setT] = useState(ini);
  const [foco, setFoco] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setT(ini), [ini]);

  const sugestoes = useMemo(() => {
    const q = semAcento(t.trim());
    if (q.length < 2) return [];
    const partes = q.split(/\s+/);
    return dados.produtos.filter((p) => { const a = semAcento(`${p.nome} ${p.categoriaNome ?? ''}`); return partes.every((x) => a.includes(x)); }).slice(0, 6);
  }, [t, dados]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (ativo >= 0 && sugestoes[ativo]) { abrir(sugestoes[ativo], null); fechar(); return; }
    if (!t.trim()) return;
    ir({ q: t.trim() });
    fechar();
  };
  const fechar = () => { setFoco(false); setAtivo(-1); input.current?.blur(); };
  const aberto = foco && t.trim().length >= 2;

  return (
    <form className={`s-busca ${foco ? 'foco' : ''}`} role="search" onSubmit={enviar}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFoco(false); }}>
      <button type="button" className="s-busca-ico" aria-label="Abrir busca" tabIndex={foco ? -1 : 0}
        onClick={() => { setFoco(true); window.setTimeout(() => input.current?.focus(), 30); }}>
        <Icon name="search" size={18} />
      </button>
      <input ref={input} value={t} placeholder="Buscar" aria-label="Buscar produtos" autoComplete="off"
        role="combobox" aria-expanded={aberto} aria-controls="s-sug" aria-activedescendant={ativo >= 0 ? `s-sug-${ativo}` : undefined}
        onFocus={() => setFoco(true)} onChange={(e) => { setT(e.target.value); setAtivo(-1); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(sugestoes.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(-1, a - 1)); }
          else if (e.key === 'Escape') fechar();
        }} />
      {t && <button type="button" className="s-busca-x" aria-label="Limpar busca" onClick={() => { setT(''); input.current?.focus(); }}><Icon name="x" size={16} /></button>}
      {aberto && (
        <div className="s-sug" id="s-sug" role="listbox">
          {sugestoes.length === 0 ? <div className="s-sug-vazio">Nenhum produto para “{t.trim()}”</div> : (
            <>
              {sugestoes.map((p, n) => (
                <button type="button" key={p.id} id={`s-sug-${n}`} role="option" aria-selected={n === ativo} className="s-sug-item"
                  onMouseDown={(e) => e.preventDefault()} onClick={() => { abrir(p, null); fechar(); }}>
                  <Foto p={p} />
                  <span><strong>{p.nome}</strong><small>{p.categoriaNome}</small></span>
                  <Preco p={p} />
                </button>
              ))}
              <button type="submit" className="s-sug-all" onMouseDown={(e) => e.preventDefault()}>Ver todos os resultados para “{t.trim()}” <Seta size={16} /></button>
            </>
          )}
        </div>
      )}
    </form>
  );
}

/* ============================== menu mobile ============================== */
function MenuMobile({ dados, ir, onFechar }: { dados: Catalogo; ir: (r: Rota) => void; onFechar: () => void }) {
  const itens: { t: string; r: Rota; k?: string }[] = [
    { t: 'Início', r: {} },
    ...(dados.produtos.some((p) => p.novo) ? [{ t: 'Novidades', r: { v: 'novidades' as const } }] : []),
    ...dados.categorias.map((c) => ({ t: c.nome, r: { c: c.id } })),
    ...(dados.produtos.some(emOferta) ? [{ t: 'Ofertas', r: { v: 'ofertas' as const }, k: 'sale' }] : []),
  ];
  return (
    <>
      <div className="s-scrim" onClick={onFechar} />
      <aside className="s-menu" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="s-menu-head">
          <span className="s-brand">{dados.loja.nome}</span>
          <button className="s-icon-btn" aria-label="Fechar menu" onClick={onFechar} autoFocus><Icon name="x" size={22} /></button>
        </div>
        <nav>
          {itens.map((x, n) => (
            <a key={x.t} href={urlDe(x.r)} className={x.k} style={{ ['--i' as string]: n }} onClick={(e) => { e.preventDefault(); ir(x.r); }}>
              {x.t}<Seta />
            </a>
          ))}
        </nav>
        <a className="s-menu-equipe" href="/">Área da equipe</a>
      </aside>
    </>
  );
}

/* ============================== servidor acordando ============================== */
function Acordando({ nome }: { nome: string }) {
  return (
    <div className="s-acordando" role="status" aria-live="polite">
      <div className="s-acordando-anel" aria-hidden="true"><span /><span /><span /></div>
      <span className="s-display sm">Abrindo as portas</span>
      <p>Estamos preparando {nome} para você. Isso pode levar até um minuto na primeira visita.</p>
    </div>
  );
}

/* ============================== carregando ============================== */
function Carregando() {
  return (
    <div className="s-carregando" aria-busy="true" aria-label="Carregando vitrine">
      <div className="s-skel hero" />
      <div className="s-skel-row">{Array.from({ length: 4 }).map((_, i) => <div key={i}><div className="s-skel card" /><div className="s-skel line" /><div className="s-skel line short" /></div>)}</div>
    </div>
  );
}

/* ============================== sacola + checkout ============================== */
type Etapa = 'sacola' | 'dados' | 'feito';

function SacolaPainel({ produtos, sacola, mudar, remover, limpar, onFechar }:
  { produtos: Produto[]; sacola: Sacola; mudar: (id: number, d: number, max?: number) => void; remover: (id: number) => void; limpar: () => void; onFechar: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>('sacola');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [forma, setForma] = useState<Forma>('PIX');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const [pedido, setPedido] = useState<{ pedido: number; total: number; mensagem: string } | null>(null);

  const linhas = Object.entries(sacola)
    .map(([id, q]) => ({ p: produtos.find((x) => x.id === Number(id)), q }))
    .filter((l): l is { p: Produto; q: number } => !!l.p);
  const total = linhas.reduce((s, l) => s + l.p.preco * l.q, 0);
  const economia = linhas.reduce((s, l) => s + (emOferta(l.p) ? (l.p.precoAnterior! - l.p.preco) * l.q : 0), 0);
  const itens = linhas.reduce((s, l) => s + l.q, 0);
  const telOk = onlyDigits(telefone).length >= 10;
  const nomeOk = nome.trim().length >= 2;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!nomeOk || !telOk) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch('/api/catalogo/pedidos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone, email: email || null, formaPagamento: forma, observacao: obs || null,
          itens: linhas.map((l) => ({ produtoId: l.p.id, quantidade: l.q })) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || 'Não foi possível enviar o pedido.');
      setPedido(j);
      limpar();
      setEtapa('feito');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="s-scrim" onClick={onFechar} />
      <aside className="s-bag" role="dialog" aria-modal="true" aria-label="Sacola">
        <div className="s-bag-head">
          <h2>{etapa === 'dados' ? 'Seus dados' : etapa === 'feito' ? 'Pedido enviado' : <>Sacola {itens > 0 && <small>{itens} {itens === 1 ? 'item' : 'itens'}</small>}</>}</h2>
          <button className="s-icon-btn" aria-label="Fechar" onClick={onFechar} autoFocus><Icon name="x" size={22} /></button>
        </div>
        {etapa !== 'feito' && linhas.length > 0 && (
          <ol className="s-etapas" aria-label="Etapas">
            <li className={etapa === 'sacola' ? 'on' : 'feito'}>Sacola</li>
            <li className={etapa === 'dados' ? 'on' : ''}>Dados</li>
            <li>Confirmação</li>
          </ol>
        )}

        {etapa === 'feito' && pedido ? (
          <div className="s-done">
            <svg className="s-check" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="40" /><path d="M27 43 l10 10 l20 -22" /></svg>
            <h3 className="s-display sm">Obrigado, {nome.trim().split(' ')[0]}</h3>
            <p>Pedido nº <strong className="s-num">{pedido.pedido}</strong> · {money(pedido.total)}</p>
            <p style={{ maxWidth: '34ch' }}>{pedido.mensagem}</p>
            <button className="s-btn" style={{ marginTop: 18 }} onClick={onFechar}>Continuar comprando</button>
          </div>
        ) : linhas.length === 0 ? (
          <div className="s-done">
            <Icon name="bag" size={44} />
            <h3 className="s-display sm">Sua sacola está vazia</h3>
            <p>Escolha um produto na vitrine para começar.</p>
            <button className="s-btn" style={{ marginTop: 12 }} onClick={onFechar}>Ver produtos</button>
          </div>
        ) : etapa === 'sacola' ? (
          <>
            <div className="s-bag-body">
              {linhas.map(({ p, q }, i) => (
                <div key={p.id} className="s-line" style={{ animationDelay: `${i * 60}ms` }}>
                  <Foto p={p} />
                  <div>
                    <div className="s-line-name">{p.nome}</div>
                    <div className="s-line-sub">{p.categoriaNome}</div>
                    <Preco p={p} />
                    <div className="s-qty sm">
                      <button aria-label="Diminuir" onClick={() => mudar(p.id, -1)}>−</button>
                      <span className="s-num">{q}</span>
                      <button aria-label="Aumentar" disabled={q >= limiteDe(p)} onClick={() => mudar(p.id, 1, limiteDe(p))}>+</button>
                    </div>
                  </div>
                  <div className="s-line-right">
                    <span className="s-num strong">{money(p.preco * q)}</span>
                    <button className="s-link" onClick={() => remover(p.id)}>Remover</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="s-bag-foot">
              <div className="s-resumo">
                <span>Subtotal</span><span className="s-num">{money(total + economia)}</span>
                {economia > 0 && <><span className="sale">Descontos</span><span className="s-num sale">− {money(economia)}</span></>}
                <strong>Total</strong><strong className="s-num">{money(total)}</strong>
              </div>
              <button className="s-btn block xl" onClick={() => setEtapa('dados')}>Finalizar pedido</button>
              <p className="s-note">Você não paga agora: a loja confirma o pedido com você pelo telefone.</p>
            </div>
          </>
        ) : (
          <form onSubmit={enviar} noValidate style={{ display: 'contents' }}>
            <div className="s-bag-body">
              <div className="s-form">
                {erro && <div className="s-alert" role="alert">{erro}</div>}
                <div className="s-field">
                  <label htmlFor="s-nome">Nome</label>
                  <input id="s-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={tentou && !nomeOk} autoFocus />
                  {tentou && !nomeOk && <span className="s-err">Informe seu nome.</span>}
                </div>
                <div className="s-field">
                  <label htmlFor="s-tel">Telefone / WhatsApp</label>
                  <input id="s-tel" type="tel" autoComplete="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} aria-invalid={tentou && !telOk} placeholder="(11) 90000-0000" />
                  {tentou && !telOk && <span className="s-err">Informe um telefone com DDD.</span>}
                </div>
                <div className="s-field">
                  <label htmlFor="s-email">E-mail (opcional)</label>
                  <input id="s-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="s-field">
                  <label>Como prefere pagar</label>
                  <div className="s-pills" role="group" aria-label="Forma de pagamento">
                    {FORMAS.map((f) => <button type="button" key={f.value} className="s-pill" aria-pressed={forma === f.value} onClick={() => setForma(f.value)}>{f.label}</button>)}
                  </div>
                </div>
                <div className="s-field">
                  <label htmlFor="s-obs">Observação (opcional)</label>
                  <textarea id="s-obs" value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: prefiro retirar na loja" />
                </div>
              </div>
            </div>
            <div className="s-bag-foot">
              <div className="s-resumo"><strong>{itens} {itens === 1 ? 'item' : 'itens'}</strong><strong className="s-num">{money(total)}</strong></div>
              <button className="s-btn block xl" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
              <button type="button" className="s-link" style={{ justifySelf: 'center' }} onClick={() => setEtapa('sacola')}>Voltar para a sacola</button>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}

/* ============================== rodapé ============================== */
function Rodape({ dados, ir }: { dados: Catalogo; ir: (r: Rota) => void }) {
  const { loja, categorias } = dados;
  const comparador = dados.produtos.some(ehAfiliado);
  const fone = loja.telefone ? onlyDigits(loja.telefone) : '';
  const foneFmt = fone.length === 11 ? `(${fone.slice(0, 2)}) ${fone.slice(2, 7)}-${fone.slice(7)}` : fone.length === 10 ? `(${fone.slice(0, 2)}) ${fone.slice(2, 6)}-${fone.slice(6)}` : loja.telefone;
  return (
    <footer className="s-foot">
      <div className="s-foot-top">
        <div className="s-foot-brand">
          <span className="s-display">{loja.nome}</span>
          <p>{comparador ? 'Compare preços entre lojas parceiras e compre onde sair mais barato.' : 'Escolha online, receba a confirmação pelo telefone e pague como preferir.'}</p>
        </div>
        <div>
          <h4>Comprar</h4>
          <a href={urlDe({ v: 'todos' })} onClick={(e) => { e.preventDefault(); ir({ v: 'todos' }); }}>Todos os produtos</a>
          {categorias.map((c) => <a key={c.id} href={urlDe({ c: c.id })} onClick={(e) => { e.preventDefault(); ir({ c: c.id }); }}>{c.nome}</a>)}
        </div>
        <div>
          <h4>Como funciona</h4>
          {comparador ? (
            <>
              <p>1. Compare preços entre as lojas</p>
              <p>2. Escolha a melhor oferta</p>
              <p>3. Compre direto no site da loja</p>
            </>
          ) : (
            <>
              <p>1. Monte sua sacola</p>
              <p>2. Envie o pedido sem pagar agora</p>
              <p>3. A loja confirma com você</p>
              <p>Pix, cartão ou dinheiro</p>
            </>
          )}
        </div>
        <div>
          <h4>Atendimento</h4>
          {loja.telefone && <a href={`tel:+55${fone}`}>{foneFmt}</a>}
          {loja.email && <a href={`mailto:${loja.email}`}>{loja.email}</a>}
          {loja.cidade && <p>{loja.cidade}{loja.uf ? `/${loja.uf}` : ''}</p>}
        </div>
      </div>
      {(dados.parceiros?.length ?? 0) > 0 && (
        <p className="s-aviso-afiliado">Alguns produtos são vendidos por lojas parceiras. Quando você compra por um link "Ver na loja", podemos receber uma comissão, sem custo extra para você. Preços e disponibilidade são definidos pelas lojas e podem mudar.</p>
      )}
      <div className="s-foot-bottom">
        <span>© {new Date().getFullYear()} {loja.razaoSocial ?? loja.nome}</span>
        <a href="/">Área da equipe</a>
      </div>
    </footer>
  );
}
