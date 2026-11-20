package br.com.erp.alerta;

/** Publicado quando o preço de uma oferta muda (captura, painel ou robô). */
public record PrecoMudou(Long produtoId) {
}
