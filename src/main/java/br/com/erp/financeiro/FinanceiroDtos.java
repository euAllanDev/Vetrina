package br.com.erp.financeiro;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class FinanceiroDtos {

    private FinanceiroDtos() {
    }

    public record ContaReceberRequest(
            Long clienteId,
            @NotBlank @Size(max = 160) String descricao,
            @NotNull @Positive BigDecimal valor,
            @NotNull LocalDate vencimento,
            FormaPagamento formaPagamento,
            @Size(max = 255) String observacao) {
    }

    public record ContaPagarRequest(
            Long fornecedorId,
            @NotBlank @Size(max = 160) String descricao,
            @Size(max = 60) String categoria,
            @NotNull @Positive BigDecimal valor,
            @NotNull LocalDate vencimento,
            FormaPagamento formaPagamento,
            @Size(max = 255) String observacao) {
    }

    /** Baixa de título. Valor e data são opcionais (padrão: valor do título e hoje). */
    public record BaixaRequest(@Positive BigDecimal valor, LocalDate data, FormaPagamento formaPagamento) {
    }

    public record ContaReceberResponse(
            Long id, Long clienteId, String clienteNome, Long vendaId, String descricao, Integer numeroParcela,
            Integer totalParcelas, BigDecimal valor, BigDecimal valorRecebido, LocalDate vencimento,
            LocalDate dataRecebimento, FormaPagamento formaPagamento, StatusTitulo status, boolean vencida,
            String observacao) {

        public static ContaReceberResponse from(ContaReceber c) {
            boolean vencida = c.getStatus() == StatusTitulo.ABERTO && c.getVencimento().isBefore(LocalDate.now());
            return new ContaReceberResponse(c.getId(),
                    c.getCliente() == null ? null : c.getCliente().getId(),
                    c.getCliente() == null ? null : c.getCliente().getNome(),
                    c.getVendaId(), c.getDescricao(), c.getNumeroParcela(), c.getTotalParcelas(), c.getValor(),
                    c.getValorRecebido(), c.getVencimento(), c.getDataRecebimento(), c.getFormaPagamento(),
                    c.getStatus(), vencida, c.getObservacao());
        }
    }

    public record ContaPagarResponse(
            Long id, Long fornecedorId, String fornecedorNome, Long compraId, String descricao, String categoria,
            Integer numeroParcela, Integer totalParcelas, BigDecimal valor, BigDecimal valorPago,
            LocalDate vencimento, LocalDate dataPagamento, FormaPagamento formaPagamento, StatusTitulo status,
            boolean vencida, String observacao) {

        public static ContaPagarResponse from(ContaPagar c) {
            boolean vencida = c.getStatus() == StatusTitulo.ABERTO && c.getVencimento().isBefore(LocalDate.now());
            return new ContaPagarResponse(c.getId(),
                    c.getFornecedor() == null ? null : c.getFornecedor().getId(),
                    c.getFornecedor() == null ? null : c.getFornecedor().getRazaoSocial(),
                    c.getCompraId(), c.getDescricao(), c.getCategoria(), c.getNumeroParcela(), c.getTotalParcelas(),
                    c.getValor(), c.getValorPago(), c.getVencimento(), c.getDataPagamento(), c.getFormaPagamento(),
                    c.getStatus(), vencida, c.getObservacao());
        }
    }

    public record FluxoCaixaResponse(
            LocalDate inicio, LocalDate fim,
            BigDecimal recebido, BigDecimal pago, BigDecimal saldoRealizado,
            BigDecimal aReceber, BigDecimal aPagar, BigDecimal saldoPrevisto) {
    }
}
