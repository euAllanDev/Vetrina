package br.com.erp.afiliado;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "historico_precos", indexes = @Index(name = "ix_hist_oferta_data", columnList = "oferta_id, registrado_em"))
@Getter
@Setter
@NoArgsConstructor
public class HistoricoPreco {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "oferta_id", nullable = false)
    private Oferta oferta;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal preco;

    @Column(name = "registrado_em", nullable = false)
    private LocalDateTime registradoEm;

    public HistoricoPreco(Oferta oferta, BigDecimal preco) {
        this.oferta = oferta;
        this.preco = preco;
        this.registradoEm = LocalDateTime.now();
    }
}
