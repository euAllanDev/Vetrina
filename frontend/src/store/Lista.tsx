import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '../lib/format';
import { Card, MarcaLoja, ehAfiliado, emOferta, freteGratis, transicao, urlDe, type Abrir, type Adicionar, type Catalogo, type Rota } from './shared';

type Ordem = 'relevancia' | 'menor' | 'maior' | 'az' | 'desconto';
const ORDENS: { v: Ordem; t: string }[] = [
  { v: 'relevancia', t: 'Relevância' },
  { v: 'menor', t: 'Menor preço' },
  { v: 'maior', t: 'Maior preço' },
  { v: 'desconto', t: 'Maior desconto' },
  { v: 'az', t: 'Nome (A–Z)' },
];
const FAIXAS = [
  { id: 'a', t: 'Até R$ 100', min: 0, max: 100 },
  { id: 'b', t: 'R$ 100 a R$ 250', min: 100, max: 250 },
  { id: 'c', t: 'R$ 250 a R$ 400', min: 250, max: 400 },
  { id: 'd', t: 'Acima de R$ 400', min: 400, max: Infinity },
];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props { dados: Catalogo; rota: Rota; ir: (r: Rota) => void; onAbrir: Abrir; onAdicionar: Adicionar }

export function Lista({ dados, rota, ir, onAbrir, onAdicionar }: Props) {
  const [ordem, setOrdem] = useState<Ordem>('relevancia');
  const [soOferta, setSoOferta] = useState(rota.v === 'ofertas');
  const [soDisp, setSoDisp] = useState(false);
  const [faixa, setFaixa] = useState<string | null>(null);
  const [soFrete, setSoFrete] = useState(false);
  const [lojasSel, setLojasSel] = useState<number[]>([]);
  const [preso, setPreso] = useState(false);
  const sentinela = useRef<HTMLDivElement>(null);

  // Ao trocar de página da loja, recomeça os filtros.
  useEffect(() => { setSoOferta(rota.v === 'ofertas'); setFaixa(null); setSoDisp(false); setSoFrete(false); setLojasSel([]); setOrdem('relevancia'); }, [rota.c, rota.q, rota.v, rota.l]);

  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPreso(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cat = dados.categorias.find((c) => c.id === rota.c);
  const lojaRota = dados.parceiros?.find((x) => x.id === rota.l);
  const termo = rota.q?.trim() ?? '';

  const base = useMemo(() => {
    let l = dados.produtos;
    if (cat) l = l.filter((p) => p.categoriaId === cat.id);
    if (lojaRota) l = l.filter((p) => p.ofertas?.some((o) => o.parceiroId === lojaRota.id));
    if (rota.v === 'novidades') l = l.filter((p) => p.novo);
    if (termo) {
      const t = semAcento(termo).split(/\s+/);
      l = l.filter((p) => { const alvo = semAcento(`${p.nome} ${p.categoriaNome ?? ''} ${p.codigo}`); return t.every((x) => alvo.includes(x)); });
    }
    return l;
  }, [dados, cat, lojaRota, rota.v, termo]);

  const lista = useMemo(() => {
    const f = FAIXAS.find((x) => x.id === faixa);
    const l = base.filter((p) => (!soOferta || emOferta(p)) && (!soDisp || p.disponivel) && (!f || (p.preco >= f.min && p.preco < f.max))
      && (!soFrete || freteGratis(p))
      && (lojasSel.length === 0 || p.ofertas?.some((o) => lojasSel.includes(o.parceiroId))));
    const s = [...l];
    if (ordem === 'menor') s.sort((a, b) => a.preco - b.preco);
    else if (ordem === 'maior') s.sort((a, b) => b.preco - a.preco);
    else if (ordem === 'az') s.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    else if (ordem === 'desconto') s.sort((a, b) => (b.desconto ?? 0) - (a.desconto ?? 0));
    else s.sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || Number(b.maisVendido) - Number(a.maisVendido) || Number(b.novo) - Number(a.novo));
    return s;
  }, [base, soOferta, soDisp, faixa, ordem, soFrete, lojasSel]);

  const faixasUteis = FAIXAS.filter((f) => base.some((p) => p.preco >= f.min && p.preco < f.max));
  const titulo = termo ? `“${termo}”` : lojaRota ? lojaRota.nome : cat ? cat.nome : rota.v === 'ofertas' ? 'Ofertas' : rota.v === 'novidades' ? 'Novidades' : 'Todos os produtos';
  const filtros = Number(soOferta) + Number(soDisp) + Number(!!faixa) + Number(soFrete) + lojasSel.length;
  const mudar = (fn: () => void) => transicao(fn);
  const limpar = () => mudar(() => { setSoOferta(false); setSoDisp(false); setFaixa(null); setSoFrete(false); setLojasSel([]); });
  const temAfiliado = base.some(ehAfiliado);
  const lojasNaBase = (dados.parceiros ?? []).filter((x) => x.id !== lojaRota?.id && base.some((p) => p.ofertas?.some((o) => o.parceiroId === x.id)));
  const temFrete = base.some(freteGratis);
  const precos = lista.map((p) => p.preco);

  return (
    <div className="s-lista">
      <header className="s-lista-head">
        <nav className="s-crumbs" aria-label="Você está em">
          <a href="/loja" onClick={(e) => { e.preventDefault(); ir({}); }}>Início</a>
          <span>/</span>
          {lojaRota && <><a href={urlDe({ v: 'todos' })} onClick={(e) => { e.preventDefault(); ir({ v: 'todos' }); }}>Lojas parceiras</a><span>/</span></>}
          <span aria-current="page">{termo ? 'Busca' : titulo}</span>
        </nav>
        <h1 key={titulo} className="s-display xl">
          {titulo.split(' ').map((w, k) => <span key={k} className="w" style={{ ['--d' as string]: k }}><span>{w}</span></span>)}
        </h1>
        <p className="s-lista-meta">
          {lista.length} {lista.length === 1 ? 'produto' : 'produtos'}
          {precos.length > 1 && ` · de ${money(Math.min(...precos))} a ${money(Math.max(...precos))}`}
        </p>
        {!termo && !lojaRota && (
          <div className="s-chips cats" role="list">
            <a role="listitem" href={urlDe({ v: 'todos' })} className="s-chip" aria-current={!cat && rota.v !== 'ofertas' && rota.v !== 'novidades'}
              onClick={(e) => { e.preventDefault(); ir({ v: 'todos' }); }}>Tudo</a>
            {dados.categorias.map((c) => (
              <a role="listitem" key={c.id} href={urlDe({ c: c.id })} className="s-chip" aria-current={cat?.id === c.id}
                onClick={(e) => { e.preventDefault(); ir({ c: c.id }); }}>{c.nome}<sup>{c.quantidade}</sup></a>
            ))}
          </div>
        )}
      </header>

      <div ref={sentinela} aria-hidden="true" />
      <div className={`s-toolbar ${preso ? 'preso' : ''}`}>
        <div className="s-toolbar-in">
          <div className="s-chips" role="group" aria-label="Filtros">
            <button className="s-chip" aria-pressed={soOferta} onClick={() => mudar(() => setSoOferta((v) => !v))}>Em oferta</button>
            <button className="s-chip" aria-pressed={soDisp} onClick={() => mudar(() => setSoDisp((v) => !v))}>Disponíveis</button>
            {temFrete && <button className="s-chip" aria-pressed={soFrete} onClick={() => mudar(() => setSoFrete((v) => !v))}>Frete grátis</button>}
            {temAfiliado && lojasNaBase.length > 1 && <span className="s-chips-sep" aria-hidden="true" />}
            {temAfiliado && lojasNaBase.length > 1 && lojasNaBase.map((x) => (
              <button key={x.id} className="s-chip loja" aria-pressed={lojasSel.includes(x.id)}
                onClick={() => mudar(() => setLojasSel((v) => (v.includes(x.id) ? v.filter((i) => i !== x.id) : [...v, x.id])))}>
                <MarcaLoja nome={x.nome} cor={x.cor} size={18} />{x.nome}
              </button>
            ))}
            <span className="s-chips-sep" aria-hidden="true" />
            {faixasUteis.map((f) => (
              <button key={f.id} className="s-chip" aria-pressed={faixa === f.id} onClick={() => mudar(() => setFaixa((v) => (v === f.id ? null : f.id)))}>{f.t}</button>
            ))}
            {filtros > 0 && <button className="s-chip limpar" onClick={limpar}>Limpar ({filtros})</button>}
          </div>
          <label className="s-ordem">
            <span>Ordenar</span>
            <select value={ordem} onChange={(e) => { const v = e.target.value as Ordem; mudar(() => setOrdem(v)); }}>
              {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </label>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="s-vazio">
          <span className="s-display sm">Nada por aqui</span>
          <p>{termo ? `Nenhum produto encontrado para “${termo}”.` : 'Nenhum produto com esses filtros.'}</p>
          {filtros > 0 ? <button className="s-btn" onClick={limpar}>Limpar filtros</button>
            : <button className="s-btn" onClick={() => ir({ v: 'todos' })}>Ver todos os produtos</button>}
        </div>
      ) : (
        <div className="s-grid" aria-live="polite">
          {lista.map((p, i) => (
            <div key={p.id} style={{ viewTransitionName: `item-${p.id}` }}>
              <Card p={p} i={i} onAbrir={onAbrir} onAdicionar={onAdicionar} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
