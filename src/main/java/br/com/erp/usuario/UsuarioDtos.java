package br.com.erp.usuario;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class UsuarioDtos {

    private UsuarioDtos() {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String senha) {
    }

    public record TokenResponse(String accessToken, String tokenType, long expiraEmSegundos, UsuarioResponse usuario) {
    }

    public record UsuarioRequest(
            @NotBlank @Size(max = 120) String nome,
            @NotBlank @Email @Size(max = 160) String email,
            @Size(min = 6, max = 100) String senha,
            @NotNull Role role,
            Boolean ativo) {
    }

    public record AlterarSenhaRequest(@NotBlank String senhaAtual, @NotBlank @Size(min = 6, max = 100) String novaSenha) {
    }

    public record UsuarioResponse(Long id, String nome, String email, Role role, boolean ativo, LocalDateTime criadoEm) {
        public static UsuarioResponse from(Usuario u) {
            return new UsuarioResponse(u.getId(), u.getNome(), u.getEmail(), u.getRole(), u.isAtivo(), u.getCriadoEm());
        }
    }
}
