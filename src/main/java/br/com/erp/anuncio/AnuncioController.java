package br.com.erp.anuncio;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;

@Tag(name = "Anúncios da loja (banners próprios e Google AdSense)")
@RestController
@RequestMapping("/api/anuncios")
@RequiredArgsConstructor
public class AnuncioController {

    private static final String PODE = "hasAnyRole('ADMIN','GERENTE')";

    private final AnuncioService service;

    @Operation(summary = "Anúncios no ar agora (público, usado pela loja)")
    @GetMapping
    public ResponseEntity<AnuncioService.Anuncios> publicos() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(1)).cachePublic()).body(service.publicos());
    }

    @GetMapping("/{id}/imagem")
    public ResponseEntity<byte[]> imagem(@PathVariable Long id) {
        return service.imagem(id)
                .map(img -> ResponseEntity.ok().contentType(MediaType.parseMediaType(img.getContentType()))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic()).body(img.getDados()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Operation(summary = "Conta o clique no anúncio e leva ao destino")
    @GetMapping("/{id}/ir")
    public ResponseEntity<Void> ir(@PathVariable Long id) {
        String destino = service.registrarClique(id).orElse("/loja");
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, destino)
                .header("X-Robots-Tag", "noindex, nofollow").cacheControl(CacheControl.noStore()).build();
    }

    @Operation(summary = "ads.txt do Google AdSense")
    @GetMapping(value = "/ads.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> adsTxt() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic()).body(service.adsTxt());
    }

    // ---------- painel ----------

    @GetMapping("/admin")
    @PreAuthorize(PODE)
    public List<AnuncioService.BannerAdmin> listar() {
        return service.listar();
    }

    @PostMapping("/admin")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(PODE)
    public AnuncioService.BannerAdmin criar(@RequestBody AnuncioService.BannerRequest req) {
        return service.criar(req);
    }

    @PutMapping("/admin/{id}")
    @PreAuthorize(PODE)
    public AnuncioService.BannerAdmin atualizar(@PathVariable Long id, @RequestBody AnuncioService.BannerRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/admin/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(PODE)
    public void remover(@PathVariable Long id) {
        service.remover(id);
    }

    @PostMapping(value = "/admin/{id}/imagem", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(PODE)
    public AnuncioService.BannerAdmin imagem(@PathVariable Long id, @RequestParam("arquivo") MultipartFile arquivo) {
        return service.salvarImagem(id, arquivo);
    }

    public record AdsenseRequest(String cliente, String slot) {
    }

    @GetMapping("/adsense")
    @PreAuthorize(PODE)
    public AnuncioService.Adsense adsense() {
        return service.adsense().orElse(new AnuncioService.Adsense(null, null));
    }

    @PutMapping("/adsense")
    @PreAuthorize(PODE)
    public AnuncioService.Adsense salvarAdsense(@RequestBody AdsenseRequest req) {
        return service.salvarAdsense(req.cliente(), req.slot()).orElse(new AnuncioService.Adsense(null, null));
    }
}
