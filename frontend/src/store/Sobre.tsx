import type { Catalogo, Rota } from './shared';

/** Página "Sobre, como ganhamos dinheiro e privacidade": transparência exigida pelos programas de afiliados e pelo AdSense. */
export function Sobre({ dados, ir }: { dados: Catalogo; ir: (r: Rota) => void }) {
  const loja = dados.loja.nome;
  const parceiros = (dados.parceiros ?? []).map((p) => p.nome);
  const lista = parceiros.length > 1 ? `${parceiros.slice(0, -1).join(', ')} e ${parceiros[parceiros.length - 1]}` : parceiros[0] ?? 'lojas parceiras';
  return (
    <article className="s-sobre">
      <nav className="s-crumbs" aria-label="Você está em">
        <a href="/loja" onClick={(e) => { e.preventDefault(); ir({}); }}>Início</a>
        <span>/</span>
        <span aria-current="page">Sobre e privacidade</span>
      </nav>
      <h1 className="s-display xl">Sobre a {loja}</h1>

      <section>
        <h2>Quem somos</h2>
        <p>A {loja} é um site brasileiro que reúne ofertas de lojas conhecidas, como {lista}, compara preços e mostra o histórico de cada produto, para você comprar na hora certa e pelo menor preço. Não vendemos nada diretamente: a compra, o pagamento, a entrega e a garantia são sempre feitos pela loja onde você comprar.</p>
      </section>

      <section id="como-ganhamos">
        <h2>Como ganhamos dinheiro</h2>
        <p>Os botões “Ver na loja” usam links de afiliado. Quando você compra por eles, a loja nos paga uma pequena comissão. <strong>Você não paga nada a mais por isso</strong>, e o preço é o mesmo de entrar direto na loja.</p>
        <p>O site também pode mostrar anúncios, sempre marcados como <em>Publicidade</em>: banners de campanhas das lojas parceiras e, em alguns lugares, anúncios do Google. A comissão e os anúncios não mudam a ordem nem o preço das ofertas.</p>
      </section>

      <section>
        <h2>Sobre os preços</h2>
        <p>Os preços, o frete e a disponibilidade são definidos pelas lojas e podem mudar a qualquer momento. Conferimos as ofertas com frequência, mas o valor que vale é sempre o que aparece na loja no momento da compra. Ofertas válidas enquanto durarem os estoques.</p>
        <p>O preço “de” (riscado) é o informado pela própria loja. Se você encontrar uma informação errada, avise pelo e-mail abaixo que corrigimos.</p>
      </section>

      <section id="privacidade">
        <h2>Privacidade e cookies</h2>
        <ul>
          <li><strong>Não pedimos cadastro</strong> e não guardamos seu nome, e-mail ou telefone para navegar no site.</li>
          <li><strong>Favoritos</strong> ficam guardados só no seu aparelho, no próprio navegador.</li>
          <li><strong>Aviso de preço:</strong> se você pedir para ser avisado quando um produto baixar, guardamos apenas o endereço técnico da notificação do seu navegador e o produto escolhido. Você pode cancelar a qualquer momento no mesmo botão ou nas configurações do navegador.</li>
          <li><strong>Cliques:</strong> contamos quantas vezes cada oferta e cada anúncio é clicado, sem identificar quem clicou.</li>
          <li><strong>Lojas parceiras e anúncios:</strong> ao clicar em “Ver na loja”, você vai para o site da loja, que tem a própria política de privacidade e usa cookies para registrar a indicação. Anúncios do Google podem usar cookies para mostrar anúncios mais relevantes; você pode ajustar isso em <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>.</li>
        </ul>
        <p>Você pode pedir informações ou a exclusão de qualquer dado seu, conforme a Lei Geral de Proteção de Dados (LGPD), pelo e-mail de contato.</p>
      </section>

      <section>
        <h2>Contato</h2>
        <p>{dados.loja.email ? <>Fale com a gente: <a href={`mailto:${dados.loja.email}`}>{dados.loja.email}</a></> : 'Fale com a gente pelas nossas redes.'}</p>
      </section>
    </article>
  );
}
