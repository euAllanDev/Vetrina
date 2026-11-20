package br.com.erp.empresa;

import br.com.erp.common.BaseEntity;
import br.com.erp.common.Endereco;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Dados do emitente usados na NF-e. O sistema trabalha com uma empresa (registro único). */
@Entity
@jakarta.persistence.EntityListeners(br.com.erp.catalogo.CatalogoInvalidador.class)
@Table(name = "empresa")
@Getter
@Setter
public class Empresa extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String razaoSocial;

    @Column(length = 120)
    private String nomeFantasia;

    @Column(nullable = false, length = 14)
    private String cnpj;

    @Column(length = 20)
    private String inscricaoEstadual;

    @Column(length = 20)
    private String inscricaoMunicipal;

    /** Código de Regime Tributário: 1=Simples Nacional, 2=Simples excesso sublimite, 3=Regime Normal. */
    @Column(nullable = false)
    private Integer crt = 1;

    private String telefone;
    private String email;

    @Embedded
    private Endereco endereco = new Endereco();

    /** Código IBGE da UF (ex.: 35 = SP, 33 = RJ, 25 = PB). */
    @Column(nullable = false)
    private Integer codigoUf;

    @Column(nullable = false)
    private Integer serieNfe = 1;

    @Column(nullable = false)
    private Integer proximoNumeroNfe = 1;

    /** 1 = Produção, 2 = Homologação. */
    @Column(nullable = false)
    private Integer ambienteNfe = 2;

    public boolean simplesNacional() {
        return crt != null && crt != 3;
    }
}
