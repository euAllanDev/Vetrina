package br.com.erp.fornecedor;

import br.com.erp.common.EnderecoDto;
import br.com.erp.common.TipoPessoa;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class FornecedorDtos {

    private FornecedorDtos() {
    }

    public record FornecedorRequest(
            @NotNull TipoPessoa tipoPessoa,
            @NotBlank @Size(max = 120) String razaoSocial,
            @Size(max = 120) String nomeFantasia,
            @NotBlank String documento,
            @Size(max = 20) String inscricaoEstadual,
            @Email String email,
            @Size(max = 20) String telefone,
            @Size(max = 120) String contato,
            @Valid EnderecoDto endereco,
            Boolean ativo) {
    }

    public record FornecedorResponse(
            Long id, TipoPessoa tipoPessoa, String razaoSocial, String nomeFantasia, String documento,
            String inscricaoEstadual, String email, String telefone, String contato, EnderecoDto endereco,
            boolean ativo) {

        public static FornecedorResponse from(Fornecedor f) {
            return new FornecedorResponse(f.getId(), f.getTipoPessoa(), f.getRazaoSocial(), f.getNomeFantasia(),
                    f.getDocumento(), f.getInscricaoEstadual(), f.getEmail(), f.getTelefone(), f.getContato(),
                    EnderecoDto.from(f.getEndereco()), f.isAtivo());
        }
    }
}
