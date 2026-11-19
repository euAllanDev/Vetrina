package br.com.erp.fiscal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class NotaFiscalDtos {

    private NotaFiscalDtos() {
    }

    public record EmitirNotaRequest(
            @NotNull Long vendaId,
            @Size(max = 60) String naturezaOperacao,
            @Size(max = 2000) String informacoesComplementares) {
    }

    /** A SEFAZ exige justificativa entre 15 e 255 caracteres. */
    public record CancelarNotaRequest(@NotBlank @Size(min = 15, max = 255) String justificativa) {
    }

    public record ItemNotaResponse(
            Integer numeroItem, String codigo, String descricao, String ncm, String cfop, String unidade,
            BigDecimal quantidade, BigDecimal valorUnitario, BigDecimal valorBruto, BigDecimal valorDesconto,
            BigDecimal valorFrete, String cstIcms, BigDecimal baseIcms, BigDecimal aliquotaIcms,
            BigDecimal valorIcms, BigDecimal valorIpi, BigDecimal valorPis, BigDecimal valorCofins) {

        public static ItemNotaResponse from(ItemNotaFiscal i) {
            return new ItemNotaResponse(i.getNumeroItem(), i.getCodigo(), i.getDescricao(), i.getNcm(), i.getCfop(),
                    i.getUnidade(), i.getQuantidade(), i.getValorUnitario(), i.getValorBruto(), i.getValorDesconto(),
                    i.getValorFrete(), i.getCstIcms(), i.getBaseIcms(), i.getAliquotaIcms(), i.getValorIcms(),
                    i.getValorIpi(), i.getValorPis(), i.getValorCofins());
        }
    }

    public record NotaFiscalResponse(
            Long id, Long vendaId, Long clienteId, String clienteNome, String modelo, Integer serie, Integer numero,
            String chaveAcesso, StatusNotaFiscal status, Integer ambiente, String naturezaOperacao,
            LocalDateTime dataEmissao, LocalDateTime dataAutorizacao, String protocolo, String motivoStatus,
            LocalDateTime dataCancelamento, String justificativaCancelamento, BigDecimal valorProdutos,
            BigDecimal valorDesconto, BigDecimal valorFrete, BigDecimal baseIcms, BigDecimal valorIcms,
            BigDecimal valorIpi, BigDecimal valorPis, BigDecimal valorCofins, BigDecimal valorTotal,
            List<ItemNotaResponse> itens) {

        public static NotaFiscalResponse from(NotaFiscal n) {
            return new NotaFiscalResponse(n.getId(), n.getVenda().getId(),
                    n.getCliente() == null ? null : n.getCliente().getId(),
                    n.getCliente() == null ? "CONSUMIDOR FINAL" : n.getCliente().getNome(),
                    n.getModelo(), n.getSerie(), n.getNumero(), n.getChaveAcesso(), n.getStatus(), n.getAmbiente(),
                    n.getNaturezaOperacao(), n.getDataEmissao(), n.getDataAutorizacao(), n.getProtocolo(),
                    n.getMotivoStatus(), n.getDataCancelamento(), n.getJustificativaCancelamento(),
                    n.getValorProdutos(), n.getValorDesconto(), n.getValorFrete(), n.getBaseIcms(), n.getValorIcms(),
                    n.getValorIpi(), n.getValorPis(), n.getValorCofins(), n.getValorTotal(),
                    n.getItens().stream().map(ItemNotaResponse::from).toList());
        }
    }
}
