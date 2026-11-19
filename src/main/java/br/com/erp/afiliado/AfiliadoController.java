package br.com.erp.afiliado;

import br.com.erp.afiliado.AfiliadoDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Duration;
import java.util.List;

@Tag(name = "Afiliados: lojas parceiras, ofertas e cliques")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AfiliadoController {

    private static final String PODE_EDITAR = "hasAnyRole('ADMIN','GERENTE','ESTOQUISTA')";

    private final AfiliadoService service;

    // ---------- lojas parceiras ----------

    @GetMapping("/parceiros")
    public List<ParceiroResponse> parceiros() {
        return service.listarParceiros();
    }

    @PostMapping("/parceiros")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(PODE_EDITAR)
    public ParceiroResponse criarParceiro(@Valid @RequestBody ParceiroRequest req) {
        return service.criarParceiro(req);
    }

    @PutMapping("/parceiros/{id}")
    @PreAuthorize(PODE_EDITAR)
    public ParceiroResponse atualizarParceiro(@PathVariable Long id, @Valid @RequestBody ParceiroRequest req) {
        return service.atualizarParceiro(id, req);
    }

    // ---------- ofertas ----------

    @GetMapping("/produtos/{produtoId}/ofertas")
    public List<OfertaResponse> ofertas(@PathVariable Long produtoId) {
        return service.ofertasDoProduto(produtoId);
    }

    @PostMapping("/produtos/{produtoId}/ofertas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(PODE_EDITAR)
    public OfertaResponse criarOferta(@PathVariable Long produtoId, @Valid @RequestBody OfertaRequest req) {
        return service.criarOferta(produtoId, req);
    }

    @PutMapping("/ofertas/{id}")
    @PreAuthorize(PODE_EDITAR)
    public OfertaResponse atualizarOferta(@PathVariable Long id, @Valid @RequestBody OfertaRequest req) {
        return service.atualizarOferta(id, req);
    }

    @Operation(summary = "Marca o preço como conferido agora (sem mudança)")
    @PostMapping("/ofertas/{id}/conferir")
    @PreAuthorize(PODE_EDITAR)
    public OfertaResponse conferir(@PathVariable Long id) {
        return service.conferirOferta(id);
    }

    @DeleteMapping("/ofertas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(PODE_EDITAR)
    public void excluirOferta(@PathVariable Long id) {
        service.excluirOferta(id);
    }

    // ---------- públicos ----------

    @Operation(summary = "Ver na loja: conta o clique e redireciona para o link de afiliado")
    @GetMapping("/ir/{ofertaId}")
    public ResponseEntity<Void> ir(@PathVariable Long ofertaId) {
        return service.registrarClique(ofertaId)
                .map(url -> ResponseEntity.status(HttpStatus.FOUND)
                        .header(HttpHeaders.LOCATION, URI.create(url).toString())
                        .header("X-Robots-Tag", "noindex, nofollow")
                        .cacheControl(CacheControl.noStore())
                        .<Void>build())
                .orElseGet(() -> ResponseEntity.status(HttpStatus.FOUND)
                        .header(HttpHeaders.LOCATION, "/loja").<Void>build());
    }

    @Operation(summary = "Histórico do menor preço do produto entre as lojas")
    @GetMapping("/catalogo/produtos/{produtoId}/historico")
    public ResponseEntity<HistoricoResponse> historico(@PathVariable Long produtoId,
                                                       @RequestParam(defaultValue = "90") int dias) {
        int d = Math.max(7, Math.min(dias, 365));
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(service.historico(produtoId, d));
    }

    // ---------- relatório ----------

    @GetMapping("/relatorios/cliques")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public RelatorioCliques relatorio(@RequestParam(defaultValue = "30") int dias) {
        return service.relatorio(Math.max(1, Math.min(dias, 365)));
    }
}
