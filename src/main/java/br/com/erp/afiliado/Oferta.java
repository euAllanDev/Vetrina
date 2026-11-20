package br.com.erp.afiliado;

import br.com.erp.common.BaseEntity;
import br.com.erp.produto.Produto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Um produto à venda numa loja parceira, com o link de afiliado e o último preço conferido. */
@Entity
@Table(name = "ofertas", indexes = {
        @Index(name = "ix_oferta_produto", columnList = "produto_id"),
        @Index(name = "ix_oferta_parceiro", columnList = "parceiro_id")
})
@Getter
@Setter
public class Oferta extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produto_id", nullable = false)
    private Produto produto;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "parceiro_id", nullable = false)
    private Parceiro parceiro;

    /** Link de afiliado (é para cá que o "Ver na loja" leva). */
    @Column(nullable = false, length = 2000)
    private String url;

    /** Endereço original do produto na loja (sem afiliado), para conferência. */
    @Column(length = 2000)
    private String urlProduto;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal preco;

    @Column(precision = 15, scale = 2)
    private BigDecimal precoAnterior;

    /** Valor do frete; 0 = frete grátis; vazio = não informado. */
    @Column(precision = 15, scale = 2)
    private BigDecimal frete;

    /** Ex.: "10x sem juros". Texto livre copiado da loja. */
    @Column(length = 60)
    private String parcelamento;

    /** Nota média na loja (0 a 5) e quantidade de avaliações, quando a loja informa. */
    @Column(precision = 2, scale = 1)
    private BigDecimal nota;

    private Integer avaliacoes;

    @Column(nullable = false)
    private boolean disponivel = true;

    @Column(nullable = false)
    private boolean ativo = true;

    /** Quando o preço foi conferido pela última vez. */
    private LocalDateTime verificadoEm;

    @Column(nullable = false)
    private long cliques;

    /** Código do anúncio/produto na loja (ex.: MLB123... no Mercado Livre), usado pelo robô de preços. */
    @Column(length = 40)
    private String codigoExterno;

    /** Se o robô deve atualizar preço e disponibilidade sozinho. (default no banco: tabelas já com dados) */
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean atualizacaoAuto = true;

    private LocalDateTime sincronizadoEm;

    @Column(length = 255)
    private String erroSincronizacao;

    /** Preço antes da última queda (para o selo "Baixou"). */
    @Column(precision = 15, scale = 2)
    private BigDecimal precoBaixouDe;

    private LocalDateTime baixouEm;
}
