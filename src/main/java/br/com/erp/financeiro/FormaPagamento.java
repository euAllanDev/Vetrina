package br.com.erp.financeiro;

import lombok.Getter;

@Getter
public enum FormaPagamento {
    DINHEIRO(true, "01"),
    CHEQUE(false, "02"),
    CARTAO_CREDITO(false, "03"),
    CARTAO_DEBITO(true, "04"),
    CREDIARIO(false, "05"),
    BOLETO(false, "15"),
    PIX(true, "17"),
    TRANSFERENCIA(true, "18");

    /** À vista: o título já nasce quitado. */
    private final boolean aVista;

    /** Código tPag da NF-e. */
    private final String codigoNfe;

    FormaPagamento(boolean aVista, String codigoNfe) {
        this.aVista = aVista;
        this.codigoNfe = codigoNfe;
    }
}
