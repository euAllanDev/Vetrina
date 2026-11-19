import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { money } from '../lib/format';
import { Card, Preco, Selos, Seta, Trilho, inicial, limiteDe, type Abrir, type Adicionar, type Catalogo, type Produto, type Rota } from './shared';

interface Props { p: Produto; dados: Catalogo; naSacola: number; ir: (r: Rota) => void; onAbrir: Abrir; onAdicionar: Adicionar }

export function Pdp({ p, dados, naSacola, ir, onAbrir, onAdicionar }: Props) {
  const [q, setQ] = useState(1);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [aberta, setAberta] = useState<string | null>('desc');
  const media = useRef<HTMLDivElement>(null);
  const max = Math.max(0, limiteDe(p) - naSacola);
  useEffect(() => { setQ(1); setAberta('desc'); }, [p.id]);

  const relacionados = dados.produtos
    .filter((x) => x.id !== p.id && x.categoriaId === p.categoriaId)
    .sort((a, b) => Number(b.disponivel) - Number(a.disponivel));
  const outros = dados.produtos.filter((x) => x.id !== p.id && x.categoriaId !== p.categoriaId && x.maisVendido);

  const mover = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const paragrafos = (p.detalhes ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const disp = !p.disponivel ? { t: 'Esgotado no momento', k: 'off' }
    : p.ultimasUnidades ? { t: p.ultimasUnidades === 1 ? 'Última unidade disponível' : `Restam só ${p.ultimasUnidades} unidades`, k: 'warn' }
    : { t: 'Em estoque', k: 'ok' };

  const secoes = [
    { id: 'desc', t: 'Descrição', c: paragrafos.length ? paragrafos.map((x, i) => <p key={i}>{x}</p>) : <p>{p.nome}{p.categoriaNome ? `, da categoria ${p.categoriaNome.toLowerCase()}` : ''}.</p> },
    { id: 'info', t: 'Informações do produto', c: (
      <dl className="s-specs">
        <dt>Código</dt><dd className="mono">{p.codigo}</dd>
        <dt>Vendido por</dt><dd>{p.unidade === 'UN' ? 'unidade' : p.unidade.toLowerCase()}</dd>
        {p.categoriaNome && <><dt>Categoria</dt><dd>{p.categoriaNome}</dd></>}
      </dl>
    ) },
    { id: 'pag', t: 'Pagamento e entrega', c: (
      <>
        <p>Você envia o pedido sem pagar nada agora. A loja entra em contato pelo telefone informado para confirmar disponibilidade, forma de pagamento e retirada ou entrega.</p>
        <p>Aceitamos Pix, cartão de crédito, cartão de débito e dinheiro.{dados.loja.cidade ? ` Atendemos a partir de ${dados.loja.cidade}${dados.loja.uf ? `/${dados.loja.uf}` : ''}.` : ''}</p>
      </>
    ) },
  ];

  return (
    <div className="s-pdp-wrap">
      <nav className="s-crumbs pad" aria-label="Você está em">
        <a href="/loja" onClick={(e) => { e.preventDefault(); ir({}); }}>Início</a>
        {p.categoriaId && p.categoriaNome && <><span>/</span><a href={`/loja?c=${p.categoriaId}`} onClick={(e) => { e.preventDefault(); ir({ c: p.categoriaId! }); }}>{p.categoriaNome}</a></>}
        <span>/</span><span aria-current="page">{p.nome}</span>
      </nav>

      <div className="s-pdp">
        <div className={`s-pdp-media ${zoom ? 'zoom' : ''}`} ref={media} style={{ viewTransitionName: 'foto-sel' }}
          onMouseMove={p.imagemUrl ? mover : undefined} onMouseLeave={() => setZoom(null)}>
          {p.imagemUrl
            ? <img src={p.imagemUrl} alt={p.nome} style={zoom ? { transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
            : <div className="s-foto vazia"><span style={{ fontSize: 'min(30vw, 260px)' }}>{inicial(p.nome)}</span></div>}
          <Selos p={p} />
        </div>

        <div className="s-pdp-info">
          <div className="s-pdp-sticky">
            {p.categoriaNome && <div className="s-pdp-cat">{p.categoriaNome}</div>}
            <h1 className="s-pdp-nome">{p.nome}</h1>
            <Preco p={p} grande />
            {p.precoAnterior && p.precoAnterior > p.preco && (
              <p className="s-economia">Você economiza {money(p.precoAnterior - p.preco)}</p>
            )}

            <div className={`s-disp ${disp.k}`}><span className="dot" />{disp.t}</div>

            <div className="s-pdp-buy">
              {p.disponivel && (
                <div className="s-qty" aria-label="Quantidade">
                  <button aria-label="Diminuir" disabled={q <= 1} onClick={() => setQ((x) => Math.max(1, x - 1))}>−</button>
                  <span className="s-num" aria-live="polite">{q}</span>
                  <button aria-label="Aumentar" disabled={q >= max} onClick={() => setQ((x) => Math.min(max, x + 1))}>+</button>
                </div>
              )}
              <button className="s-btn xl" disabled={!p.disponivel || max === 0}
                onClick={() => { onAdicionar(p, media.current, q); setQ(1); }}>
                {!p.disponivel ? 'Esgotado' : max === 0 ? 'Limite na sacola' : `Adicionar à sacola · ${money(p.preco * q)}`}
              </button>
            </div>
            {naSacola > 0 && <p className="s-na-sacola">{naSacola} {naSacola === 1 ? 'unidade' : 'unidades'} na sua sacola</p>}

            <ul className="s-garantias">
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>Sem pagamento antecipado</li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>Pix, cartão ou dinheiro</li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>Confirmação pelo telefone</li>
            </ul>

            <div className="s-acordeao">
              {secoes.map((s) => (
                <div key={s.id} className={`s-acc ${aberta === s.id ? 'on' : ''}`}>
                  <button aria-expanded={aberta === s.id} aria-controls={`acc-${s.id}`} onClick={() => setAberta((v) => (v === s.id ? null : s.id))}>
                    {s.t}<Seta dir="down" size={18} />
                  </button>
                  <div className="s-acc-body" id={`acc-${s.id}`} role="region"><div><div className="s-acc-in">{s.c}</div></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {relacionados.length > 0 && (
        <Trilho titulo="Da mesma categoria" sub={p.categoriaNome ?? undefined}>
          {relacionados.map((x, i) => <Card key={x.id} p={x} i={i} onAbrir={onAbrir} onAdicionar={onAdicionar} />)}
        </Trilho>
      )}
      {outros.length > 0 && (
        <Trilho titulo="Você também pode gostar">
          {outros.map((x, i) => <Card key={x.id} p={x} i={i} onAbrir={onAbrir} onAdicionar={onAdicionar} />)}
        </Trilho>
      )}
    </div>
  );
}
