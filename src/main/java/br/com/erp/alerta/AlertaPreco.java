package br.com.erp.alerta;

import br.com.erp.common.BaseEntity;
import br.com.erp.produto.Produto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** "Me avise quando baixar": um navegador (inscrição de push) acompanhando o preço de um produto. */
@Entity
@Table(name = "alertas_preco", uniqueConstraints = @UniqueConstraint(columnNames = {"produto_id", "endpoint"}),
        indexes = @Index(columnList = "produto_id, ativo"))
@Getter
@Setter
public class AlertaPreco extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produto_id", nullable = false)
    private Produto produto;

    @Column(nullable = false, length = 1000)
    private String endpoint;

    @Column(nullable = false, length = 200)
    private String p256dh;

    @Column(nullable = false, length = 100)
    private String auth;

    /** Preço quando a pessoa pediu o aviso (ou do último aviso): só avisa se ficar abaixo disto. */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal precoReferencia;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean ativo = true;

    private LocalDateTime avisadoEm;

    private int avisos;
}
