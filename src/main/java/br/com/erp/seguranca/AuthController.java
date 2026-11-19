package br.com.erp.seguranca;

import br.com.erp.usuario.Usuario;
import br.com.erp.usuario.UsuarioDtos.AlterarSenhaRequest;
import br.com.erp.usuario.UsuarioDtos.LoginRequest;
import br.com.erp.usuario.UsuarioDtos.TokenResponse;
import br.com.erp.usuario.UsuarioDtos.UsuarioResponse;
import br.com.erp.usuario.UsuarioService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Autenticação")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UsuarioService usuarioService;

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.email(), req.senha()));
        Usuario usuario = (Usuario) auth.getPrincipal();
        return new TokenResponse(jwtService.gerarToken(usuario), "Bearer",
                jwtService.getExpiracaoSegundos(), UsuarioResponse.from(usuario));
    }

    @GetMapping("/me")
    public UsuarioResponse me(@AuthenticationPrincipal Usuario usuario) {
        return UsuarioResponse.from(usuario);
    }

    @PutMapping("/me/senha")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void alterarSenha(@AuthenticationPrincipal Usuario usuario, @Valid @RequestBody AlterarSenhaRequest req) {
        usuarioService.alterarSenha(usuario.getEmail(), req);
    }
}
