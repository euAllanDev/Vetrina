package br.com.erp.fiscal;

import br.com.erp.cliente.Cliente;
import br.com.erp.common.BaseEntity;
import br.com.erp.venda.Venda;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "notas_fiscais", uniqueConstraints = @UniqueConstraint(name = "uk_nf_serie_numero", columnNames = {"serie", "numero"}))
@Getter
@Setter
public class NotaFiscal extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Venda venda;

    @ManyToOne(fetch = FetchType.LAZY)
    private Cliente cliente;

    @Column(nullable = false, length = 2)
    private String modelo = "55";

    @Column(nullable = false)
    private Integer serie;

    @Column(nullable = false)
    private Integer numero;

    @Column(nullable = false, unique = true, length = 44)
    private String chaveAcesso;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private StatusNotaFiscal status;

    /** 1 = Produção, 2 = Homologação. */
    @Column(nullable = false)
    private Integer ambiente;

    @Column(nullable = false, length = 60)
    private String naturezaOperacao;

    @Column(nullable = false)
    private LocalDateTime dataEmissao;

    private LocalDateTime dataAutorizacao;

    @Column(length = 20)
    private String protocolo;

    @Column(length = 255)
    private String motivoStatus;

    private LocalDateTime dataCancelamento;

    @Column(length = 20)
    private String protocoloCancelamento;

    @Column(length = 255)
    private String justificativaCancelamento;

    @Column(length = 2000)
    private String informacoesComplementares;

    // ---- Totais ----
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorProdutos;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorDesconto;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorFrete;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal baseIcms;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorIcms;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorIpi;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorPis;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorCofins;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorTotal;

    /** XML da NF-e (layout 4.00). */
    @Column(columnDefinition = "text")
    private String xml;

    @OneToMany(mappedBy = "notaFiscal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("numeroItem")
    private List<ItemNotaFiscal> itens = new ArrayList<>();

    public void adicionarItem(ItemNotaFiscal item) {
        item.setNotaFiscal(this);
        itens.add(item);
    }
}
