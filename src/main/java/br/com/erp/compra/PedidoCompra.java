package br.com.erp.compra;

import br.com.erp.common.BaseEntity;
import br.com.erp.fornecedor.Fornecedor;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "pedidos_compra")
@Getter
@Setter
public class PedidoCompra extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Fornecedor fornecedor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private StatusCompra status = StatusCompra.ABERTO;

    private LocalDate previsaoEntrega;

    private LocalDateTime dataRecebimento;

    @Column(length = 20)
    private String numeroNotaFornecedor;

    @Column(nullable = false)
    private Integer quantidadeParcelas = 1;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorFrete = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorTotal = BigDecimal.ZERO;

    @Column(length = 500)
    private String observacao;

    @Column(nullable = false, length = 160)
    private String usuario;

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<ItemCompra> itens = new ArrayList<>();

    public void adicionarItem(ItemCompra item) {
        item.setPedido(this);
        itens.add(item);
    }
}
