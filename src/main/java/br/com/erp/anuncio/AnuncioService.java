package br.com.erp.anuncio;

import br.com.erp.alerta.Configuracao;
import br.com.erp.alerta.ConfiguracaoRepository;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Anúncios da loja: banners próprios (campanhas com link de afiliado) e, quando configurado, Google AdSense.
 * Em cada lugar da tela vale o banner próprio; sem banner, entra o AdSense (se houver); sem nenhum, o espaço some.
 */
@Service
@RequiredArgsConstructor
public class AnuncioService {

    private static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final long TAMANHO_MAXIMO = 3 * 1024 * 1024;
    private static final Set<String> TIPOS = Set.of("image/jpeg", "image/png", "image/webp");
    private static final String CHAVE_CLIENTE = "adsense.cliente";
    private static final String CHAVE_SLOT = "adsense.slot";
    private static final Pattern CLIENTE = Pattern.compile("ca-pub-\\d{10,20}");
    private static final Pattern SLOT = Pattern.compile("\\d{6,20}");

    private final BannerRepository banners;
    private final BannerImagemRepository imagens;
    private final ConfiguracaoRepository configs;

    public record BannerPublico(Long id, String titulo, PosicaoAnuncio posicao, String imagemUrl, String link, boolean interno) {
    }

    public record Adsense(String cliente, String slot) {
    }

    public record Anuncios(List<BannerPublico> banners, Adsense adsense) {
    }

    public record BannerAdmin(Long id, String titulo, String link, PosicaoAnuncio posicao, LocalDate inicio, LocalDate fim,
                              boolean ativo, int ordem, long cliques, String imagemUrl, boolean noAr) {
    }

    public record BannerRequest(String titulo, String link, PosicaoAnuncio posicao, LocalDate inicio, LocalDate fim,
                                Boolean ativo, Integer ordem) {
    }

    // Lista pública guardada por 1 minuto (a loja pede a cada página); qualquer mudança no painel limpa.
    private volatile Anuncios cache;
    private volatile long cacheEm;

    /* ============================== público ============================== */

    @Transactional(readOnly = true)
    public Anuncios publicos() {
        Anuncios c = cache;
        if (c != null && System.currentTimeMillis() - cacheEm < 60_000) return c;
        LocalDate hoje = LocalDate.now(BRASILIA);
        List<BannerPublico> lista = banners.findAllByOrderByPosicaoAscOrdemAscIdDesc().stream()
                .filter(b -> noAr(b, hoje))
                .map(b -> new BannerPublico(b.getId(), b.getTitulo(), b.getPosicao(), imagemUrl(b), "/api/anuncios/" + b.getId() + "/ir", b.getLink().startsWith("/")))
                .toList();
        c = new Anuncios(lista, adsense().orElse(null));
        cache = c;
        cacheEm = System.currentTimeMillis();
        return c;
    }

    @Transactional
    public Optional<String> registrarClique(Long id) {
        return banners.findById(id).map(b -> {
            banners.somarClique(id);
            return b.getLink();
        });
    }

    @Transactional(readOnly = true)
    public Optional<BannerImagem> imagem(Long id) {
        return imagens.findById(id);
    }

    /** Conteúdo do ads.txt (exigido pelo AdSense). Vazio enquanto não houver conta configurada. */
    @Transactional(readOnly = true)
    public String adsTxt() {
        return adsense().map(a -> "google.com, " + a.cliente().replace("ca-", "") + ", DIRECT, f08c47fec0942fa0\n").orElse("");
    }

    /* ============================== painel ============================== */

    @Transactional(readOnly = true)
    public List<BannerAdmin> listar() {
        LocalDate hoje = LocalDate.now(BRASILIA);
        return banners.findAllByOrderByPosicaoAscOrdemAscIdDesc().stream().map(b -> admin(b, hoje)).toList();
    }

    @Transactional
    public BannerAdmin criar(BannerRequest req) {
        Banner b = new Banner();
        preencher(b, req);
        banners.save(b);
        limparCache();
        return admin(b, LocalDate.now(BRASILIA));
    }

    @Transactional
    public BannerAdmin atualizar(Long id, BannerRequest req) {
        Banner b = banners.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Anúncio", id));
        preencher(b, req);
        limparCache();
        return admin(b, LocalDate.now(BRASILIA));
    }

    @Transactional
    public void remover(Long id) {
        imagens.findById(id).ifPresent(imagens::delete);
        banners.findById(id).ifPresent(banners::delete);
        limparCache();
    }

    @Transactional
    public BannerAdmin salvarImagem(Long id, MultipartFile arquivo) {
        Banner b = banners.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Anúncio", id));
        if (arquivo == null || arquivo.isEmpty()) throw new NegocioException("Envie a imagem do anúncio");
        if (arquivo.getSize() > TAMANHO_MAXIMO) throw new NegocioException("A imagem deve ter no máximo 3 MB");
        byte[] dados;
        try {
            dados = arquivo.getBytes();
        } catch (IOException e) {
            throw new NegocioException("Não foi possível ler a imagem enviada");
        }
        String tipo = tipo(dados);
        if (tipo == null || !TIPOS.contains(tipo)) throw new NegocioException("Formato não suportado. Use JPG, PNG ou WebP.");
        BannerImagem img = imagens.findById(id).orElseGet(() -> {
            BannerImagem nova = new BannerImagem();
            nova.setBannerId(id);
            return nova;
        });
        img.setContentType(tipo);
        img.setDados(dados);
        imagens.save(img);
        b.setImagemAtualizadaEm(LocalDateTime.now());
        limparCache();
        return admin(b, LocalDate.now(BRASILIA));
    }

    @Transactional(readOnly = true)
    public Optional<Adsense> adsense() {
        String cliente = valor(CHAVE_CLIENTE);
        String slot = valor(CHAVE_SLOT);
        return cliente == null || slot == null ? Optional.empty() : Optional.of(new Adsense(cliente, slot));
    }

    /** Salva (ou apaga, se vier vazio) o ID de editor e o bloco de anúncio do AdSense. */
    @Transactional
    public Optional<Adsense> salvarAdsense(String cliente, String slot) {
        String c = cliente == null ? "" : cliente.trim().toLowerCase();
        String s = slot == null ? "" : slot.trim();
        if (c.isEmpty() && s.isEmpty()) {
            configs.deleteById(CHAVE_CLIENTE);
            configs.deleteById(CHAVE_SLOT);
            configs.flush();
            limparCache();
            return Optional.empty();
        }
        if (c.startsWith("pub-")) c = "ca-" + c;
        if (!CLIENTE.matcher(c).matches()) throw new NegocioException("O ID de editor tem o formato ca-pub-1234567890123456 (está em AdSense → Conta → Informações da conta).");
        if (!SLOT.matcher(s).matches()) throw new NegocioException("O ID do bloco de anúncio só tem números (AdSense → Anúncios → Por bloco de anúncios).");
        configs.save(new Configuracao(CHAVE_CLIENTE, c));
        configs.save(new Configuracao(CHAVE_SLOT, s));
        limparCache();
        return Optional.of(new Adsense(c, s));
    }

    /* ============================== apoio ============================== */

    private void preencher(Banner b, BannerRequest req) {
        if (req == null) throw new NegocioException("Dados do anúncio não enviados");
        String titulo = req.titulo() == null ? "" : req.titulo().trim();
        String link = req.link() == null ? "" : req.link().trim();
        if (titulo.isEmpty()) throw new NegocioException("Dê um nome ao anúncio (ex.: Black Friday Mercado Livre)");
        if (titulo.length() > 120) titulo = titulo.substring(0, 120);
        if (!(link.startsWith("https://") || link.startsWith("http://") || link.startsWith("/loja"))) {
            throw new NegocioException("O link precisa começar com https:// (link da loja parceira) ou /loja (página da própria loja)");
        }
        if (link.length() > 1000) throw new NegocioException("Link muito longo");
        if (req.posicao() == null) throw new NegocioException("Escolha onde o anúncio aparece");
        if (req.inicio() != null && req.fim() != null && req.fim().isBefore(req.inicio())) {
            throw new NegocioException("A data de fim é antes da data de início");
        }
        b.setTitulo(titulo);
        b.setLink(link);
        b.setPosicao(req.posicao());
        b.setInicio(req.inicio());
        b.setFim(req.fim());
        b.setAtivo(req.ativo() == null || req.ativo());
        b.setOrdem(req.ordem() == null ? 0 : req.ordem());
    }

    private static boolean noAr(Banner b, LocalDate hoje) {
        return b.isAtivo() && b.getImagemAtualizadaEm() != null
                && (b.getInicio() == null || !hoje.isBefore(b.getInicio()))
                && (b.getFim() == null || !hoje.isAfter(b.getFim()));
    }

    private static BannerAdmin admin(Banner b, LocalDate hoje) {
        return new BannerAdmin(b.getId(), b.getTitulo(), b.getLink(), b.getPosicao(), b.getInicio(), b.getFim(), b.isAtivo(),
                b.getOrdem(), b.getCliques(), imagemUrl(b), noAr(b, hoje));
    }

    private static String imagemUrl(Banner b) {
        if (b.getImagemAtualizadaEm() == null) return null;
        long v = b.getImagemAtualizadaEm().atZone(BRASILIA).toEpochSecond();
        return "/api/anuncios/" + b.getId() + "/imagem?v=" + v;
    }

    private String valor(String chave) {
        return configs.findById(chave).map(Configuracao::getValor).filter(v -> !v.isBlank()).orElse(null);
    }

    private void limparCache() {
        cache = null;
    }

    static String tipo(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }
}
