package br.com.erp.integracao;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class LeitorDeLinkTest {

    private final LeitorDeLink leitor = new LeitorDeLink();

    @Test
    void leProdutoDoMercadoLivrePelosDadosEstruturados() {
        String html = "<meta property=\"og:title\" content=\"Azzaro | Mercado Livre\">"
                + "<script type=\"application/ld+json\">{\"@type\":\"Product\",\"name\":\"Perfume Azzaro Pour Homme 100 ml\","
                + "\"image\":\"https://http2.mlstatic.com/D_NQ_NP_904941-MLA106200749855_012026-O.jpg\","
                + "\"offers\":{\"@type\":\"Offer\",\"price\":231},\"aggregateRating\":{\"ratingValue\":4.7}}</script>"
                + "<s aria-label=\"Antes: 509 reais\"></s> Frete grátis";
        LeitorDeLink.Dados d = leitor.extrair(html);
        assertEquals("Perfume Azzaro Pour Homme 100 ml", d.nome);
        assertEquals(new BigDecimal("231.00"), d.preco);
        assertEquals(new BigDecimal("509.00"), d.anterior);
        assertEquals(new BigDecimal("4.70"), d.nota);
        assertTrue(d.frete);
        assertEquals("https://http2.mlstatic.com/D_NQ_NP_2X_904941-MLA106200749855_012026-F.jpg", LeitorDeLink.melhorarFoto(d.imagem));
    }

    @Test
    void leSheinPelasMetatagsEPrecos() {
        String html = "<meta property=\"og:title\" content=\"Blazer Feminino Branco | SHEIN Brasil\">"
                + "<meta property=\"og:image\" content=\"https://img.ltwebstatic.com/v4/x_thumbnail_405x552.jpg\">"
                + "\"salePrice\":{\"amount\":\"143.40\"},\"retailPrice\":{\"amount\":\"150.95\"}";
        LeitorDeLink.Dados d = leitor.extrair(html);
        assertEquals("Blazer Feminino Branco", d.nome);
        assertEquals(new BigDecimal("143.40"), d.preco);
        assertEquals(new BigDecimal("150.95"), d.anterior);
        assertEquals("https://img.ltwebstatic.com/v4/x_thumbnail_900x.jpg", LeitorDeLink.melhorarFoto(d.imagem));
    }

    @Test
    void achaOProdutoEmDestaqueNoPerfilSocial() {
        String html = "<a href=\"https:\\u002F\\u002Fwww.mercadolivre.com.br\\u002Foutro\\u002Fp\\u002FMLB111\">x</a>"
                + "<a href=\"https://www.mercadolivre.com.br/azzaro/p/MLB3821589?x=1&amp;c_id=/home/card-featured/element\">";
        assertTrue(LeitorDeLink.produtoEmDestaqueMl(html).startsWith("https://www.mercadolivre.com.br/azzaro/p/MLB3821589"));
    }

    @Test
    void limpaOEnderecoMantendoOAnuncio() {
        assertEquals("https://www.mercadolivre.com.br/a/p/MLB1?pdp_filters=item_id%3AMLB555",
                LeitorDeLink.limparUrl("https://www.mercadolivre.com.br/a/p/MLB1?pdp_filters=item_id%3AMLB555&matt=2", "mercadolivre"));
        assertEquals("https://br.shein.com/x-p-1.html", LeitorDeLink.limparUrl("https://br.shein.com/x-p-1.html?src=a#b", "shein"));
    }

    @Test
    void soAbreSitesDasLojas() {
        assertTrue(LeitorDeLink.permitido("meli.la", Set.of("meli.la")));
        assertTrue(LeitorDeLink.permitido("www.mercadolivre.com.br", Set.of("mercadolivre.com.br")));
        assertFalse(LeitorDeLink.permitido("naomeli.la", Set.of("meli.la")));
        assertFalse(LeitorDeLink.permitido("169.254.169.254", Set.of("meli.la")));
        LeitorDeLink.Lido l = leitor.ler("http://169.254.169.254/latest");
        assertNull(l.loja());
        assertFalse(l.avisos().isEmpty());
    }
}
