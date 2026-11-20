package br.com.erp.integracao;

import br.com.erp.common.NegocioException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;

@Tag(name = "Integrações: Mercado Livre e robô de preços")
@RestController
@RequestMapping("/api/integracoes")
@RequiredArgsConstructor
public class IntegracaoController {

    private final MercadoLivreClient ml;
    private final PrecoRoboService robo;

    /** Chave para o agendador externo (GitHub Actions) disparar o robô sem login. */
    @Value("${app.integracoes.cron-key:}")
    private String cronKey;

    @Value("${app.integracoes.painel-url:/}")
    private String painelUrl;

    public record Status(boolean configurado, boolean conectado, String apelido, LocalDateTime conectadoEm,
                         LocalDateTime ultimaSincronizacao, String ultimoResumo, boolean agendadorExterno) {
    }

    @GetMapping("/mercadolivre")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public Status status() {
        var c = ml.conta();
        return new Status(ml.configurado(), c.isPresent(), c.map(IntegracaoConta::getApelido).orElse(null),
                c.map(IntegracaoConta::getConectadoEm).orElse(null), c.map(IntegracaoConta::getUltimaSincronizacao).orElse(null),
                c.map(IntegracaoConta::getUltimoResumo).orElse(null), !cronKey.isBlank());
    }

    public record Url(String url) {
    }

    @PostMapping("/mercadolivre/conectar")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public Url conectar() {
        return new Url(ml.urlAutorizacao());
    }

    @Operation(summary = "Retorno da autorização do Mercado Livre (redirect_uri)")
    @GetMapping("/mercadolivre/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code, @RequestParam(required = false) String state,
                                         @RequestParam(required = false) String error) {
        String destino;
        if (error != null || code == null) {
            destino = painel("erro", error == null ? "Autorização cancelada" : error);
        } else {
            try {
                ml.concluirAutorizacao(code, state);
                destino = painel("ok", null);
            } catch (NegocioException e) {
                destino = painel("erro", e.getMessage());
            }
        }
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, destino).build();
    }

    private String painel(String ml, String msg) {
        String base = painelUrl.endsWith("/") ? painelUrl : painelUrl + "/";
        return base + "#/afiliados?ml=" + ml + (msg == null ? "" : "&msg=" + URLEncoder.encode(msg, StandardCharsets.UTF_8));
    }

    @DeleteMapping("/mercadolivre")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public void desconectar() {
        ml.desconectar();
    }

    @Operation(summary = "Roda o robô de preços agora (login de gerente ou cabeçalho X-Cron-Key)")
    @PostMapping("/sincronizar")
    public ResponseEntity<PrecoRoboService.Resumo> sincronizar(HttpServletRequest request) {
        String chave = request.getHeader("X-Cron-Key");
        boolean porChave = chave != null && !cronKey.isBlank()
                && MessageDigest.isEqual(chave.getBytes(StandardCharsets.UTF_8), cronKey.getBytes(StandardCharsets.UTF_8));
        if (!porChave && !gerente()) {
            throw new org.springframework.security.access.AccessDeniedException("Sem permissão");
        }
        if (porChave) {
            return ResponseEntity.ok(robo.sincronizar());
        }
        // Pelo painel: roda em segundo plano (pode levar minutos com muitos produtos); o resultado aparece no status.
        if (!ml.configurado() || ml.conta().isEmpty()) {
            throw new NegocioException("Conecte sua conta do Mercado Livre primeiro");
        }
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                robo.sincronizar();
            } catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(IntegracaoController.class).warn("Robô de preços: {}", e.getMessage());
            }
        });
        return ResponseEntity.accepted().body(null);
    }

    @PostMapping("/mercadolivre/importar")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE','ESTOQUISTA')")
    public PrecoRoboService.ImportarResponse importar(@RequestBody PrecoRoboService.ImportarRequest req) {
        return robo.importar(req);
    }

    private static boolean gerente() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.isAuthenticated() && a.getAuthorities().stream()
                .anyMatch(g -> g.getAuthority().equals("ROLE_ADMIN") || g.getAuthority().equals("ROLE_GERENTE"));
    }
}
