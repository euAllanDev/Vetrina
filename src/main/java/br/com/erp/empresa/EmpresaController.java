package br.com.erp.empresa;

import br.com.erp.empresa.EmpresaDtos.EmpresaRequest;
import br.com.erp.empresa.EmpresaDtos.EmpresaResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Empresa")
@RestController
@RequestMapping("/api/empresa")
@RequiredArgsConstructor
public class EmpresaController {

    private final EmpresaService service;

    @GetMapping
    public EmpresaResponse buscar() {
        return service.buscar();
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public EmpresaResponse atualizar(@Valid @RequestBody EmpresaRequest req) {
        return service.atualizar(req);
    }
}
