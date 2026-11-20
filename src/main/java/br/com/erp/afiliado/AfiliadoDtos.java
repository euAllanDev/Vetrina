package br.com.erp.afiliado;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AfiliadoDtos {

    private AfiliadoDtos() {
    }

    public record ParceiroRequest(
            @NotBlank @Size(max = 60) String nome,
            @NotNull RedeAfiliado rede,
            @Pattern(regexp = "#[0-9a-fA-F]{6}", message = "Cor no formato #RRGGBB") String cor,
            @Size(max = 255) String site,
            @Pattern(regexp = "\\d{1,20}", message = "ID do anunciante Awin deve ser numérico") String awinMerchantId,
            Boolean ativo) {
    }

    public record ParceiroResponse(Long id, String nome, RedeAfiliado rede, String cor, String site,
                                   String awinMerchantId, boolean ativo, long ofertas) {
        static ParceiroResponse from(Parceiro p, long ofertas) {
            return new ParceiroResponse(p.getId(), p.getNome(), p.getRede(), p.getCor(), p.getSite(),
                    p.getAwinMerchantId(), p.isAtivo(), ofertas);
        }
    }

    public record OfertaRequest(
            @NotNull Long parceiroId,
            @Size(max = 2000) String url,
            @Size(max = 2000) String urlProduto,
            @NotNull @Positive BigDecimal preco,
            @PositiveOrZero BigDecimal precoAnterior,
            @PositiveOrZero BigDecimal frete,
            @Size(max = 60) String parcelamento,
            @DecimalMin("0") @DecimalMax("5") BigDecimal nota,
            @PositiveOrZero Integer avaliacoes,
            Boolean disponivel,
            Boolean ativo,
            @Size(max = 40) String codigoExterno,
            Boolean atualizacaoAuto) {
    }

    public record OfertaResponse(Long id, Long produtoId, Long parceiroId, String parceiroNome, String parceiroCor,
                                 RedeAfiliado rede, String url, String urlProduto, BigDecimal preco,
                                 BigDecimal precoAnterior, BigDecimal frete, String parcelamento, BigDecimal nota,
                                 Integer avaliacoes, boolean disponivel, boolean ativo, LocalDateTime verificadoEm,
                                 long cliques, String codigoExterno, boolean atualizacaoAuto, LocalDateTime sincronizadoEm,
                                 String erroSincronizacao) {
        static OfertaResponse from(Oferta o) {
            Parceiro p = o.getParceiro();
            return new OfertaResponse(o.getId(), o.getProduto().getId(), p.getId(), p.getNome(), p.getCor(), p.getRede(),
                    o.getUrl(), o.getUrlProduto(), o.getPreco(), o.getPrecoAnterior(), o.getFrete(), o.getParcelamento(),
                    o.getNota(), o.getAvaliacoes(), o.isDisponivel(), o.isAtivo(), o.getVerificadoEm(), o.getCliques(),
                    o.getCodigoExterno(), o.isAtualizacaoAuto(), o.getSincronizadoEm(), o.getErroSincronizacao());
        }
    }

    /** Ponto do gráfico: menor preço entre as lojas naquele dia. */
    public record PontoPreco(LocalDate dia, BigDecimal preco) {
    }

    public record HistoricoResponse(List<PontoPreco> pontos, BigDecimal menor, BigDecimal maior, BigDecimal atual,
                                    boolean menorPrecoDoPeriodo, int dias) {
    }

    public record CliquesParceiro(Long parceiroId, String nome, String cor, long cliques) {
    }

    public record CliquesProduto(Long produtoId, String nome, long cliques) {
    }

    public record CliquesDia(LocalDate dia, long cliques) {
    }

    public record RelatorioCliques(int dias, long total, List<CliquesDia> porDia, List<CliquesParceiro> porParceiro,
                                   List<CliquesProduto> topProdutos) {
    }
}
