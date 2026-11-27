package br.com.erp.anuncio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Banner próprio da loja (campanha de loja parceira, página especial…), com período e posição na tela. */
@Entity
@Table(name = "banners")
@Getter
@Setter
public class Banner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String titulo;

    /** Para onde o banner leva (link de afiliado ou página da própria loja, ex.: /loja/s/natal). */
    @Column(nullable = false, length = 1000)
    private String link;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PosicaoAnuncio posicao;

    private LocalDate inicio;

    private LocalDate fim;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean ativo = true;

    @Column(nullable = false, columnDefinition = "integer default 0")
    private int ordem;

    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long cliques;

    private LocalDateTime imagemAtualizadaEm;

    @Column(nullable = false)
    private LocalDateTime criadoEm = LocalDateTime.now();
}
