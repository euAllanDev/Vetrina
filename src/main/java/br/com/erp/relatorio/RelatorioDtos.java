package br.com.erp.relatorio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class RelatorioDtos {

    private RelatorioDtos() {
    }

    public record Periodo(long quantidadeVendas, BigDecimal faturamento, BigDecimal ticketMedio) {
        public static Periodo de(ResumoVendas r) {
            return new Periodo(r.quantidade(), r.total(), r.ticketMedio());
        }
    }

    public record DashboardResponse(
            Periodo hoje,
            Periodo mesAtual,
            long produtosAbaixoDoMinimo,
            BigDecimal valorEstoqueCusto,
            BigDecimal receberVencido,
            BigDecimal receberProximos7Dias,
            BigDecimal pagarVencido,
            BigDecimal pagarProximos7Dias,
            List<ProdutoVendido> topProdutosMes) {
    }

    public record VendaDia(LocalDate dia, long quantidade, BigDecimal total) {
    }

    public record RelatorioVendasResponse(LocalDate inicio, LocalDate fim, Periodo totais, List<VendaDia> porDia) {
    }

    public record CurvaAbcItem(Long produtoId, String codigo, String descricao, BigDecimal quantidade,
                               BigDecimal faturamento, BigDecimal lucroBruto, BigDecimal percentual,
                               BigDecimal percentualAcumulado, String classe) {
    }
}
