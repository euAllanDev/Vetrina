package br.com.erp.financeiro;

import br.com.erp.common.BaseEntity;
import br.com.erp.fornecedor.Fornecedor;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "contas_pagar", indexes = {
        @Index(name = "idx_cp_vencimento", columnList = "vencimento"),
        @Index(name = "idx_cp_compra", columnList = "compra_id")})
@Getter
@Setter
public class ContaPagar extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    private Fornecedor fornecedor;

    /** Pedido de compra de origem (opcional). */
    @Column(name = "compra_id")
    private Long compraId;

    @Column(nullable = false, length = 160)
    private String descricao;

    /** Categoria de despesa livre: "Mercadorias", "Aluguel", "Energia"... */
    @Column(length = 60)
    private String categoria;

    @Column(nullable = false)
    private Integer numeroParcela = 1;

    @Column(nullable = false)
    private Integer totalParcelas = 1;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valor;

    @Column(precision = 15, scale = 2)
    private BigDecimal valorPago;

    @Column(nullable = false)
    private LocalDate vencimento;

    private LocalDate dataPagamento;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private FormaPagamento formaPagamento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private StatusTitulo status = StatusTitulo.ABERTO;

    @Column(length = 255)
    private String observacao;
}
