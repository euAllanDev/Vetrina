package br.com.erp.fornecedor;

import br.com.erp.common.BaseEntity;
import br.com.erp.common.Endereco;
import br.com.erp.common.TipoPessoa;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "fornecedores")
@Getter
@Setter
public class Fornecedor extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TipoPessoa tipoPessoa;

    @Column(nullable = false, length = 120)
    private String razaoSocial;

    @Column(length = 120)
    private String nomeFantasia;

    @Column(nullable = false, unique = true, length = 14)
    private String documento;

    @Column(length = 20)
    private String inscricaoEstadual;

    private String email;
    private String telefone;
    private String contato;

    @Embedded
    private Endereco endereco = new Endereco();

    @Column(nullable = false)
    private boolean ativo = true;
}
