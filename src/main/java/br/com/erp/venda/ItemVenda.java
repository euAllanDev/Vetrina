package br.com.erp.venda;

import br.com.erp.produto.Produto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "itens_venda")
@Getter
@Setter
public class ItemVenda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Venda venda;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Produto produto;

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal quantidade;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal precoUnitario;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorDesconto = BigDecimal.ZERO;

    /** quantidade * precoUnitario - valorDesconto */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    /** Custo no momento da venda, para cálculo de margem. */
    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal custoUnitario = BigDecimal.ZERO;

    public BigDecimal valorBruto() {
        return quantidade.multiply(precoUnitario);
    }
}
