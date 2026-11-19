package br.com.erp.relatorio;

import br.com.erp.common.Valores;

import java.math.BigDecimal;

/** Usado em consulta JPQL com "select new" (count -> Long, sum(BigDecimal) -> BigDecimal). */
public record ResumoVendas(Long quantidade, BigDecimal total) {

    public ResumoVendas {
        quantidade = quantidade == null ? 0L : quantidade;
        total = Valores.moeda(total);
    }

    public BigDecimal ticketMedio() {
        return quantidade == 0 ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(quantidade), 2, java.math.RoundingMode.HALF_EVEN);
    }
}
