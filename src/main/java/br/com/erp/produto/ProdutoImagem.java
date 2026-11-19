package br.com.erp.produto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Foto do produto, guardada em tabela separada para a listagem de produtos não carregar os bytes. */
@Entity
@Table(name = "produto_imagens")
@Getter
@Setter
public class ProdutoImagem {

    @Id
    private Long produtoId;

    @Column(nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] dados;

    @Column(nullable = false)
    private LocalDateTime atualizadoEm;
}
