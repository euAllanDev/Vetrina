package br.com.erp.financeiro;

import br.com.erp.cliente.Cliente;
import br.com.erp.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "contas_receber", indexes = {
        @Index(name = "idx_cr_vencimento", columnList = "vencimento"),
        @Index(name = "idx_cr_venda", columnList = "venda_id")})
@Getter
@Setter
public class ContaReceber extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    private Cliente cliente;

    /** Venda de origem (opcional; títulos avulsos não têm). */
    @Column(name = "venda_id")
    private Long vendaId;

    @Column(nullable = false, length = 160)
    private String descricao;

    @Column(nullable = false)
    private Integer numeroParcela = 1;

    @Column(nullable = false)
    private Integer totalParcelas = 1;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valor;

    @Column(precision = 15, scale = 2)
    private BigDecimal valorRecebido;

    @Column(nullable = false)
    private LocalDate vencimento;

    private LocalDate dataRecebimento;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private FormaPagamento formaPagamento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private StatusTitulo status = StatusTitulo.ABERTO;

    @Column(length = 255)
    private String observacao;
}
