package br.com.erp.integracao;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lê um link de loja (inclusive os curtos de afiliado, como meli.la/… e onelink.shein.com/…) no servidor
 * e tira nome, preço, foto e endereço do produto. É o que o app do celular usa quando o dono compartilha um link.
 * Só abre endereços das lojas conhecidas, para ninguém usar o servidor para visitar sites quaisquer.
 * Quando a loja não entrega a página (bloqueio, página feita só em JavaScript), devolve o que conseguiu e o celular completa à mão.
 */
@Slf4j
@Component
public class LeitorDeLink {

    private static final Set<String> SITES = Set.of(
            "meli.la", "mercadolivre.com.br", "mercadolibre.com", "mercadolivre.com",
            "shein.com", "shein.com.br", "onelink.shein.com", "shein.top", "api-shein.shein.com",
            "shopee.com.br", "shp.ee", "s.shopee.com.br",
            "aliexpress.com", "aliexpress.us", "a.aliexpress.com", "s.click.aliexpress.com",
            "kabum.com.br", "awin1.com");
    private static final Set<String> SITES_FOTO = Set.of(
            "mlstatic.com", "ltwebstatic.com", "shein.com", "susercontent.com", "shopee.com.br", "alicdn.com",
            "aliexpress-media.com", "kabum.com.br");
    private static final String NAVEGADOR = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
    private static final int MAX_PAGINA = 3 * 1024 * 1024;
    private static final int MAX_FOTO = 3 * 1024 * 1024;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final ObjectMapper json = new ObjectMapper();

    /** O que deu para ler do link. Campos nulos o celular pede para preencher. */
    public record Lido(String loja, String nome, BigDecimal preco, BigDecimal precoAnterior, Boolean freteGratis, BigDecimal nota,
                       String imagem, String urlProduto, String codigo, String detalhes, String link, List<String> avisos) {
    }

    record Pagina(String url, String html) {
    }

    public Lido ler(String link) {
        List<String> avisos = new ArrayList<>();
        URI inicio = uri(link);
        if (inicio == null || !permitido(inicio.getHost(), SITES)) {
            return new Lido(null, null, null, null, null, null, null, null, null, null, link,
                    List.of("Esse endereço não é de uma loja conhecida (Mercado Livre, Shein, Shopee, AliExpress ou KaBuM)."));
        }
        Pagina pg = abrir(inicio);
        if (pg == null) {
            avisos.add("A loja não deixou o servidor abrir a página. Preencha nome e preço à mão.");
            return new Lido(loja(link), null, null, null, null, null, null, null, null, null, link, avisos);
        }
        String loja = loja(pg.url());
        if (loja == null) loja = loja(link);

        // Perfil social do Mercado Livre (o que abre pelo meli.la): o produto em destaque leva à página dele.
        // Se a página do produto não abrir, o próprio perfil já traz nome, preço e foto no título de compartilhamento.
        String enderecoProduto = pg.url();
        if ("mercadolivre".equals(loja) && pg.url().contains("/social/")) {
            String produto = produtoEmDestaqueMl(pg.html(), extrair(pg.html()).nome);
            if (produto != null) {
                enderecoProduto = produto;
                URI u = uri(produto);
                Pagina pdp = u == null ? null : abrir(u);
                if (pdp != null) {
                    Dados teste = extrair(pdp.html());
                    if (teste.nome != null && teste.preco != null) pg = pdp;
                }
            }
        }

        // Link curto da Shein (onelink): a página só tem nome e foto; o código do produto aparece no endereço final.
        if ("shein".equals(loja) && !SHEIN_PRODUTO.matcher(enderecoProduto).find()) {
            String destino = destinoShein(link);
            if (destino != null) enderecoProduto = destino;
        }

        Dados d = extrair(pg.html());
        if (pg.url().contains("/social/")) {
            // O perfil mostra vários produtos: "frete grátis" e "preço antes" ali podem ser de outro.
            d.frete = null;
            d.anterior = null;
        }
        String urlProduto = limparUrl(enderecoProduto, loja);
        String imagem = melhorarFoto(d.imagem);
        if (d.nome == null) avisos.add("Não achei o nome do produto na página.");
        if (d.preco == null) avisos.add("Não achei o preço na página. Confira e preencha.");
        return new Lido(loja, d.nome, d.preco, maior(d.anterior, d.preco), d.frete, d.nota, imagem, urlProduto, null,
                d.descricao, link, avisos);
    }

    /** Baixa a foto do produto (só das lojas conhecidas), para salvar no servidor. */
    public byte[] baixarFoto(String url) {
        URI u = uri(melhorarFoto(url));
        if (u == null || !permitido(u.getHost(), SITES_FOTO)) return null;
        try {
            HttpResponse<InputStream> r = http.send(HttpRequest.newBuilder(u).timeout(Duration.ofSeconds(15))
                    .header("User-Agent", NAVEGADOR).header("Accept", "image/avif,image/webp,image/jpeg,image/*").GET().build(),
                    HttpResponse.BodyHandlers.ofInputStream());
            if (r.statusCode() != 200) return null;
            return limitado(r.body(), MAX_FOTO);
        } catch (Exception e) {
            log.info("Foto não baixada {}: {}", url, e.getMessage());
            return null;
        }
    }

    /* ============================== abrir páginas ============================== */

    private Pagina abrir(URI u) {
        URI atual = u;
        for (int salto = 0; salto < 8; salto++) {
            if (atual == null || !"https".equals(atual.getScheme()) && !"http".equals(atual.getScheme())) return null;
            if (!permitido(atual.getHost(), SITES)) {
                log.info("Link levou para fora das lojas conhecidas: {}", atual.getHost());
                return null;
            }
            try {
                HttpResponse<InputStream> r = http.send(HttpRequest.newBuilder(atual).timeout(Duration.ofSeconds(12))
                        .header("User-Agent", NAVEGADOR)
                        .header("Accept", "text/html,application/xhtml+xml")
                        .header("Accept-Language", "pt-BR,pt;q=0.9")
                        .GET().build(), HttpResponse.BodyHandlers.ofInputStream());
                int s = r.statusCode();
                if (s >= 300 && s < 400) {
                    String loc = r.headers().firstValue("location").orElse(null);
                    r.body().close();
                    if (loc == null) return null;
                    atual = atual.resolve(loc.replace(" ", "%20"));
                    continue;
                }
                if (s != 200) {
                    r.body().close();
                    log.info("Leitura de link: HTTP {} em {}", s, atual);
                    return null;
                }
                byte[] b = limitado(r.body(), MAX_PAGINA);
                if (b == null) return null;
                String html = new String(b, StandardCharsets.UTF_8);
                // Alguns links curtos redirecionam por meta refresh ou por JavaScript simples.
                String refresh = redirecionamentoNaPagina(html);
                if (refresh != null && !temDadosDeProduto(html)) {
                    atual = atual.resolve(refresh);
                    continue;
                }
                return new Pagina(atual.toString(), html);
            } catch (Exception e) {
                log.info("Leitura de link falhou em {}: {}", atual, e.getMessage());
                return null;
            }
        }
        return null;
    }

    private static byte[] limitado(InputStream in, int max) throws java.io.IOException {
        try (in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) {
                if (out.size() + n > max) return null;
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }

    private static final Pattern META_REFRESH = Pattern.compile("<meta[^>]+http-equiv=[\"']refresh[\"'][^>]+content=[\"'][^\"']*url=([^\"'>]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern JS_REDIRECT = Pattern.compile("(?:window\\.)?location(?:\\.href)?\\s*=\\s*[\"'](https?://[^\"']+)[\"']");

    private static String redirecionamentoNaPagina(String html) {
        Matcher m = META_REFRESH.matcher(html);
        if (m.find()) return desescapar(m.group(1).trim());
        if (html.length() < 20000) {
            m = JS_REDIRECT.matcher(html);
            if (m.find()) return desescapar(m.group(1));
        }
        return null;
    }

    private static boolean temDadosDeProduto(String html) {
        return html.contains("og:title") || html.contains("application/ld+json");
    }

    /* ============================== Shein ============================== */

    private static final Pattern SHEIN_PRODUTO = Pattern.compile("-p-\\d+", Pattern.CASE_INSENSITIVE);

    /** Segue o onelink com forceRed=1 (versão web) só pelos redirecionamentos, até o endereço com o código do produto. */
    private String destinoShein(String link) {
        URI atual = uri(link.contains("?") ? link.replaceFirst("\\?", "?forceRed=1&") : link + "?forceRed=1");
        for (int salto = 0; salto < 8 && atual != null; salto++) {
            if (SHEIN_PRODUTO.matcher(atual.toString()).find()) return atual.toString();
            if (!permitido(atual.getHost(), SITES)) return null;
            try {
                HttpResponse<InputStream> r = http.send(HttpRequest.newBuilder(atual).timeout(Duration.ofSeconds(10))
                        .header("User-Agent", NAVEGADOR).header("Accept", "text/html").GET().build(), HttpResponse.BodyHandlers.ofInputStream());
                int st = r.statusCode();
                if (st >= 300 && st < 400) {
                    String loc = r.headers().firstValue("location").orElse(null);
                    r.body().close();
                    if (loc == null) return null;
                    atual = atual.resolve(loc.replace(" ", "%20"));
                    continue;
                }
                byte[] b = st == 200 ? limitado(r.body(), MAX_PAGINA) : null;
                if (st != 200) r.body().close();
                if (b == null) return null;
                String html = desescapar(new String(b, StandardCharsets.UTF_8));
                Matcher m = Pattern.compile("https?://[a-z.]*shein\\.com[^\"'\\s<>]*-p-\\d+[^\"'\\s<>]*", Pattern.CASE_INSENSITIVE).matcher(html);
                if (m.find()) return m.group();
                String refresh = redirecionamentoNaPagina(html);
                atual = refresh == null ? null : atual.resolve(refresh);
            } catch (Exception e) {
                log.info("Onelink da Shein não resolvido: {}", e.getMessage());
                return null;
            }
        }
        return null;
    }

    /* ============================== Mercado Livre ============================== */

    private static final Pattern ML_PRODUTO = Pattern.compile(
            "https?://(?:www\\.)?mercadoli(?:vre|bre)\\.com(?:\\.br)?/[A-Za-z0-9%_\\-]+/(?:p|up)/MLBU?\\d+"
            + "|https?://produto\\.mercadoli(?:vre|bre)\\.com(?:\\.br)?/MLB-\\d+[A-Za-z0-9%_\\-]*");

    /**
     * No perfil social aparecem vários produtos; o do link é o que tem o nome do título de compartilhamento.
     * Escolhe o endereço cujo trecho de texto mais se parece com esse nome.
     */
    static String produtoEmDestaqueMl(String html, String nome) {
        String h = desescapar(html);
        Set<String> alvo = palavras(nome);
        String melhor = null;
        int melhorPontos = 0;
        Matcher m = ML_PRODUTO.matcher(h);
        while (m.find()) {
            String u = m.group();
            int pontos = 0;
            for (String w : palavras(u.replace('-', ' ').replace('/', ' '))) if (alvo.contains(w)) pontos++;
            if (pontos > melhorPontos) {
                melhorPontos = pontos;
                melhor = u;
            }
        }
        return melhorPontos >= 2 ? melhor : null;
    }

    private static Set<String> palavras(String s) {
        Set<String> r = new java.util.HashSet<>();
        if (s == null) return r;
        String t = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        for (String w : t.split("[^a-z0-9]+")) if (w.length() >= 3) r.add(w);
        return r;
    }

    /* ============================== leitura genérica ============================== */

    static final class Dados {
        String nome, imagem, descricao;
        BigDecimal preco, anterior, nota;
        Boolean frete;
    }

    private static final Pattern LD_JSON = Pattern.compile("<script[^>]+application/ld\\+json[^>]*>(.*?)</script>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern ANTES_ML = Pattern.compile("aria-label=\"(?:Antes|Preço anterior):\\s*([\\d.]+)\\s*reais(?:\\s*com\\s*(\\d+)\\s*centavos)?", Pattern.CASE_INSENSITIVE);
    private static final Pattern SHEIN_VENDA = Pattern.compile("\"salePrice\"\\s*:\\s*\\{[^}]*?\"amount\"\\s*:\\s*\"([\\d.]+)\"");
    private static final Pattern SHEIN_CHEIO = Pattern.compile("\"retailPrice\"\\s*:\\s*\\{[^}]*?\"amount\"\\s*:\\s*\"([\\d.]+)\"");
    private static final Pattern NOME_COM_PRECO = Pattern.compile("\\s*[-–]\\s*R\\$\\s*([\\d.]+(?:,\\d{2})?)\\s*$");
    private static final Pattern FRETE = Pattern.compile("frete gr[aá]tis|envio gr[aá]tis|chegar[aá] gr[aá]tis", Pattern.CASE_INSENSITIVE);

    Dados extrair(String html) {
        Dados d = new Dados();
        Matcher m = LD_JSON.matcher(html);
        while (m.find() && d.nome == null) {
            try {
                JsonNode raiz = json.readTree(m.group(1).trim());
                JsonNode p = acharProduto(raiz);
                if (p == null) continue;
                d.nome = texto(p.path("name"));
                d.descricao = cortar(texto(p.path("description")), 1500);
                JsonNode img = p.path("image");
                d.imagem = img.isArray() ? texto(img.path(0).isObject() ? img.path(0).path("url") : img.path(0))
                        : img.isObject() ? texto(img.path("url")) : texto(img);
                JsonNode of = p.path("offers");
                if (of.isArray()) of = of.path(0);
                d.preco = numero(of.has("price") ? of.path("price") : of.path("lowPrice"));
                d.nota = numero(p.path("aggregateRating").path("ratingValue"));
            } catch (Exception ignorado) {
                // bloco de dados quebrado: tenta o próximo
            }
        }
        if (d.nome == null) d.nome = meta(html, "og:title");
        if (d.imagem == null) d.imagem = meta(html, "og:image");
        if (d.preco == null) d.preco = numero(meta(html, "product:price:amount"));
        if (d.preco == null) {
            Matcher s = SHEIN_VENDA.matcher(html);
            if (s.find()) d.preco = numero(s.group(1));
        }
        Matcher a = ANTES_ML.matcher(html);
        if (a.find()) d.anterior = numero(a.group(1).replace(".", "") + (a.group(2) != null ? "." + a.group(2) : ""));
        if (d.anterior == null) {
            Matcher s = SHEIN_CHEIO.matcher(html);
            if (s.find()) d.anterior = numero(s.group(1));
        }
        if (FRETE.matcher(html).find()) d.frete = true;
        if (d.nome != null) {
            // Títulos de compartilhamento do Mercado Livre: "Nome do produto - R$ 72,60".
            Matcher np = NOME_COM_PRECO.matcher(d.nome.trim());
            if (np.find()) {
                if (d.preco == null) d.preco = numero(np.group(1).replace(".", "").replace(",", "."));
                d.nome = d.nome.trim().substring(0, np.start());
            }
            d.nome = limparNome(d.nome);
        }
        if (d.descricao == null) d.descricao = cortar(meta(html, "og:description"), 1500);
        // "Olha o que eu encontrei! …" é o texto de compartilhamento, não a descrição do produto.
        if (d.descricao != null && d.descricao.toLowerCase(Locale.ROOT).startsWith("olha o que eu encontrei")) d.descricao = null;
        return d;
    }

    private static JsonNode acharProduto(JsonNode n) {
        if (n == null) return null;
        if (n.isArray()) {
            for (JsonNode x : n) {
                JsonNode p = acharProduto(x);
                if (p != null) return p;
            }
            return null;
        }
        if (n.has("@graph")) return acharProduto(n.get("@graph"));
        String tipo = n.path("@type").toString();
        return tipo.contains("Product") ? n : null;
    }

    private static final Pattern META = Pattern.compile("<meta\\s[^>]*>", Pattern.CASE_INSENSITIVE);

    static String meta(String html, String nome) {
        Matcher m = META.matcher(html);
        while (m.find()) {
            String tag = m.group();
            String chave = atributo(tag, "property");
            if (chave == null) chave = atributo(tag, "name");
            if (nome.equalsIgnoreCase(chave)) {
                String v = atributo(tag, "content");
                return v == null || v.isBlank() ? null : desescapar(v.trim());
            }
        }
        return null;
    }

    private static String atributo(String tag, String nome) {
        Matcher m = Pattern.compile("\\s" + nome + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)')", Pattern.CASE_INSENSITIVE).matcher(tag);
        return m.find() ? (m.group(2) != null ? m.group(2) : m.group(3)) : null;
    }

    /* ============================== utilidades ============================== */

    static String loja(String url) {
        String s = url == null ? "" : url.toLowerCase(Locale.ROOT);
        if (s.contains("mercadoli") || s.contains("meli.la")) return "mercadolivre";
        if (s.contains("shein")) return "shein";
        if (s.contains("shopee") || s.contains("shp.ee")) return "shopee";
        if (s.contains("aliexpress")) return "aliexpress";
        if (s.contains("kabum")) return "kabum";
        return null;
    }

    static boolean permitido(String host, Set<String> sites) {
        if (host == null) return false;
        String h = host.toLowerCase(Locale.ROOT);
        for (String s : sites) if (h.equals(s) || h.endsWith("." + s)) return true;
        return false;
    }

    private static URI uri(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            URI u = URI.create(s.trim().replace(" ", "%20"));
            return u.getHost() == null ? null : u;
        } catch (Exception e) {
            return null;
        }
    }

    /** Tira rastreios do endereço; no Mercado Livre mantém o anúncio escolhido (pdp_filters). */
    static String limparUrl(String url, String loja) {
        if (url == null) return null;
        String base = url.split("#")[0];
        if ("mercadolivre".equals(loja)) {
            Matcher item = Pattern.compile("item_id(?:%3A|:)(MLB\\d+)", Pattern.CASE_INSENSITIVE).matcher(base);
            String semQuery = base.split("\\?")[0];
            return item.find() ? semQuery + "?pdp_filters=item_id%3A" + item.group(1) : semQuery;
        }
        if ("shein".equals(loja) || "kabum".equals(loja) || "aliexpress".equals(loja)) return base.split("\\?")[0];
        return base;
    }

    /** Pede a foto grande em vez da miniatura (Mercado Livre e Shein). */
    static String melhorarFoto(String url) {
        if (url == null) return null;
        String u = url.startsWith("//") ? "https:" + url : url;
        if (u.contains("ltwebstatic.com")) u = u.replaceAll("_thumbnail_\\d+x\\d*", "_thumbnail_900x");
        if (u.contains("mlstatic.com")) u = u.replaceAll("D_N?Q_NP_(2X_)?", "D_NQ_NP_2X_").replaceAll("-[A-Z]{1,2}(-[^/.]*)?\\.(webp|jpg|png)$", "-F.jpg");
        return u;
    }

    private static String desescapar(String s) {
        return s.replace("\\u002F", "/").replace("\\u002f", "/").replace("\\/", "/").replace("&amp;", "&").replace("&quot;", "\"").replace("&#x27;", "'").replace("&#39;", "'");
    }

    private static String limparNome(String nome) {
        String n = desescapar(nome).replaceAll("\\s+", " ").trim();
        n = n.replaceAll("\\s*[|\\-–]\\s*(Mercado Livre|SHEIN.*|Shopee.*|AliExpress.*|KaBuM!?.*)$", "");
        return cortar(n, 120);
    }

    private static String cortar(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max).trim() : t;
    }

    private static String texto(JsonNode n) {
        return n == null || n.isMissingNode() || n.isNull() ? null : (n.isTextual() ? n.asText() : n.toString());
    }

    private static BigDecimal numero(JsonNode n) {
        if (n == null || n.isMissingNode() || n.isNull()) return null;
        return numero(n.asText());
    }

    private static BigDecimal numero(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            BigDecimal v = new BigDecimal(s.trim());
            return v.signum() > 0 ? v.setScale(2, RoundingMode.HALF_UP) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static BigDecimal maior(BigDecimal anterior, BigDecimal preco) {
        return anterior != null && preco != null && anterior.compareTo(preco) > 0 ? anterior : null;
    }
}
