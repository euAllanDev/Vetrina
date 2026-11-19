package br.com.erp.afiliado;

import br.com.erp.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Loja parceira (onde o cliente finaliza a compra pelo link de afiliado). */
@Entity
@Table(name = "parceiros")
@Getter
@Setter
public class Parceiro extends BaseEntity {

    @Column(nullable = false, unique = true, length = 60)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RedeAfiliado rede = RedeAfiliado.OUTRA;

    /** Cor da etiqueta da loja na vitrine (#RRGGBB). */
    @Column(length = 7)
    private String cor;

    @Column(length = 255)
    private String site;

    /** Awin: ID do anunciante (awinmid). Com o ID de publisher configurado, o link de afiliado é montado sozinho. */
    @Column(length = 20)
    private String awinMerchantId;

    @Column(nullable = false)
    private boolean ativo = true;
}
