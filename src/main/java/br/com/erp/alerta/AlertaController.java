package br.com.erp.alerta;

import br.com.erp.common.NegocioException;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Tag(name = "Avisos de preço (notificação do navegador)")
@RestController
@RequestMapping("/api/alertas")
@RequiredArgsConstructor
public class AlertaController {

    private final AlertaService service;
    private final AlertaPrecoRepository alertas;
    /** Limite simples por endereço IP contra abuso: 30 pedidos a cada 10 minutos. */
    private final Map<String, long[]> pedidos = new ConcurrentHashMap<>();

    public record Chave(String publicKey) {
    }

    public record InscreverRequest(Long produtoId, AlertaService.Inscricao subscription) {
    }

    public record InscreverResponse(boolean ok, BigDecimal precoReferencia) {
    }

    public record RemoverRequest(Long produtoId, String endpoint) {
    }

    @GetMapping("/chave")
    public Chave chave() {
        return new Chave(service.chavePublica());
    }

    @PostMapping
    public InscreverResponse inscrever(@RequestBody InscreverRequest req, HttpServletRequest http) {
        limitar(http);
        if (req.produtoId() == null || req.subscription() == null) throw new NegocioException("Pedido de aviso incompleto");
        return new InscreverResponse(true, service.inscrever(req.produtoId(), req.subscription()));
    }

    @PostMapping("/remover")
    public Map<String, Boolean> remover(@RequestBody RemoverRequest req, HttpServletRequest http) {
        limitar(http);
        if (req.produtoId() != null && req.endpoint() != null) service.remover(req.produtoId(), req.endpoint());
        return Map.of("ok", true);
    }

    @PostMapping("/testar")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public Map<String, Integer> testar(@RequestBody AlertaService.Inscricao ins) {
        return Map.of("status", service.testar(ins));
    }

    @PostMapping("/verificar/{produtoId}")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public Map<String, Integer> verificar(@PathVariable Long produtoId) {
        return Map.of("enviados", service.verificar(produtoId));
    }

    @PostMapping("/testar-produto/{produtoId}")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public Map<String, Integer> testarProduto(@PathVariable Long produtoId) {
        return Map.of("enviados", service.testarProduto(produtoId));
    }

    @GetMapping("/resumo")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public Map<String, Long> resumo() {
        return Map.of("ativos", alertas.countByAtivoTrue());
    }

    private void limitar(HttpServletRequest http) {
        String fwd = http.getHeader("X-Forwarded-For");
        String ip = fwd != null && !fwd.isBlank() ? fwd.split(",")[0].trim() : http.getRemoteAddr();
        long agora = System.currentTimeMillis();
        long[] c = pedidos.compute(ip, (k, v) -> v == null || agora - v[0] > 600_000 ? new long[]{agora, 1} : new long[]{v[0], v[1] + 1});
        if (c[1] > 30) throw new NegocioException("Muitos pedidos seguidos. Tente de novo em alguns minutos.");
        if (pedidos.size() > 10_000) pedidos.clear();
    }
}
