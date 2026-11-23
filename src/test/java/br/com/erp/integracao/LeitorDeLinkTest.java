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
    void separaOPrecoDoTituloDeCompartilhamento() {
        String html = "<meta property=\"og:title\" content=\"Orygens Arad Eau de Parfum 100ml Masculino - R$ 1.072,60\">"
                + "<meta property=\"og:description\" content=\"Olha o que eu encontrei! Orygens no Mercado Livre.\">";
        LeitorDeLink.Dados d = leitor.extrair(html);
        assertEquals("Orygens Arad Eau de Parfum 100ml Masculino", d.nome);
        assertEquals(new BigDecimal("1072.60"), d.preco);
        assertNull(d.descricao);
    }

    @Test
    void usaOPrimeiroCardDoPerfilSocial() {
        String html = "\"polycards\":[{\"unique_id\":\"x\",\"metadata\":{\"id\":\"MLB4579733037\",\"product_id\":\"MLB53227039\",\"pid\":\"MLBP1\"}},"
                + "{\"metadata\":{\"id\":\"MLB2\",\"product_id\":\"MLB999\"}}]";
        assertEquals("https://www.mercadolivre.com.br/p/MLB53227039", LeitorDeLink.produtoEmDestaqueMl(html, "qualquer"));
        String semCatalogo = "\"polycards\":[{\"metadata\":{\"id\":\"MLB4067115699\",\"pid\":\"x\"}}]";
        assertEquals("https://produto.mercadolivre.com.br/MLB-4067115699", LeitorDeLink.produtoEmDestaqueMl(semCatalogo, "x"));
    }

    @Test
    void achaOProdutoDoLinkNoPerfilSocial() {
        String html = "<a href=\"https:\\u002F\\u002Fwww.mercadolivre.com.br\\u002Fcreatina-growth\\u002Fp\\u002FMLB111?x=1\">x</a>"
                + "<a href=\"https://www.mercadolivre.com.br/c/livros?ref=MLB999\">c</a>"
                + "<a href=\"https://www.mercadolivre.com.br/perfume-masculino-azzaro-pour-homme-100-ml/p/MLB3821589?x=1\">";
        assertEquals("https://www.mercadolivre.com.br/perfume-masculino-azzaro-pour-homme-100-ml/p/MLB3821589",
                LeitorDeLink.produtoEmDestaqueMl(html, "Perfume Masculino Azzaro Pour Homme 100 ml"));
        assertNull(LeitorDeLink.produtoEmDestaqueMl(html, "Notebook Gamer"));
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
