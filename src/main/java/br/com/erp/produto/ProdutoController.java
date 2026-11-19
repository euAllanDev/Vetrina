package br.com.erp.produto;

import br.com.erp.produto.ProdutoDtos.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;

@Tag(name = "Produtos e categorias")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ProdutoController {

    private static final String PODE_EDITAR = "hasAnyRole('ADMIN','GERENTE','ESTOQUISTA')";

    private final ProdutoService service;
    private final ProdutoImagemService imagemService;

    // ---------- Categorias ----------

    @GetMapping("/categorias")
    public List<CategoriaResponse> listarCategorias() {
        return service.listarCategorias();
    }

    @PostMapping("/categorias")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(PODE_EDITAR)
    public CategoriaResponse criarCategoria(@Valid @RequestBody CategoriaRequest req) {
        return service.criarCategoria(req);
    }

    @PutMapping("/categorias/{id}")
    @PreAuthorize(PODE_EDITAR)
    public CategoriaResponse atualizarCategoria(@PathVariable Long id, @Valid @RequestBody CategoriaRequest req) {
        return service.atualizarCategoria(id, req);
    }

    @DeleteMapping("/categorias/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(PODE_EDITAR)
    public void excluirCategoria(@PathVariable Long id) {
        service.excluirCategoria(id);
    }

    // ---------- Produtos ----------

    @GetMapping("/produtos")
    public Page<ProdutoResponse> listar(@RequestParam(required = false) String termo,
                                        @RequestParam(required = false) Long categoriaId,
                                        @RequestParam(required = false) Boolean ativo,
                                        @PageableDefault(size = 20, sort = "descricao") Pageable pageable) {
        return service.listar(termo, categoriaId, ativo, pageable);
    }

    @GetMapping("/produtos/estoque-baixo")
    public List<ProdutoResponse> estoqueBaixo() {
        return service.abaixoDoMinimo();
    }

    @GetMapping("/produtos/{id}")
    public ProdutoResponse buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping("/produtos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(PODE_EDITAR)
    public ProdutoResponse criar(@Valid @RequestBody ProdutoRequest req) {
        return service.criar(req);
    }

    @PutMapping("/produtos/{id}")
    @PreAuthorize(PODE_EDITAR)
    public ProdutoResponse atualizar(@PathVariable Long id, @Valid @RequestBody ProdutoRequest req) {
        return service.atualizar(id, req);
    }

    // ---------- Foto ----------

    @PostMapping(value = "/produtos/{id}/imagem", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(PODE_EDITAR)
    public ProdutoResponse enviarImagem(@PathVariable Long id, @RequestParam("arquivo") MultipartFile arquivo) {
        return imagemService.salvar(id, arquivo);
    }

    @DeleteMapping("/produtos/{id}/imagem")
    @PreAuthorize(PODE_EDITAR)
    public ProdutoResponse removerImagem(@PathVariable Long id) {
        return imagemService.remover(id);
    }

    /** Público (usado direto em &lt;img&gt;); a URL leva ?v= com a versão, então o cache pode ser longo. */
    @GetMapping("/produtos/{id}/imagem")
    public ResponseEntity<byte[]> imagem(@PathVariable Long id) {
        return imagemService.buscar(id)
                .map(img -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(img.getContentType()))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic())
                        .body(img.getDados()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/produtos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(PODE_EDITAR)
    public void desativar(@PathVariable Long id) {
        service.desativar(id);
    }
}
