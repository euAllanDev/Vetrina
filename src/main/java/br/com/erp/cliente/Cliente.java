package br.com.erp.cliente;

import br.com.erp.common.BaseEntity;
import br.com.erp.common.Endereco;
import br.com.erp.common.TipoPessoa;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "clientes")
@Getter
@Setter
public class Cliente extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TipoPessoa tipoPessoa;

    @Column(nullable = false, length = 120)
    private String nome;

    @Column(nullable = false, unique = true, length = 14)
    private String documento;

    @Column(length = 20)
    private String inscricaoEstadual;

    private String email;
    private String telefone;

    @Embedded
    private Endereco endereco = new Endereco();

    /** Limite para vendas a prazo (0 = sem limite). */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal limiteCredito = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean ativo = true;
}
