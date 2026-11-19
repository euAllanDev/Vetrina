package br.com.erp.compra;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class CompraDtos {

    private CompraDtos() {
    }

    public record ItemCompraRequest(
            @NotNull Long produtoId,
            @NotNull @Positive BigDecimal quantidade,
            @NotNull @PositiveOrZero BigDecimal custoUnitario) {
    }

    public record PedidoCompraRequest(
            @NotNull Long fornecedorId,
            LocalDate previsaoEntrega,
            @Min(1) @Max(48) Integer quantidadeParcelas,
            @PositiveOrZero BigDecimal valorFrete,
            @Size(max = 500) String observacao,
            @NotEmpty @Valid List<ItemCompraRequest> itens) {
    }

    public record ReceberCompraRequest(@Size(max = 20) String numeroNotaFornecedor, LocalDate primeiroVencimento) {
    }

    public record ItemCompraResponse(Long id, Long produtoId, String produtoCodigo, String produtoDescricao,
                                     BigDecimal quantidade, BigDecimal custoUnitario, BigDecimal subtotal) {
        public static ItemCompraResponse from(ItemCompra i) {
            return new ItemCompraResponse(i.getId(), i.getProduto().getId(), i.getProduto().getCodigo(),
                    i.getProduto().getDescricao(), i.getQuantidade(), i.getCustoUnitario(), i.getSubtotal());
        }
    }

    public record PedidoCompraResponse(
            Long id, Long fornecedorId, String fornecedorNome, StatusCompra status, LocalDateTime criadoEm,
            LocalDate previsaoEntrega, LocalDateTime dataRecebimento, String numeroNotaFornecedor,
            Integer quantidadeParcelas, BigDecimal valorFrete, BigDecimal valorTotal, String observacao,
            String usuario, List<ItemCompraResponse> itens) {

        public static PedidoCompraResponse from(PedidoCompra p) {
            return new PedidoCompraResponse(p.getId(), p.getFornecedor().getId(), p.getFornecedor().getRazaoSocial(),
                    p.getStatus(), p.getCriadoEm(), p.getPrevisaoEntrega(), p.getDataRecebimento(),
                    p.getNumeroNotaFornecedor(), p.getQuantidadeParcelas(), p.getValorFrete(), p.getValorTotal(),
                    p.getObservacao(), p.getUsuario(), p.getItens().stream().map(ItemCompraResponse::from).toList());
        }
    }
}
