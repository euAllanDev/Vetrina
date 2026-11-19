package br.com.erp.fiscal;

import br.com.erp.produto.Produto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Snapshot fiscal do item no momento da emissão (não muda se o cadastro do produto mudar). */
@Entity
@Table(name = "itens_nota_fiscal")
@Getter
@Setter
public class ItemNotaFiscal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private NotaFiscal notaFiscal;

    @ManyToOne(fetch = FetchType.LAZY)
    private Produto produto;

    @Column(nullable = false)
    private Integer numeroItem;

    @Column(nullable = false, length = 60)
    private String codigo;
    @Column(nullable = false, length = 120)
    private String descricao;
    @Column(length = 14)
    private String ean;
    @Column(length = 8)
    private String ncm;
    @Column(length = 7)
    private String cest;
    @Column(nullable = false, length = 4)
    private String cfop;
    @Column(nullable = false, length = 6)
    private String unidade;

    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal quantidade;
    @Column(nullable = false, precision = 15, scale = 4)
    private BigDecimal valorUnitario;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorBruto;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorDesconto;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorFrete;

    @Column(nullable = false)
    private Integer origem;
    @Column(nullable = false, length = 3)
    private String cstIcms;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal baseIcms;
    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaIcms;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorIcms;

    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaIpi;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorIpi;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal basePisCofins;
    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaPis;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorPis;
    @Column(nullable = false, precision = 7, scale = 4)
    private BigDecimal aliquotaCofins;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorCofins;

    /** Valor líquido do item: bruto - desconto + frete. */
    public BigDecimal valorLiquido() {
        return valorBruto.subtract(valorDesconto).add(valorFrete);
    }
}
