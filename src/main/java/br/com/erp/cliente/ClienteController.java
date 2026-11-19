package br.com.erp.cliente;

import br.com.erp.cliente.ClienteDtos.ClienteRequest;
import br.com.erp.cliente.ClienteDtos.ClienteResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Clientes")
@RestController
@RequestMapping("/api/clientes")
@RequiredArgsConstructor
public class ClienteController {

    private static final String PODE_EDITAR = "hasAnyRole('ADMIN','GERENTE','VENDEDOR')";

    private final ClienteService service;

    @GetMapping
    public Page<ClienteResponse> listar(@RequestParam(required = false) String termo,
                                        @RequestParam(required = false) Boolean ativo,
                                        @PageableDefault(size = 20, sort = "nome") Pageable pageable) {
        return service.listar(termo, ativo, pageable);
    }

    @GetMapping("/{id}")
    public ClienteResponse buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(PODE_EDITAR)
    public ClienteResponse criar(@Valid @RequestBody ClienteRequest req) {
        return service.criar(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize(PODE_EDITAR)
    public ClienteResponse atualizar(@PathVariable Long id, @Valid @RequestBody ClienteRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(PODE_EDITAR)
    public void desativar(@PathVariable Long id) {
        service.desativar(id);
    }
}
