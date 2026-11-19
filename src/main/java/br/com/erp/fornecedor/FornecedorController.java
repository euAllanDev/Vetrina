package br.com.erp.fornecedor;

import br.com.erp.fornecedor.FornecedorDtos.FornecedorRequest;
import br.com.erp.fornecedor.FornecedorDtos.FornecedorResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Fornecedores")
@RestController
@RequestMapping("/api/fornecedores")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','GERENTE','ESTOQUISTA','FINANCEIRO')")
public class FornecedorController {

    private final FornecedorService service;

    @GetMapping
    public Page<FornecedorResponse> listar(@RequestParam(required = false) String termo,
                                           @RequestParam(required = false) Boolean ativo,
                                           @PageableDefault(size = 20, sort = "razaoSocial") Pageable pageable) {
        return service.listar(termo, ativo, pageable);
    }

    @GetMapping("/{id}")
    public FornecedorResponse buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FornecedorResponse criar(@Valid @RequestBody FornecedorRequest req) {
        return service.criar(req);
    }

    @PutMapping("/{id}")
    public FornecedorResponse atualizar(@PathVariable Long id, @Valid @RequestBody FornecedorRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativar(@PathVariable Long id) {
        service.desativar(id);
    }
}
