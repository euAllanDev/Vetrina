package br.com.erp.catalogo;

import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Avisa que algo da vitrine mudou (produto, categoria, oferta, loja parceira ou dados da empresa),
 * para o catálogo guardado em memória ser montado de novo na próxima visita.
 * Contagem de cliques (update em massa) não passa por aqui, então não invalida à toa.
 */
public class CatalogoInvalidador {

    static final AtomicLong VERSAO = new AtomicLong();

    @PostPersist
    @PostUpdate
    @PostRemove
    void mudou(Object entidade) {
        VERSAO.incrementAndGet();
    }

    public static void invalidar() {
        VERSAO.incrementAndGet();
    }
}
