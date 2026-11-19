package br.com.erp.empresa;

import br.com.erp.common.EnderecoDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class EmpresaDtos {

    private EmpresaDtos() {
    }

    public record EmpresaRequest(
            @NotBlank @Size(max = 120) String razaoSocial,
            @Size(max = 120) String nomeFantasia,
            @NotBlank String cnpj,
            @Size(max = 20) String inscricaoEstadual,
            @Size(max = 20) String inscricaoMunicipal,
            @NotNull @Min(1) @Max(3) Integer crt,
            String telefone,
            @Email String email,
            @Valid @NotNull EnderecoDto endereco,
            @NotNull @Min(11) @Max(53) Integer codigoUf,
            @NotNull @Min(0) @Max(999) Integer serieNfe,
            @NotNull @Min(1) Integer proximoNumeroNfe,
            @NotNull @Min(1) @Max(2) Integer ambienteNfe) {
    }

    public record EmpresaResponse(
            Long id, String razaoSocial, String nomeFantasia, String cnpj, String inscricaoEstadual,
            String inscricaoMunicipal, Integer crt, String telefone, String email, EnderecoDto endereco,
            Integer codigoUf, Integer serieNfe, Integer proximoNumeroNfe, Integer ambienteNfe) {

        public static EmpresaResponse from(Empresa e) {
            return new EmpresaResponse(e.getId(), e.getRazaoSocial(), e.getNomeFantasia(), e.getCnpj(),
                    e.getInscricaoEstadual(), e.getInscricaoMunicipal(), e.getCrt(), e.getTelefone(), e.getEmail(),
                    EnderecoDto.from(e.getEndereco()), e.getCodigoUf(), e.getSerieNfe(), e.getProximoNumeroNfe(),
                    e.getAmbienteNfe());
        }
    }
}
