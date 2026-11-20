package br.com.erp.produto;

import br.com.erp.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@jakarta.persistence.EntityListeners(br.com.erp.catalogo.CatalogoInvalidador.class)
@Table(name = "produtos")
@Getter
@Setter
public class Produto extends BaseEntity {

    /** Código interno / SKU. */
    @Column(nullable = false, unique = true, length = 60)
    private String codigo;

    @Column(nullable = false, length = 120)
    private String descricao;

    /** GTIN/EAN (código de barras). */
    @Column(length = 14)
    private String ean;

    @ManyToOne(fetch = FetchType.LAZY)
    private Categoria categoria;

    @Column(nullable = false, length = 6)
    private String unidade = "UN";

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal precoCusto = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal precoVenda = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal estoqueAtual = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal estoqueMinimo = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean ativo = true;

    // ---- Dados fiscais ----
    @Column(length = 8)
    private String ncm;

    @Column(length = 7)
    private String cest;

    @Column(nullable = false, length = 4)
    private String cfop = "5102";

    /** Origem da mercadoria (0 = nacional). */
    @Column(nullable = false)
    private Integer origem = 0;

    /** CST (regime normal, ex.: "00") ou CSOSN (Simples, ex.: "102"). */
    @Column(nullable = false, length = 3)
    private String cstIcms = "102";

    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaIcms = BigDecimal.ZERO;

    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaIpi = BigDecimal.ZERO;

    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaPis = BigDecimal.ZERO;

    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaCofins = BigDecimal.ZERO;

    /** Preço "de" exibido riscado na loja quando maior que o preço de venda (promoção). */
    @Column(precision = 15, scale = 2)
    private BigDecimal precoAnterior;

    /** Texto livre para a página do produto na loja. */
    @Column(columnDefinition = "text")
    private String detalhes;

    /** Quando a foto foi enviada (nulo = sem foto). Também serve para invalidar o cache da imagem. */
    private LocalDateTime imagemAtualizadaEm;

    /** Controle de concorrência otimista (evita duas vendas simultâneas furarem o estoque). */
    @Version
    private Long versao;

    public boolean abaixoDoMinimo() {
        return estoqueAtual.compareTo(estoqueMinimo) <= 0;
    }
}
