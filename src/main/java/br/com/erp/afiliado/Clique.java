package br.com.erp.afiliado;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Um clique em "Ver na loja". Não guarda dados pessoais do visitante. */
@Entity
@Table(name = "cliques", indexes = @Index(name = "ix_clique_data", columnList = "criado_em"))
@Getter
@Setter
@NoArgsConstructor
public class Clique {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ofertaId;

    @Column(nullable = false)
    private Long produtoId;

    @Column(nullable = false)
    private Long parceiroId;

    @Column(name = "criado_em", nullable = false)
    private LocalDateTime criadoEm;

    public Clique(Oferta o) {
        this.ofertaId = o.getId();
        this.produtoId = o.getProduto().getId();
        this.parceiroId = o.getParceiro().getId();
        this.criadoEm = LocalDateTime.now();
    }
}
