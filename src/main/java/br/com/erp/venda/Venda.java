package br.com.erp.venda;

import br.com.erp.cliente.Cliente;
import br.com.erp.common.BaseEntity;
import br.com.erp.financeiro.FormaPagamento;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "vendas", indexes = @Index(name = "idx_venda_confirmacao", columnList = "data_confirmacao"))
@Getter
@Setter
public class Venda extends BaseEntity {

    /** Nulo = consumidor final não identificado. */
    @ManyToOne(fetch = FetchType.LAZY)
    private Cliente cliente;

    @Column(nullable = false, length = 160)
    private String vendedor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private StatusVenda status = StatusVenda.ORCAMENTO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormaPagamento formaPagamento;

    @Column(nullable = false)
    private Integer quantidadeParcelas = 1;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    /** Desconto geral da venda (além dos descontos por item). */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorDesconto = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorFrete = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorTotal = BigDecimal.ZERO;

    @Column(name = "data_confirmacao")
    private LocalDateTime dataConfirmacao;

    private LocalDateTime dataCancelamento;

    @Column(length = 255)
    private String motivoCancelamento;

    @Column(length = 500)
    private String observacao;

    @OneToMany(mappedBy = "venda", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<ItemVenda> itens = new ArrayList<>();

    public void adicionarItem(ItemVenda item) {
        item.setVenda(this);
        itens.add(item);
    }
}
