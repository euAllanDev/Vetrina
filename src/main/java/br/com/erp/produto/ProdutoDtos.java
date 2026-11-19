package br.com.erp.produto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class ProdutoDtos {

    private ProdutoDtos() {
    }

    public record CategoriaRequest(@NotBlank @Size(max = 80) String nome, @Size(max = 255) String descricao, Boolean ativo) {
    }

    public record CategoriaResponse(Long id, String nome, String descricao, boolean ativo) {
        public static CategoriaResponse from(Categoria c) {
            return new CategoriaResponse(c.getId(), c.getNome(), c.getDescricao(), c.isAtivo());
        }
    }

    public record ProdutoRequest(
            @NotBlank @Size(max = 60) String codigo,
            @NotBlank @Size(max = 120) String descricao,
            @Pattern(regexp = "\\d{8}|\\d{12,14}", message = "EAN deve ter 8, 12, 13 ou 14 dígitos") String ean,
            Long categoriaId,
            @Size(max = 6) String unidade,
            @NotNull @PositiveOrZero BigDecimal precoCusto,
            @NotNull @PositiveOrZero BigDecimal precoVenda,
            @PositiveOrZero BigDecimal estoqueMinimo,
            @PositiveOrZero BigDecimal estoqueInicial,
            Boolean ativo,
            @Pattern(regexp = "\\d{8}", message = "NCM deve ter 8 dígitos") String ncm,
            @Pattern(regexp = "\\d{7}", message = "CEST deve ter 7 dígitos") String cest,
            @Pattern(regexp = "\\d{4}", message = "CFOP deve ter 4 dígitos") String cfop,
            @Min(0) @Max(8) Integer origem,
            @Pattern(regexp = "\\d{2,3}", message = "CST/CSOSN inválido") String cstIcms,
            @DecimalMin("0") @DecimalMax("100") BigDecimal aliquotaIcms,
            @DecimalMin("0") @DecimalMax("100") BigDecimal aliquotaIpi,
            @DecimalMin("0") @DecimalMax("100") BigDecimal aliquotaPis,
            @DecimalMin("0") @DecimalMax("100") BigDecimal aliquotaCofins,
            @PositiveOrZero BigDecimal precoAnterior,
            @Size(max = 4000) String detalhes) {
    }

    public record ProdutoResponse(
            Long id, String codigo, String descricao, String ean, Long categoriaId, String categoriaNome,
            String unidade, BigDecimal precoCusto, BigDecimal precoVenda, BigDecimal estoqueAtual,
            BigDecimal estoqueMinimo, boolean abaixoDoMinimo, boolean ativo, String ncm, String cest, String cfop,
            Integer origem, String cstIcms, BigDecimal aliquotaIcms, BigDecimal aliquotaIpi,
            BigDecimal aliquotaPis, BigDecimal aliquotaCofins, String imagemUrl, BigDecimal precoAnterior, String detalhes,
            LocalDateTime criadoEm) {

        public static ProdutoResponse from(Produto p) {
            Categoria c = p.getCategoria();
            return new ProdutoResponse(p.getId(), p.getCodigo(), p.getDescricao(), p.getEan(),
                    c == null ? null : c.getId(), c == null ? null : c.getNome(),
                    p.getUnidade(), p.getPrecoCusto(), p.getPrecoVenda(), p.getEstoqueAtual(), p.getEstoqueMinimo(),
                    p.abaixoDoMinimo(), p.isAtivo(), p.getNcm(), p.getCest(), p.getCfop(), p.getOrigem(),
                    p.getCstIcms(), p.getAliquotaIcms(), p.getAliquotaIpi(), p.getAliquotaPis(), p.getAliquotaCofins(),
                    p.getImagemAtualizadaEm() == null ? null
                            : "/api/produtos/" + p.getId() + "/imagem?v=" + p.getImagemAtualizadaEm().toEpochSecond(java.time.ZoneOffset.UTC),
                    p.getPrecoAnterior(), p.getDetalhes(), p.getCriadoEm());
        }
    }
}
