package br.com.erp.estoque;

import br.com.erp.common.BaseEntity;
import br.com.erp.produto.Produto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "movimentacoes_estoque", indexes = @Index(name = "idx_mov_produto", columnList = "produto_id"))
@Getter
@Setter
public class MovimentacaoEstoque extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Produto produto;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TipoMovimentacao tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrigemMovimentacao origem;

    /** Id do documento de origem (venda, pedido de compra...). */
    private Long referenciaId;

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal quantidade;

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal saldoAnterior;

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal saldoPosterior;

    @Column(precision = 15, scale = 4)
    private BigDecimal custoUnitario;

    @Column(length = 255)
    private String observacao;

    @Column(nullable = false, length = 160)
    private String usuario;
}
