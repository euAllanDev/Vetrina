package br.com.erp.venda;

import br.com.erp.financeiro.FormaPagamento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class VendaDtos {

    private VendaDtos() {
    }

    public record ItemVendaRequest(
            @NotNull Long produtoId,
            @NotNull @Positive BigDecimal quantidade,
            /* Opcional: se ausente, usa o preço de venda do cadastro. */
            @PositiveOrZero BigDecimal precoUnitario,
            @PositiveOrZero BigDecimal valorDesconto) {
    }

    public record VendaRequest(
            Long clienteId,
            @NotNull FormaPagamento formaPagamento,
            @Min(1) @Max(24) Integer quantidadeParcelas,
            @PositiveOrZero BigDecimal valorDesconto,
            @PositiveOrZero BigDecimal valorFrete,
            @Size(max = 500) String observacao,
            @NotEmpty @Valid List<ItemVendaRequest> itens) {
    }

    public record CancelamentoRequest(@NotBlank @Size(min = 5, max = 255) String motivo) {
    }

    public record ItemVendaResponse(Long id, Long produtoId, String produtoCodigo, String produtoDescricao,
                                    String unidade, BigDecimal quantidade, BigDecimal precoUnitario,
                                    BigDecimal valorDesconto, BigDecimal subtotal) {
        public static ItemVendaResponse from(ItemVenda i) {
            return new ItemVendaResponse(i.getId(), i.getProduto().getId(), i.getProduto().getCodigo(),
                    i.getProduto().getDescricao(), i.getProduto().getUnidade(), i.getQuantidade(),
                    i.getPrecoUnitario(), i.getValorDesconto(), i.getSubtotal());
        }
    }

    public record VendaResponse(
            Long id, Long clienteId, String clienteNome, String vendedor, StatusVenda status,
            FormaPagamento formaPagamento, Integer quantidadeParcelas, BigDecimal subtotal, BigDecimal valorDesconto,
            BigDecimal valorFrete, BigDecimal valorTotal, LocalDateTime criadoEm, LocalDateTime dataConfirmacao,
            LocalDateTime dataCancelamento, String motivoCancelamento, String observacao,
            List<ItemVendaResponse> itens) {

        public static VendaResponse from(Venda v) {
            return new VendaResponse(v.getId(),
                    v.getCliente() == null ? null : v.getCliente().getId(),
                    v.getCliente() == null ? "CONSUMIDOR FINAL" : v.getCliente().getNome(),
                    v.getVendedor(), v.getStatus(), v.getFormaPagamento(), v.getQuantidadeParcelas(),
                    v.getSubtotal(), v.getValorDesconto(), v.getValorFrete(), v.getValorTotal(), v.getCriadoEm(),
                    v.getDataConfirmacao(), v.getDataCancelamento(), v.getMotivoCancelamento(), v.getObservacao(),
                    v.getItens().stream().map(ItemVendaResponse::from).toList());
        }
    }
}
