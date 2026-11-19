package br.com.erp.cliente;

import br.com.erp.common.EnderecoDto;
import br.com.erp.common.TipoPessoa;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public final class ClienteDtos {

    private ClienteDtos() {
    }

    public record ClienteRequest(
            @NotNull TipoPessoa tipoPessoa,
            @NotBlank @Size(max = 120) String nome,
            @NotBlank String documento,
            @Size(max = 20) String inscricaoEstadual,
            @Email String email,
            @Size(max = 20) String telefone,
            @Valid EnderecoDto endereco,
            @PositiveOrZero BigDecimal limiteCredito,
            Boolean ativo) {
    }

    public record ClienteResponse(
            Long id, TipoPessoa tipoPessoa, String nome, String documento, String inscricaoEstadual, String email,
            String telefone, EnderecoDto endereco, BigDecimal limiteCredito, boolean ativo) {

        public static ClienteResponse from(Cliente c) {
            return new ClienteResponse(c.getId(), c.getTipoPessoa(), c.getNome(), c.getDocumento(),
                    c.getInscricaoEstadual(), c.getEmail(), c.getTelefone(), EnderecoDto.from(c.getEndereco()),
                    c.getLimiteCredito(), c.isAtivo());
        }
    }
}
