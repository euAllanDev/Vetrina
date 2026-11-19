package br.com.erp.compra;

import br.com.erp.compra.CompraDtos.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Compras")
@RestController
@RequestMapping("/api/compras")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','GERENTE','ESTOQUISTA')")
public class CompraController {

    private final CompraService service;

    @GetMapping
    public Page<PedidoCompraResponse> listar(
            @RequestParam(required = false) StatusCompra status,
            @RequestParam(required = false) Long fornecedorId,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.listar(status, fornecedorId, pageable);
    }

    @GetMapping("/{id}")
    public PedidoCompraResponse buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PedidoCompraResponse criar(@Valid @RequestBody PedidoCompraRequest req) {
        return service.criar(req);
    }

    @PutMapping("/{id}")
    public PedidoCompraResponse atualizar(@PathVariable Long id, @Valid @RequestBody PedidoCompraRequest req) {
        return service.atualizar(id, req);
    }

    @PostMapping("/{id}/receber")
    public PedidoCompraResponse receber(@PathVariable Long id, @Valid @RequestBody(required = false) ReceberCompraRequest req) {
        return service.receber(id, req);
    }

    @PostMapping("/{id}/cancelar")
    public PedidoCompraResponse cancelar(@PathVariable Long id) {
        return service.cancelar(id);
    }
}
