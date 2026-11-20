package br.com.erp.integracao;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class MercadoLivreClientTest {

    @Test
    void produtoDeCatalogo() {
        assertEquals("P:MLB1055308620", MercadoLivreClient.codigoDaUrl(
                "https://www.mercadolivre.com.br/iphone-17-pro-max-256gb-laranja-cosmico-distribuidor-autorizado/p/MLB1055308620?matt_event_ts=1"));
    }

    @Test
    void anuncioDentroDeProdutoDeUsuario() {
        assertEquals("MLB7580437092", MercadoLivreClient.codigoDaUrl(
                "https://www.mercadolivre.com.br/kit-4-shorts/up/MLBU5098430962?pdp_filters=item_id%3AMLB7580437092&matt_event_ts=1"));
    }

    @Test
    void anuncioClassico() {
        assertEquals("MLB1234567890", MercadoLivreClient.codigoDaUrl(
                "https://produto.mercadolivre.com.br/MLB-1234567890-tenis-corrida-_JM"));
    }

    @Test
    void semCodigo() {
        assertNull(MercadoLivreClient.codigoDaUrl("https://www.mercadolivre.com.br/kit-4-shorts/up/MLBU5098430962"));
        assertNull(MercadoLivreClient.codigoDaUrl("https://meli.la/1uXbTcG"));
        assertNull(MercadoLivreClient.codigoDaUrl(null));
    }
}
