package br.com.erp.common;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EnderecoDto(
        @Size(max = 120) String logradouro,
        @Size(max = 20) String numero,
        @Size(max = 60) String complemento,
        @Size(max = 60) String bairro,
        @Size(max = 60) String municipio,
        @Pattern(regexp = "\\d{7}", message = "deve ter 7 dígitos (código IBGE)") String codigoMunicipio,
        @Pattern(regexp = "[A-Za-z]{2}", message = "deve ser a sigla da UF") String uf,
        @Pattern(regexp = "\\d{5}-?\\d{3}", message = "CEP inválido") String cep
) {

    public Endereco toEntity() {
        return new Endereco(logradouro, numero, complemento, bairro, municipio, codigoMunicipio,
                uf == null ? null : uf.toUpperCase(),
                cep == null ? null : cep.replaceAll("\\D", ""));
    }

    public static EnderecoDto from(Endereco e) {
        if (e == null) {
            return null;
        }
        return new EnderecoDto(e.getLogradouro(), e.getNumero(), e.getComplemento(), e.getBairro(),
                e.getMunicipio(), e.getCodigoMunicipio(), e.getUf(), e.getCep());
    }
}
