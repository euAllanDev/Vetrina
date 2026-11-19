package br.com.erp.financeiro;

import br.com.erp.financeiro.FinanceiroDtos.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@Tag(name = "Financeiro")
@RestController
@RequestMapping("/api/financeiro")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','GERENTE','FINANCEIRO')")
public class FinanceiroController {

    private final FinanceiroService service;

    // ---------- Contas a receber ----------

    @GetMapping("/receber")
    public Page<ContaReceberResponse> listarReceber(
            @RequestParam(required = false) StatusTitulo status,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoDe,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoAte,
            @RequestParam(defaultValue = "false") boolean vencidas,
            @PageableDefault(size = 50, sort = "vencimento") Pageable pageable) {
        return service.listarReceber(status, clienteId, vencimentoDe, vencimentoAte, vencidas, pageable);
    }

    @PostMapping("/receber")
    @ResponseStatus(HttpStatus.CREATED)
    public ContaReceberResponse criarReceber(@Valid @RequestBody ContaReceberRequest req) {
        return service.criarReceber(req);
    }

    @PostMapping("/receber/{id}/baixa")
    public ContaReceberResponse baixarReceber(@PathVariable Long id, @Valid @RequestBody(required = false) BaixaRequest req) {
        return service.baixarReceber(id, req);
    }

    @PostMapping("/receber/{id}/cancelar")
    public ContaReceberResponse cancelarReceber(@PathVariable Long id) {
        return service.cancelarReceber(id);
    }

    // ---------- Contas a pagar ----------

    @GetMapping("/pagar")
    public Page<ContaPagarResponse> listarPagar(
            @RequestParam(required = false) StatusTitulo status,
            @RequestParam(required = false) Long fornecedorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoDe,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate vencimentoAte,
            @RequestParam(defaultValue = "false") boolean vencidas,
            @PageableDefault(size = 50, sort = "vencimento") Pageable pageable) {
        return service.listarPagar(status, fornecedorId, vencimentoDe, vencimentoAte, vencidas, pageable);
    }

    @PostMapping("/pagar")
    @ResponseStatus(HttpStatus.CREATED)
    public ContaPagarResponse criarPagar(@Valid @RequestBody ContaPagarRequest req) {
        return service.criarPagar(req);
    }

    @PostMapping("/pagar/{id}/baixa")
    public ContaPagarResponse baixarPagar(@PathVariable Long id, @Valid @RequestBody(required = false) BaixaRequest req) {
        return service.baixarPagar(id, req);
    }

    @PostMapping("/pagar/{id}/cancelar")
    public ContaPagarResponse cancelarPagar(@PathVariable Long id) {
        return service.cancelarPagar(id);
    }

    // ---------- Fluxo de caixa ----------

    @GetMapping("/fluxo-caixa")
    public FluxoCaixaResponse fluxoCaixa(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim) {
        return service.fluxoCaixa(inicio, fim);
    }
}
