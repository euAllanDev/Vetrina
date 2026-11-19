package br.com.erp.common;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Endereco {

    private String logradouro;
    private String numero;
    private String complemento;
    private String bairro;
    private String municipio;

    /** Código IBGE do município (7 dígitos), exigido na NF-e. */
    @Column(length = 7)
    private String codigoMunicipio;

    @Column(length = 2)
    private String uf;

    @Column(length = 8)
    private String cep;
}
