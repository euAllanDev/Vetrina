package br.com.erp.integracao;

import org.junit.jupiter.api.Test;

import static br.com.erp.integracao.CapturaService.Loja;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CapturaServiceTest {

    @Test
    void reconheceALoja() {
        assertEquals(Loja.MERCADO_LIVRE, Loja.de("https://www.mercadolivre.com.br/social/sa123"));
        assertEquals(Loja.MERCADO_LIVRE, Loja.de("https://meli.la/2Xayxcq"));
        assertEquals(Loja.SHEIN, Loja.de("https://br.shein.com/Calca-p-37791781.html"));
        assertEquals(Loja.SHOPEE, Loja.de("shopee"));
        assertNull(Loja.de("https://exemplo.com"));
    }

    @Test
    void codigoDoMercadoLivre() {
        assertEquals("MLB6572893924", CapturaService.codigoDe(Loja.MERCADO_LIVRE, null,
                "https://www.mercadolivre.com.br/vestido/up/MLBU3828670042?pdp_filters=item_id%3AMLB6572893924"));
        assertEquals("P:MLB27946359", CapturaService.codigoDe(Loja.MERCADO_LIVRE, null,
                "https://www.mercadolivre.com.br/natura-kaiak/p/MLB27946359"));
        assertEquals("MLB5518067030", CapturaService.codigoDe(Loja.MERCADO_LIVRE, null,
                "https://produto.mercadolivre.com.br/MLB-5518067030-camisa-polo-_JM"));
        // Sem código na URL: usa o que o navegador mandou.
        assertEquals("MLB123456789", CapturaService.codigoDe(Loja.MERCADO_LIVRE, "mlb123456789", "https://www.mercadolivre.com.br/social/x"));
    }

    @Test
    void codigoDasOutrasLojas() {
        assertEquals("37791781", CapturaService.codigoDe(Loja.SHEIN, null,
                "https://br.shein.com/XLLAIS-Women-s-Pants-p-37791781-cat-1740.html"));
        assertEquals("123.456", CapturaService.codigoDe(Loja.SHOPEE, null, "https://shopee.com.br/Camiseta-i.123.456"));
        assertEquals("1005001234", CapturaService.codigoDe(Loja.ALIEXPRESS, null, "https://pt.aliexpress.com/item/1005001234.html"));
        assertEquals("98765", CapturaService.codigoDe(Loja.KABUM, null, "https://www.kabum.com.br/produto/98765/mouse"));
        assertNull(CapturaService.codigoDe(Loja.SHEIN, null, "https://br.shein.com/"));
    }
}
