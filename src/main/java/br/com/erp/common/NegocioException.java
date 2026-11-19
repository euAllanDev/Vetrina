package br.com.erp.common;

/** Violação de regra de negócio (HTTP 422). */
public class NegocioException extends RuntimeException {

    public NegocioException(String mensagem) {
        super(mensagem);
    }
}
