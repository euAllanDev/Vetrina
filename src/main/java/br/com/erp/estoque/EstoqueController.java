package br.com.erp.estoque;

import br.com.erp.estoque.EstoqueDtos.*;
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

@Tag(name = "Estoque")
@RestController
@RequestMapping("/api/estoque")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','GERENTE','ESTOQUISTA')")
public class EstoqueController {

    private final EstoqueService service;

    @GetMapping("/movimentacoes")
    public Page<MovimentacaoResponse> movimentacoes(
            @RequestParam(required = false) Long produtoId,
            @PageableDefault(size = 50, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.movimentacoes(produtoId, pageable);
    }

    @GetMapping("/resumo")
    public ResumoEstoqueResponse resumo() {
        return service.resumo();
    }

    @PostMapping("/inventario")
    @ResponseStatus(HttpStatus.CREATED)
    public MovimentacaoResponse inventario(@Valid @RequestBody InventarioRequest req) {
        return service.inventario(req);
    }

    @PostMapping("/entradas")
    @ResponseStatus(HttpStatus.CREATED)
    public MovimentacaoResponse entrada(@Valid @RequestBody MovimentoManualRequest req) {
        return service.entradaManual(req);
    }

    @PostMapping("/saidas")
    @ResponseStatus(HttpStatus.CREATED)
    public MovimentacaoResponse saida(@Valid @RequestBody MovimentoManualRequest req) {
        return service.saidaManual(req);
    }
}
