package br.com.erp.fiscal;

import br.com.erp.fiscal.NotaFiscalDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "Notas fiscais (NF-e)")
@RestController
@RequestMapping("/api/notas-fiscais")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','GERENTE','VENDEDOR','FINANCEIRO')")
public class NotaFiscalController {

    private final NotaFiscalService service;
    private final DanfeService danfeService;

    @GetMapping
    public Page<NotaFiscalResponse> listar(
            @RequestParam(required = false) StatusNotaFiscal status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.listar(status, de, ate, pageable);
    }

    @GetMapping("/{id}")
    public NotaFiscalResponse buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @GetMapping("/venda/{vendaId}")
    public List<NotaFiscalResponse> porVenda(@PathVariable Long vendaId) {
        return service.porVenda(vendaId);
    }

    @Operation(summary = "Baixa o XML da NF-e")
    @GetMapping(value = "/{id}/xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> xml(@PathVariable Long id) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"nfe-" + id + ".xml\"")
                .body(service.xml(id));
    }

    @Operation(summary = "DANFE em PDF (para imprimir ou enviar ao cliente)")
    @GetMapping(value = "/{id}/danfe", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> danfe(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean download) {
        byte[] pdf = danfeService.gerar(id);
        String disposicao = (download ? "attachment" : "inline") + "; filename=\"" + danfeService.nomeArquivo(id) + "\"";
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, disposicao).body(pdf);
    }

    @Operation(summary = "Emite NF-e para uma venda confirmada")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NotaFiscalResponse emitir(@Valid @RequestBody EmitirNotaRequest req) {
        return service.emitir(req);
    }

    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE')")
    public NotaFiscalResponse cancelar(@PathVariable Long id, @Valid @RequestBody CancelarNotaRequest req) {
        return service.cancelar(id, req);
    }
}
