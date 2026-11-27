package br.com.erp.anuncio;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Imagem do banner, em tabela separada para a lista não carregar os bytes. */
@Entity
@Table(name = "banner_imagens")
@Getter
@Setter
public class BannerImagem {

    @Id
    private Long bannerId;

    @Column(nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] dados;
}
