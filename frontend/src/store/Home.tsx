import { useEffect, useMemo, useState } from 'react';
import { Card, Foto, MarcaLoja, Seta, Trilho, baixou, ehAfiliado, emOferta, reduzMovimento, urlDe, useRevela, type Abrir, type Adicionar, type Catalogo, type Produto, type Rota } from './shared';

/** Frases de campanha por categoria (as que não estiverem aqui usam o próprio nome). */
const FRASES: Record<string, string> = {
  'Tênis': 'Feito para andar longe',
  'Camisetas': 'O básico, do jeito certo',
  'Moletons & Jaquetas': 'Camadas para o frio',
  'Calças & Shorts': 'Liberdade de movimento',
  'Acessórios': 'O detalhe que fecha',
  'Informática': 'Mesa pronta para render',
  'Papelaria': 'Ideias no papel',
};
const frase = (nome: string) => FRASES[nome] ?? nome;

interface Props { dados: Catalogo; ir: (r: Rota) => void; onAbrir: Abrir; onAdicionar: Adicionar }

export function Home({ dados, ir, onAbrir, onAdicionar }: Props) {
  const { produtos, categorias } = dados;
  const comFoto = produtos.filter((p) => p.imagemUrl);
  const doCat = (id: number) => comFoto.filter((p) => p.categoriaId === id)
    .sort((a, b) => Number(b.maisVendido) - Number(a.maisVendido) || Number(b.disponivel) - Number(a.disponivel));

  const slides = useMemo(() => categorias
    .map((c) => ({ c, fotos: doCat(c.id).slice(0, 3) }))
    .filter((s) => s.fotos.length >= 2)
    .sort((a, b) => b.c.quantidade - a.c.quantidade)
    .slice(0, 4), [dados]); // eslint-disable-line react-hooks/exhaustive-deps

  const maisVendidos = produtos.filter((p) => p.maisVendido && p.disponivel);
  const novidades = produtos.filter((p) => p.novo);
  const baixaram = produtos.filter((p) => baixou(p) && p.disponivel)
    .sort((a, b) => (b.baixouDe! - b.preco) / b.baixouDe! - (a.baixouDe! - a.preco) / a.baixouDe!);
  const ofertas = produtos.filter((p) => emOferta(p) && p.disponivel).sort((a, b) => (b.desconto ?? 0) - (a.desconto ?? 0));
  const destaques = maisVendidos.length >= 4 ? maisVendidos : produtos.filter((p) => p.disponivel && p.imagemUrl).slice(0, 10);

  const cartao = (p: Produto, i: number) => <Card key={p.id} p={p} i={i} onAbrir={onAbrir} onAdicionar={onAdicionar} />;

  return (
    <>
      {slides.length > 0 ? <Hero slides={slides} ir={ir} /> : <HeroSimples nome={dados.loja.nome} ir={ir} />}

      <Letreiro itens={categorias.map((c) => c.nome)} />

      <Passos comparador={produtos.some(ehAfiliado)} />

      {baixaram.length > 0 && (
        <Trilho titulo="Baixaram de preço" sub="O robô encontrou estes preços menores nos últimos dias"
          acao={<a className="s-link-strong" href={urlDe({ v: 'baixou' })} onClick={(e) => { e.preventDefault(); ir({ v: 'baixou' }); }}>Ver tudo</a>}>
          {baixaram.map(cartao)}
        </Trilho>
      )}

      <Trilho titulo={maisVendidos.length >= 4 ? 'Mais vendidos' : 'Destaques'}
        sub={maisVendidos.length >= 4 ? 'O que mais saiu nos últimos 90 dias' : 'Uma seleção da vitrine'}
        acao={<a className="s-link-strong" href={urlDe({ v: 'todos' })} onClick={(e) => { e.preventDefault(); ir({ v: 'todos' }); }}>Ver tudo</a>}>
        {destaques.map(cartao)}
      </Trilho>

      <Categorias dados={dados} capa={(id) => doCat(id)[0]} ir={ir} />

      {(dados.parceiros?.length ?? 0) > 0 && <Parceiros dados={dados} ir={ir} />}

      {ofertas.length > 0 && <BannerOfertas ofertas={ofertas} ir={ir} />}

      {novidades.length > 0 && (
        <Trilho titulo="Novidades" sub="Acabou de chegar na vitrine"
          acao={<a className="s-link-strong" href={urlDe({ v: 'novidades' })} onClick={(e) => { e.preventDefault(); ir({ v: 'novidades' }); }}>Ver tudo</a>}>
          {novidades.map(cartao)}
        </Trilho>
      )}

      {slides.length >= 2 && <Duplo a={slides[1]} b={slides[slides.length > 2 ? 2 : 0]} ir={ir} />}

      {ofertas.length > 0 && (
        <Trilho titulo="Ofertas" sub="Preço reduzido enquanto durar o estoque"
          acao={<a className="s-link-strong" href={urlDe({ v: 'ofertas' })} onClick={(e) => { e.preventDefault(); ir({ v: 'ofertas' }); }}>Ver tudo</a>}>
          {ofertas.map(cartao)}
        </Trilho>
      )}
    </>
  );
}

/* ============================== hero ============================== */
type Slide = { c: { id: number; nome: string; quantidade: number }; fotos: Produto[] };
const DURACAO = 6500;

function Hero({ slides, ir }: { slides: Slide[]; ir: (r: Rota) => void }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [ciclo, setCiclo] = useState(0);
  const auto = slides.length > 1 && !reduzMovimento();

  useEffect(() => {
    if (!auto || pausa) return;
    const t = window.setTimeout(() => { setI((x) => (x + 1) % slides.length); setCiclo((c) => c + 1); }, DURACAO);
    return () => window.clearTimeout(t);
  }, [i, pausa, auto, slides.length, ciclo]);

  const ver = (n: number) => { setI(n); setCiclo((c) => c + 1); };

  return (
    <section className="s-hero" aria-roledescription="carrossel" aria-label="Destaques"
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}
      onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      {slides.map((s, n) => (
        <div key={s.c.id} className={`s-slide ${n === i ? 'on' : ''}`} aria-hidden={n !== i} data-fotos={s.fotos.length}>
          <div className="s-slide-fotos">
            {s.fotos.map((p, k) => (
              <div key={p.id} className="s-slide-foto" style={{ ['--k' as string]: k }}>
                <img src={p.imagemUrl!} alt="" loading={n === 0 ? 'eager' : 'lazy'} />
              </div>
            ))}
          </div>
          <div className="s-slide-text">
            <span className="s-slide-kicker">{s.c.nome} · {s.c.quantidade} {s.c.quantidade === 1 ? 'produto' : 'produtos'}</span>
            <h1 className="s-display">
              {frase(s.c.nome).split(' ').map((w, k) => <span key={k} className="w" style={{ ['--d' as string]: k }}><span>{w}</span></span>)}
            </h1>
            <div className="s-slide-ctas">
              <a className="s-btn light" href={urlDe({ c: s.c.id })} tabIndex={n === i ? 0 : -1}
                onClick={(e) => { e.preventDefault(); ir({ c: s.c.id }); }}>Comprar {s.c.nome.toLowerCase()}</a>
            </div>
          </div>
        </div>
      ))}
      {slides.length > 1 && (
        <div className="s-hero-nav">
          {slides.map((s, n) => (
            <button key={s.c.id} className={`s-hero-dot ${n === i ? 'on' : ''} ${pausa ? 'pausa' : ''}`} aria-label={`Ver ${s.c.nome}`} aria-current={n === i}
              onClick={() => ver(n)}>
              <span className="lbl">{s.c.nome}</span>
              <span className="bar"><span key={`${n}-${ciclo}`} style={{ animationDuration: `${DURACAO}ms` }} /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function HeroSimples({ nome, ir }: { nome: string; ir: (r: Rota) => void }) {
  return (
    <section className="s-hero simples">
      <div className="s-slide on">
        <div className="s-slide-text">
          <h1 className="s-display">{nome.split(' ').map((w, k) => <span key={k} className="w" style={{ ['--d' as string]: k }}><span>{w}</span></span>)}</h1>
          <div className="s-slide-ctas"><button className="s-btn light" onClick={() => ir({ v: 'todos' })}>Ver produtos</button></div>
        </div>
      </div>
    </section>
  );
}

/* ============================== letreiro ============================== */
function Letreiro({ itens }: { itens: string[] }) {
  if (!itens.length) return null;
  const linha = [...itens, ...itens, ...itens];
  return (
    <div className="s-letreiro" aria-hidden="true">
      <div className="s-letreiro-track">
        {[0, 1].map((k) => (
          <div key={k} className="s-letreiro-grupo">
            {linha.map((t, n) => <span key={n} className={n % 2 ? 'vazado' : ''}>{t}<i>✦</i></span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== como funciona ============================== */
function Passos({ comparador }: { comparador: boolean }) {
  const [ref, visto] = useRevela<HTMLElement>();
  const itens = comparador ? [
    ['Compare as lojas', 'Mostramos o preço do mesmo produto em várias lojas parceiras, com frete e avaliações.'],
    ['Veja o histórico', 'O gráfico mostra se o preço de hoje está bom ou se vale esperar.'],
    ['Compre direto na loja', 'Você finaliza no site da loja escolhida, sem custo extra.'],
  ] : [
    ['Monte sua sacola', 'Escolha os produtos e as quantidades com calma. A sacola fica salva neste aparelho.'],
    ['Envie o pedido', 'Sem cadastro e sem pagar agora: só nome e telefone.'],
    ['A loja confirma', 'Entramos em contato para combinar pagamento por Pix, cartão ou dinheiro.'],
  ];
  return (
    <section className={`s-passos ${visto ? 'in' : ''}`} ref={ref} aria-label="Como funciona">
      {itens.map(([t, d], n) => (
        <div key={t} className="s-passo" style={{ ['--i' as string]: n }}>
          <span className="n">0{n + 1}</span>
          <div><strong>{t}</strong><p>{d}</p></div>
        </div>
      ))}
    </section>
  );
}

/* ============================== categorias ============================== */
function Categorias({ dados, capa, ir }: { dados: Catalogo; capa: (id: number) => Produto | undefined; ir: (r: Rota) => void }) {
  const cats = dados.categorias.map((c) => ({ c, p: capa(c.id) })).filter((x) => x.p);
  if (!cats.length) return null;
  return (
    <Trilho titulo="Compre por categoria">
      {cats.map(({ c, p }, n) => (
        <a key={c.id} href={urlDe({ c: c.id })} className="s-cat" style={{ ['--i' as string]: n }}
          onClick={(e) => { e.preventDefault(); ir({ c: c.id }); }}>
          <Foto p={p!} />
          <div className="s-cat-txt">
            <span className="s-cat-nome">{c.nome}</span>
            <span className="s-cat-cta">{c.quantidade} {c.quantidade === 1 ? 'produto' : 'produtos'} <Seta size={16} /></span>
          </div>
        </a>
      ))}
    </Trilho>
  );
}

/* ============================== lojas parceiras ============================== */
function Parceiros({ dados, ir }: { dados: Catalogo; ir: (r: Rota) => void }) {
  const [ref, visto] = useRevela<HTMLElement>();
  const ps = dados.parceiros ?? [];
  return (
    <section className={`s-parceiros-sec ${visto ? 'in' : ''}`} ref={ref}>
      <div className="s-sec-head">
        <div>
          <h2 className="s-sec-title">Lojas parceiras</h2>
          <p className="s-sec-sub">Comparamos os preços e você compra direto na loja</p>
        </div>
      </div>
      <div className="s-parceiros">
        {ps.map((x, n) => (
          <a key={x.id} href={urlDe({ l: x.id })} className="s-parceiro" style={{ ['--i' as string]: n }}
            onClick={(e) => { e.preventDefault(); ir({ l: x.id }); }}>
            <MarcaLoja nome={x.nome} cor={x.cor} size={44} />
            <div><strong>{x.nome}</strong><span className="n">{x.produtos} {x.produtos === 1 ? 'produto' : 'produtos'}</span></div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ============================== banner de ofertas ============================== */
function BannerOfertas({ ofertas, ir }: { ofertas: Produto[]; ir: (r: Rota) => void }) {
  const [ref, visto] = useRevela<HTMLElement>();
  const max = Math.max(...ofertas.map((p) => p.desconto ?? 0));
  const fotos = ofertas.filter((p) => p.imagemUrl).slice(0, 2);
  return (
    <section className={`s-promo ${visto ? 'in' : ''}`} ref={ref}>
      <div className="s-promo-fotos">
        {fotos.map((p) => <Foto key={p.id} p={p} />)}
      </div>
      <div className="s-promo-txt">
        <span className="s-slide-kicker">Ofertas</span>
        <h2 className="s-display">
          <span className="w" style={{ ['--d' as string]: 0 }}><span>Até</span></span>{' '}
          <span className="w" style={{ ['--d' as string]: 1 }}><span className="sale">{max}%</span></span>{' '}
          <span className="w" style={{ ['--d' as string]: 2 }}><span>off</span></span>
        </h2>
        <p>{ofertas.length} {ofertas.length === 1 ? 'produto com preço reduzido' : 'produtos com preço reduzido'}, enquanto durar o estoque.</p>
        <a className="s-btn light" href={urlDe({ v: 'ofertas' })} onClick={(e) => { e.preventDefault(); ir({ v: 'ofertas' }); }}>Ver ofertas</a>
      </div>
    </section>
  );
}

/* ============================== editorial duplo ============================== */
function Duplo({ a, b, ir }: { a: Slide; b: Slide; ir: (r: Rota) => void }) {
  const [ref, visto] = useRevela<HTMLElement>();
  if (a.c.id === b.c.id) return null;
  return (
    <section className={`s-duplo ${visto ? 'in' : ''}`} ref={ref}>
      {[a, b].map((s, n) => (
        <a key={s.c.id} className="s-duplo-item" href={urlDe({ c: s.c.id })} style={{ ['--i' as string]: n }}
          onClick={(e) => { e.preventDefault(); ir({ c: s.c.id }); }}>
          <Foto p={s.fotos[n === 0 ? 0 : 1] ?? s.fotos[0]} />
          <div className="s-duplo-txt">
            <span className="s-slide-kicker">{s.c.nome}</span>
            <h3 className="s-display sm">{frase(s.c.nome)}</h3>
            <span className="s-btn light sm">Comprar</span>
          </div>
        </a>
      ))}
    </section>
  );
}
