package br.com.erp.integracao;

import br.com.erp.afiliado.*;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.produto.Categoria;
import br.com.erp.produto.CategoriaRepository;
import br.com.erp.produto.Produto;
import br.com.erp.produto.ProdutoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Produtos capturados pelo botão "Enviar para a Vetrina" (favorito do navegador).
 * O navegador do dono lê a página da loja (Mercado Livre, Shein…) e manda nome, preço e links;
 * aqui o produto é criado ou, se já existir, só o preço é atualizado (com histórico e selo "Baixou").
 */
@Service
@RequiredArgsConstructor
public class CapturaService {

    private final ParceiroRepository parceiros;
    private final OfertaRepository ofertas;
    private final HistoricoPrecoRepository historico;
    private final ProdutoRepository produtos;
    private final CategoriaRepository categorias;
    private final org.springframework.context.ApplicationEventPublisher eventos;

    public record CapturaRequest(String loja, String nome, BigDecimal preco, BigDecimal precoAnterior, Boolean freteGratis,
                                 BigDecimal nota, String urlProduto, String codigo, String linkAfiliado, Long categoriaId,
                                 String detalhes, Long produtoId) {
    }

    /** Produto já cadastrado com nome parecido: talvez seja o mesmo, vendido em outra loja. */
    public record Parecido(Long produtoId, String nome, BigDecimal preco, List<String> lojas, boolean jaTemEstaLoja) {
    }

    public record Existente(Long produtoId, Long ofertaId, String nome, BigDecimal preco, Long categoriaId, boolean temFoto, String link) {
    }

    public record Verificacao(String loja, String parceiro, String codigo, Existente existente, List<Parecido> parecidos) {
    }

    public record CapturaResponse(Long produtoId, Long ofertaId, String nome, boolean novo, BigDecimal preco,
                                  BigDecimal precoAntes, boolean baixou, boolean temFoto) {
    }

    /** Loja reconhecida pelo endereço da página. */
    enum Loja {
        MERCADO_LIVRE("ML-", RedeAfiliado.MERCADO_LIVRE, "Mercado Livre", "#ffe600", "https://www.mercadolivre.com.br"),
        SHEIN("SHEIN-", RedeAfiliado.OUTRA, "Shein", "#111111", "https://br.shein.com"),
        SHOPEE("SHOPEE-", RedeAfiliado.SHOPEE, "Shopee", "#ee4d2d", "https://shopee.com.br"),
        ALIEXPRESS("ALI-", RedeAfiliado.ALIEXPRESS, "AliExpress", "#e62e04", "https://pt.aliexpress.com"),
        KABUM("KABUM-", RedeAfiliado.AWIN, "KaBuM!", "#0060b1", "https://www.kabum.com.br");

        final String prefixo;
        final RedeAfiliado rede;
        final String nome;
        final String cor;
        final String site;

        Loja(String prefixo, RedeAfiliado rede, String nome, String cor, String site) {
            this.prefixo = prefixo;
            this.rede = rede;
            this.nome = nome;
            this.cor = cor;
            this.site = site;
        }

        static Loja de(String lojaOuUrl) {
            String s = lojaOuUrl == null ? "" : lojaOuUrl.toLowerCase(Locale.ROOT);
            if (s.contains("mercadoli") || s.contains("meli.la") || s.equals("mercado_livre")) return MERCADO_LIVRE;
            if (s.contains("shein")) return SHEIN;
            if (s.contains("shopee")) return SHOPEE;
            if (s.contains("aliexpress")) return ALIEXPRESS;
            if (s.contains("kabum")) return KABUM;
            return null;
        }
    }

    private static final Pattern SHEIN_ID = Pattern.compile("-p-(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern SHOPEE_ID = Pattern.compile("i\\.(\\d+)\\.(\\d+)|/product/(\\d+)/(\\d+)");
    private static final Pattern ALI_ID = Pattern.compile("/item/(\\d+)");
    private static final Pattern KABUM_ID = Pattern.compile("/produto/(\\d+)");

    /** Código do produto na loja, tirado do endereço (ou o que veio do navegador). */
    static String codigoDe(Loja loja, String codigo, String urlProduto) {
        String url = urlProduto == null ? "" : urlProduto;
        String c = switch (loja) {
            case MERCADO_LIVRE -> {
                String daUrl = MercadoLivreClient.codigoDaUrl(url);
                yield daUrl != null ? daUrl : codigo;
            }
            case SHEIN -> grupo(SHEIN_ID.matcher(url), codigo);
            case SHOPEE -> {
                Matcher m = SHOPEE_ID.matcher(url);
                yield m.find() ? (m.group(1) != null ? m.group(1) + "." + m.group(2) : m.group(3) + "." + m.group(4)) : codigo;
            }
            case ALIEXPRESS -> grupo(ALI_ID.matcher(url), codigo);
            case KABUM -> grupo(KABUM_ID.matcher(url), codigo);
        };
        if (c == null || c.isBlank()) return null;
        c = c.trim().toUpperCase(Locale.ROOT);
        return c.length() > 40 ? c.substring(0, 40) : c;
    }

    private static String grupo(Matcher m, String padrao) {
        return m.find() ? m.group(1) : padrao;
    }

    private static Loja loja(CapturaRequest req) {
        Loja l = Loja.de(req.loja());
        if (l == null) l = Loja.de(req.urlProduto());
        if (l == null) throw new NegocioException("Loja não reconhecida. Por enquanto: Mercado Livre, Shein, Shopee, AliExpress e KaBuM!.");
        return l;
    }

    @Transactional(readOnly = true)
    public Verificacao verificar(CapturaRequest req) {
        Loja l = loja(req);
        String codigo = codigoDe(l, req.codigo(), req.urlProduto());
        Parceiro p = parceiroExistente(l);
        Oferta o = codigo == null ? null : existente(l, p, codigo);
        Existente e = o == null ? null : new Existente(o.getProduto().getId(), o.getId(), o.getProduto().getDescricao(), o.getPreco(),
                o.getProduto().getCategoria() == null ? null : o.getProduto().getCategoria().getId(),
                o.getProduto().getImagemAtualizadaEm() != null, o.getUrl());
        List<Parecido> parecidos = e != null ? List.of() : parecidos(req.nome(), p);
        return new Verificacao(l.name(), p != null ? p.getNome() : l.nome, codigo, e, parecidos);
    }

    @Transactional
    public CapturaResponse salvar(CapturaRequest req) {
        Loja l = loja(req);
        BigDecimal preco = dinheiro(req.preco());
        if (preco == null || preco.signum() <= 0) throw new NegocioException("Informe o preço do produto");
        BigDecimal anterior = dinheiro(req.precoAnterior());
        String codigo = codigoDe(l, req.codigo(), req.urlProduto());
        if (codigo == null) throw new NegocioException("Não reconheci o código do produto nesse endereço. Abra a página do produto e capture de novo.");
        String link = req.linkAfiliado() == null ? "" : req.linkAfiliado().trim();
        validarLink(link);

        Parceiro parceiro = parceiroExistente(l);
        if (parceiro == null) parceiro = criarParceiro(l);
        LocalDateTime agora = LocalDateTime.now();

        Oferta o = existente(l, parceiro, codigo);
        boolean novo = o == null;
        BigDecimal precoAntes = novo ? null : o.getPreco();
        int bits = 0;
        Produto prod;
        if (novo && req.produtoId() != null) {
            // Mesmo produto vendido em outra loja: a oferta entra no produto que já existe (comparador).
            Produto alvo = produtos.findById(req.produtoId()).orElseThrow(() -> new RecursoNaoEncontradoException("Produto", req.produtoId()));
            Long parceiroId = parceiro.getId();
            Oferta daMesmaLoja = ofertas.doProduto(alvo.getId()).stream()
                    .filter(x -> x.getParceiro().getId().equals(parceiroId)).findFirst().orElse(null);
            if (daMesmaLoja != null) {
                o = daMesmaLoja;
                novo = false;
                precoAntes = o.getPreco();
            }
        }
        if (novo) {
            prod = req.produtoId() != null ? produtos.findById(req.produtoId()).orElseThrow()
                    : produtos.findFirstByCodigoIgnoreCase(l.prefixo + codigo.replace("P:", "")).orElse(null);
            if (prod == null) prod = novoProduto(l, codigo, req, preco);
            o = new Oferta();
            o.setProduto(prod);
            o.setParceiro(parceiro);
            o.setPreco(preco);
            o.setPrecoAnterior(anterior != null && anterior.compareTo(preco) > 0 ? anterior : null);
            if (Boolean.TRUE.equals(req.freteGratis())) o.setFrete(BigDecimal.ZERO);
            o.setDisponivel(true);
            o.setAtivo(true);
            o.setAtualizacaoAuto(l == Loja.MERCADO_LIVRE);
        } else {
            prod = o.getProduto();
            bits = PrecoRoboService.aplicarPreco(o, preco, anterior, req.freteGratis(), agora);
            if (!prod.isAtivo()) prod.setAtivo(true);
        }
        o.setUrl(link);
        if (req.urlProduto() != null && !req.urlProduto().isBlank()) o.setUrlProduto(corta(req.urlProduto().split("[?#]")[0], 2000));
        o.setCodigoExterno(codigo);
        if (req.nota() != null && req.nota().signum() > 0 && req.nota().compareTo(BigDecimal.valueOf(5)) <= 0) {
            o.setNota(req.nota().setScale(1, RoundingMode.HALF_UP));
        }
        o.setVerificadoEm(agora);
        o = ofertas.save(o);
        historico.save(new HistoricoPreco(o, o.getPreco()));
        if ((bits & 1) != 0) eventos.publishEvent(new br.com.erp.alerta.PrecoMudou(prod.getId()));

        // Mantém o preço do cadastro em dia (a vitrine usa a melhor oferta, mas o painel mostra este).
        prod.setPrecoVenda(o.getPreco());
        prod.setPrecoAnterior(o.getPrecoAnterior());
        if (req.categoriaId() != null && req.produtoId() == null) prod.setCategoria(categoria(req.categoriaId()));
        if (novo && req.detalhes() != null && !req.detalhes().isBlank() && prod.getDetalhes() == null) {
            prod.setDetalhes(corta(req.detalhes().trim(), 4000));
        }
        return new CapturaResponse(prod.getId(), o.getId(), prod.getDescricao(), novo, o.getPreco(), precoAntes,
                (bits & 2) != 0, prod.getImagemAtualizadaEm() != null);
    }

    private Produto novoProduto(Loja l, String codigo, CapturaRequest req, BigDecimal preco) {
        String nome = req.nome() == null ? "" : req.nome().replaceAll("\\s+", " ").trim();
        if (nome.isBlank()) throw new NegocioException("Informe o nome do produto");
        Produto p = new Produto();
        p.setCodigo(corta(l.prefixo + codigo.replace("P:", ""), 60));
        p.setDescricao(nome.length() > 120 ? nome.substring(0, 117).trim() + "..." : nome);
        p.setUnidade("UN");
        p.setPrecoCusto(BigDecimal.ZERO);
        p.setPrecoVenda(preco);
        if (req.categoriaId() != null) p.setCategoria(categoria(req.categoriaId()));
        return produtos.save(p);
    }

    private Categoria categoria(Long id) {
        return categorias.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Categoria", id));
    }

    private Parceiro parceiroExistente(Loja l) {
        var todos = parceiros.findAllByOrderByNomeAsc();
        if (l.rede != RedeAfiliado.OUTRA) {
            var mesmaRede = todos.stream().filter(p -> p.getRede() == l.rede).toList();
            if (mesmaRede.size() == 1) return mesmaRede.get(0);
            return mesmaRede.stream().filter(p -> p.getNome().equalsIgnoreCase(l.nome)).findFirst()
                    .orElse(mesmaRede.isEmpty() ? null : mesmaRede.get(0));
        }
        return todos.stream().filter(p -> p.getNome().equalsIgnoreCase(l.nome)).findFirst().orElse(null);
    }

    private Parceiro criarParceiro(Loja l) {
        Parceiro p = new Parceiro();
        p.setNome(l.nome);
        p.setRede(l.rede);
        p.setCor(l.cor);
        p.setSite(l.site);
        p.setAtivo(true);
        return parceiros.save(p);
    }

    /** Oferta já cadastrada desse produto nessa loja: pelo código da loja ou pelo código do produto. */
    private Oferta existente(Loja l, Parceiro p, String codigo) {
        if (p == null) return null;
        String semP = codigo.replace("P:", "");
        Oferta porCodigo = ofertas.findAll().stream()
                .filter(o -> o.getParceiro().getId().equals(p.getId()) && o.getCodigoExterno() != null
                        && o.getCodigoExterno().replace("P:", "").equalsIgnoreCase(semP))
                .findFirst().orElse(null);
        if (porCodigo != null) return porCodigo;
        return produtos.findFirstByCodigoIgnoreCase(l.prefixo + semP)
                .flatMap(prod -> ofertas.doProduto(prod.getId()).stream().filter(o -> o.getParceiro().getId().equals(p.getId())).findFirst())
                .orElse(null);
    }

    private static final Set<String> PALAVRAS_VAZIAS = Set.of("com", "para", "por", "sem", "das", "dos", "uma", "uns",
            "the", "and", "new", "kit", "original", "promocao", "lancamento", "unico", "unica", "cor", "tamanho", "br");

    static Set<String> palavras(String nome) {
        if (nome == null) return Set.of();
        String n = java.text.Normalizer.normalize(nome.toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        Set<String> r = new LinkedHashSet<>();
        for (String w : n.split("[^a-z0-9]+")) {
            if (w.length() >= 3 && !PALAVRAS_VAZIAS.contains(w)) r.add(w);
            else if (w.matches("\\d{2,}")) r.add(w); // números contam (128, 256gb…)
            if (w.matches("\\d+[a-z]+")) r.add(w.replaceAll("[a-z]+$", "")); // 256gb também vale 256
        }
        return r;
    }

    /** Semelhança entre nomes: palavras em comum sobre o menor conjunto (0 a 1). */
    static double semelhanca(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        long comuns = a.stream().filter(b::contains).count();
        return (double) comuns / Math.min(a.size(), b.size());
    }

    private List<Parecido> parecidos(String nome, Parceiro parceiro) {
        Set<String> alvo = palavras(nome);
        if (alvo.size() < 2) return List.of();
        record Nota(Produto p, double s) {
        }
        List<Nota> melhores = produtos.daVitrine().stream()
                .map(p -> new Nota(p, semelhanca(alvo, palavras(p.getDescricao()))))
                .filter(n -> n.s() >= 0.5)
                .sorted(Comparator.comparingDouble(Nota::s).reversed())
                .limit(4).toList();
        List<Parecido> r = new ArrayList<>();
        for (Nota n : melhores) {
            List<Oferta> os = ofertas.doProduto(n.p().getId());
            List<String> lojas = os.stream().map(o -> o.getParceiro().getNome()).distinct().toList();
            boolean mesma = parceiro != null && os.stream().anyMatch(o -> o.getParceiro().getId().equals(parceiro.getId()));
            BigDecimal preco = os.stream().filter(o -> o.isAtivo() && o.isDisponivel()).map(Oferta::getPreco)
                    .min(Comparator.naturalOrder()).orElse(n.p().getPrecoVenda());
            r.add(new Parecido(n.p().getId(), n.p().getDescricao(), preco, lojas, mesma));
        }
        return r;
    }

    private static BigDecimal dinheiro(BigDecimal v) {
        return v == null ? null : v.setScale(2, RoundingMode.HALF_UP);
    }

    private static String corta(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static void validarLink(String url) {
        try {
            URI u = URI.create(url);
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new NegocioException("Cole o seu link de afiliado (começa com https://)");
        }
    }
}
