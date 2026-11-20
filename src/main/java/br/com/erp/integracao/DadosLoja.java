package br.com.erp.integracao;

import java.math.BigDecimal;

/** O que a loja informa sobre um produto agora. */
public record DadosLoja(String codigo, String titulo, BigDecimal preco, BigDecimal precoAnterior,
                        Boolean freteGratis, boolean disponivel, String imagemUrl, String link) {
}
