package br.com.erp.catalogo;

import br.com.erp.catalogo.CatalogoDtos.CatalogoResponse;
import br.com.erp.catalogo.CatalogoDtos.PedidoLojaRequest;
import br.com.erp.catalogo.CatalogoDtos.PedidoLojaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

/** Rotas públicas (sem login) usadas pela loja em /loja. */
@Tag(name = "Loja (pública)")
@RestController
@RequestMapping("/api/catalogo")
@RequiredArgsConstructor
public class CatalogoController {

    private final CatalogoService service;

    @Operation(summary = "Catálogo: dados da loja, categorias e produtos ativos")
    @GetMapping
    public ResponseEntity<CatalogoResponse> catalogo() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofSeconds(30)).cachePublic()).body(service.catalogo());
    }

    @Operation(summary = "Pedido do cliente: vira um orçamento em Vendas para a equipe confirmar")
    @PostMapping("/pedidos")
    @ResponseStatus(HttpStatus.CREATED)
    public PedidoLojaResponse pedido(@Valid @RequestBody PedidoLojaRequest req) {
        return service.pedido(req);
    }
}
