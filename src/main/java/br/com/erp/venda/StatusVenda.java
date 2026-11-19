package br.com.erp.venda;

public enum StatusVenda {
    /** Ainda editável; não movimenta estoque nem financeiro. */
    ORCAMENTO,
    /** Estoque baixado e títulos gerados. */
    CONFIRMADA,
    /** NF-e autorizada. */
    FATURADA,
    CANCELADA
}
