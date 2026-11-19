package br.com.erp.relatorio;

import br.com.erp.common.Valores;

import java.math.BigDecimal;

/** Usado em consulta JPQL com "select new". */
public record ProdutoVendido(Long produtoId, String codigo, String descricao, BigDecimal quantidade,
                             BigDecimal faturamento, BigDecimal custo) {

    public ProdutoVendido {
        faturamento = Valores.moeda(faturamento);
        custo = Valores.moeda(custo);
    }

    public BigDecimal lucroBruto() {
        return faturamento.subtract(custo);
    }
}
