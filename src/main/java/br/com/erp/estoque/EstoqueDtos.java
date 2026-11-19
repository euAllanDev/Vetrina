package br.com.erp.estoque;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class EstoqueDtos {

    private EstoqueDtos() {
    }

    /** Contagem de inventário: informa o saldo físico real; o sistema gera o ajuste da diferença. */
    public record InventarioRequest(
            @NotNull Long produtoId,
            @NotNull @PositiveOrZero BigDecimal quantidadeContada,
            @NotBlank @Size(max = 255) String observacao) {
    }

    public record MovimentoManualRequest(
            @NotNull Long produtoId,
            @NotNull @Positive BigDecimal quantidade,
            @PositiveOrZero BigDecimal custoUnitario,
            @NotBlank @Size(max = 255) String observacao) {
    }

    public record MovimentacaoResponse(
            Long id, Long produtoId, String produtoCodigo, String produtoDescricao, TipoMovimentacao tipo,
            OrigemMovimentacao origem, Long referenciaId, BigDecimal quantidade, BigDecimal saldoAnterior,
            BigDecimal saldoPosterior, BigDecimal custoUnitario, String observacao, String usuario,
            LocalDateTime data) {

        public static MovimentacaoResponse from(MovimentacaoEstoque m) {
            return new MovimentacaoResponse(m.getId(), m.getProduto().getId(), m.getProduto().getCodigo(),
                    m.getProduto().getDescricao(), m.getTipo(), m.getOrigem(), m.getReferenciaId(), m.getQuantidade(),
                    m.getSaldoAnterior(), m.getSaldoPosterior(), m.getCustoUnitario(), m.getObservacao(),
                    m.getUsuario(), m.getCriadoEm());
        }
    }

    public record ResumoEstoqueResponse(long produtosAtivos, long produtosAbaixoDoMinimo, BigDecimal valorTotalCusto) {
    }
}
