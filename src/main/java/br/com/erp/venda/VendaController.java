package br.com.erp.venda;

import br.com.erp.venda.VendaDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@Tag(name = "Vendas")
@RestController
@RequestMapping("/api/vendas")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','GERENTE','VENDEDOR')")
public class VendaController {

    private final VendaService service;

    @GetMapping
    public Page<VendaResponse> listar(
            @RequestParam(required = false) StatusVenda status,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.listar(status, clienteId, de, ate, pageable);
    }

    @GetMapping("/{id}")
    public VendaResponse buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @Operation(summary = "Cria um orçamento (não movimenta estoque)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VendaResponse criar(@Valid @RequestBody VendaRequest req) {
        return service.criar(req);
    }

    @Operation(summary = "Venda de balcão: cria e já confirma (baixa estoque e gera financeiro)")
    @PostMapping("/pdv")
    @ResponseStatus(HttpStatus.CREATED)
    public VendaResponse pdv(@Valid @RequestBody VendaRequest req) {
        return service.criarEConfirmar(req);
    }

    @PutMapping("/{id}")
    public VendaResponse atualizar(@PathVariable Long id, @Valid @RequestBody VendaRequest req) {
        return service.atualizar(id, req);
    }

    @PostMapping("/{id}/confirmar")
    public VendaResponse confirmar(@PathVariable Long id) {
        return service.confirmar(id);
    }

    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public VendaResponse cancelar(@PathVariable Long id, @Valid @RequestBody CancelamentoRequest req) {
        return service.cancelar(id, req);
    }
}
