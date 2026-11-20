package br.com.erp.integracao;

import br.com.erp.common.NegocioException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Cliente da API oficial do Mercado Livre (OAuth "authorization code").
 * O access token vale ~6 h; o refresh token é de uso único e é trocado a cada renovação.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MercadoLivreClient {

    public static final String PROVEDOR = "MERCADO_LIVRE";
    private static final String API = "https://api.mercadolibre.com";
    private static final String AUTH = "https://auth.mercadolivre.com.br/authorization";

    private final IntegracaoContaRepository contas;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL).build();
    private final Map<String, LocalDateTime> estados = new ConcurrentHashMap<>();

    @Value("${app.integracoes.mercadolivre.client-id:}")
    private String clientId;
    @Value("${app.integracoes.mercadolivre.client-secret:}")
    private String clientSecret;
    @Value("${app.integracoes.mercadolivre.redirect-uri:}")
    private String redirectUri;

    public boolean configurado() {
        return !clientId.isBlank() && !clientSecret.isBlank() && !redirectUri.isBlank();
    }

    public Optional<IntegracaoConta> conta() {
        return contas.findById(PROVEDOR).filter(c -> c.getRefreshToken() != null);
    }

    // ---------------- OAuth ----------------

    public String urlAutorizacao() {
        if (!configurado()) {
            throw new NegocioException("Configure ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI no servidor");
        }
        estados.entrySet().removeIf(e -> e.getValue().isBefore(LocalDateTime.now()));
        String state = java.util.UUID.randomUUID().toString();
        estados.put(state, LocalDateTime.now().plusMinutes(15));
        return AUTH + "?response_type=code&client_id=" + enc(clientId) + "&redirect_uri=" + enc(redirectUri) + "&state=" + state;
    }

    @Transactional
    public IntegracaoConta concluirAutorizacao(String code, String state) {
        if (state == null || estados.remove(state) == null) {
            throw new NegocioException("Pedido de conexão expirado ou inválido. Clique em Conectar de novo.");
        }
        JsonNode t = token(Map.of("grant_type", "authorization_code", "code", code, "redirect_uri", redirectUri));
        IntegracaoConta c = contas.findById(PROVEDOR).orElseGet(() -> {
            IntegracaoConta n = new IntegracaoConta();
            n.setProvedor(PROVEDOR);
            return n;
        });
        guardar(c, t);
        c.setConectadoEm(LocalDateTime.now());
        try {
            JsonNode eu = getJson("/users/me", c.getAccessToken());
            c.setApelido(eu.path("nickname").asText(null));
        } catch (Exception e) {
            log.warn("Não foi possível ler o apelido da conta do Mercado Livre: {}", e.getMessage());
        }
        return contas.save(c);
    }

    @Transactional
    public void desconectar() {
        contas.findById(PROVEDOR).ifPresent(contas::delete);
    }

    /** Access token válido, renovando quando estiver perto de vencer. */
    @Transactional
    public synchronized String accessToken() {
        IntegracaoConta c = conta().orElseThrow(() ->
                new NegocioException("Conecte sua conta do Mercado Livre em Afiliados para buscar preços automaticamente"));
        if (c.getExpiraEm() == null || c.getExpiraEm().isBefore(LocalDateTime.now().plusMinutes(10))) {
            renovar(c);
        }
        return c.getAccessToken();
    }

    private void renovar(IntegracaoConta c) {
        JsonNode t = token(Map.of("grant_type", "refresh_token", "refresh_token", c.getRefreshToken()));
        guardar(c, t);
        contas.save(c);
    }

    private void guardar(IntegracaoConta c, JsonNode t) {
        c.setAccessToken(t.path("access_token").asText());
        if (t.hasNonNull("refresh_token")) c.setRefreshToken(t.path("refresh_token").asText());
        c.setUsuarioExterno(t.path("user_id").asText(null));
        c.setExpiraEm(LocalDateTime.now().plusSeconds(t.path("expires_in").asLong(21600)));
    }

    private JsonNode token(Map<String, String> extra) {
        if (!configurado()) throw new NegocioException("Integração com o Mercado Livre não configurada no servidor");
        Map<String, String> form = new java.util.LinkedHashMap<>(extra);
        form.put("client_id", clientId);
        form.put("client_secret", clientSecret);
        String body = form.entrySet().stream().map(e -> e.getKey() + "=" + enc(e.getValue())).collect(Collectors.joining("&"));
        HttpRequest req = HttpRequest.newBuilder(URI.create(API + "/oauth/token"))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        try {
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode j = json.readTree(r.body());
            if (r.statusCode() != 200) {
                String erro = j.path("message").asText(j.path("error").asText("erro " + r.statusCode()));
                throw new NegocioException("Mercado Livre recusou a autorização: " + erro + ". Conecte a conta de novo.");
            }
            return j;
        } catch (IOException e) {
            throw new NegocioException("Sem resposta do Mercado Livre: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new NegocioException("Operação interrompida");
        }
    }

    // ---------------- consultas ----------------

    private JsonNode getJson(String path, String token) throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder(URI.create(API + path)).timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json").header("Authorization", "Bearer " + token).GET().build();
        HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() == 404) throw new NaoEncontrado();
        if (r.statusCode() >= 400) throw new IOException("HTTP " + r.statusCode() + " em " + path);
        return json.readTree(r.body());
    }

    /** GET autenticado; em 401 renova o token uma vez e tenta de novo. */
    private JsonNode get(String path) throws IOException, InterruptedException {
        try {
            return getJson(path, accessToken());
        } catch (IOException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("HTTP 401")) {
                conta().ifPresent(this::renovar);
                return getJson(path, accessToken());
            }
            throw e;
        }
    }

    static final class NaoEncontrado extends IOException {
        NaoEncontrado() { super("não encontrado"); }
    }

    private static final Pattern ITEM_NA_URL = Pattern.compile("item_id(?:%3A|:)(MLB\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PRODUTO_CATALOGO = Pattern.compile("/p/(MLB\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ANUNCIO = Pattern.compile("MLB-?(\\d{6,})", Pattern.CASE_INSENSITIVE);

    /** Extrai o código do Mercado Livre de um endereço de produto: "MLB123" (anúncio) ou "P:MLB123" (catálogo). */
    public static String codigoDaUrl(String url) {
        if (url == null) return null;
        Matcher m = ITEM_NA_URL.matcher(url);
        if (m.find()) return m.group(1).toUpperCase();
        m = PRODUTO_CATALOGO.matcher(url);
        if (m.find()) return "P:" + m.group(1).toUpperCase();
        m = ANUNCIO.matcher(url);
        if (m.find() && !url.contains("/up/MLBU")) return "MLB" + m.group(1);
        return null;
    }

    /** Consulta o produto na API. Aceita "MLB123" (anúncio), "P:MLB123" (catálogo) ou um código sem prefixo (tenta os dois). */
    public DadosLoja consultar(String codigo) {
        try {
            if (codigo.startsWith("P:")) return produtoCatalogo(codigo.substring(2));
            try {
                return item(codigo);
            } catch (NaoEncontrado e) {
                return produtoCatalogo(codigo);
            }
        } catch (NaoEncontrado e) {
            throw new NegocioException("Produto " + codigo + " não encontrado no Mercado Livre");
        } catch (IOException e) {
            throw new NegocioException("Falha ao consultar o Mercado Livre: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new NegocioException("Operação interrompida");
        }
    }

    private DadosLoja item(String id) throws IOException, InterruptedException {
        JsonNode i = get("/items/" + id);
        BigDecimal preco = dec(i.path("price"));
        BigDecimal anterior = dec(i.path("original_price"));
        // Preço promocional vigente (quando o vendedor tem campanha ativa).
        try {
            JsonNode sp = get("/items/" + id + "/sale_price?context=channel_marketplace");
            BigDecimal amount = dec(sp.path("amount"));
            if (amount != null && amount.signum() > 0) {
                preco = amount;
                BigDecimal regular = dec(sp.path("regular_amount"));
                if (regular != null && regular.compareTo(amount) > 0) anterior = regular;
            }
        } catch (IOException e) {
            log.debug("sale_price indisponível para {}: {}", id, e.getMessage());
        }
        boolean ativo = "active".equals(i.path("status").asText()) && i.path("available_quantity").asInt(1) > 0;
        String foto = i.path("pictures").path(0).path("secure_url").asText(i.path("thumbnail").asText(null));
        return new DadosLoja(id, i.path("title").asText(null), preco, maior(anterior, preco),
                i.path("shipping").has("free_shipping") ? i.path("shipping").path("free_shipping").asBoolean() : null,
                ativo && preco != null, foto, i.path("permalink").asText(null));
    }

    private DadosLoja produtoCatalogo(String id) throws IOException, InterruptedException {
        JsonNode p = get("/products/" + id);
        JsonNode w = p.path("buy_box_winner");
        BigDecimal preco = dec(w.path("price"));
        BigDecimal anterior = dec(w.path("original_price"));
        Boolean frete = w.path("shipping").has("free_shipping") ? w.path("shipping").path("free_shipping").asBoolean() : null;
        String itemVencedor = w.path("item_id").asText(null);
        if (preco == null) {
            // Sem vencedor da "buy box": pega a oferta mais barata entre os anúncios do produto.
            JsonNode itens = get("/products/" + id + "/items").path("results");
            for (JsonNode it : itens) {
                BigDecimal pr = dec(it.path("price"));
                if (pr != null && (preco == null || pr.compareTo(preco) < 0)) {
                    preco = pr;
                    anterior = dec(it.path("original_price"));
                    frete = it.path("shipping").has("free_shipping") ? it.path("shipping").path("free_shipping").asBoolean() : null;
                    itemVencedor = it.path("item_id").asText(null);
                }
            }
        }
        String foto = p.path("pictures").path(0).path("url").asText(null);
        boolean disponivel = preco != null && !"inactive".equals(p.path("status").asText());
        return new DadosLoja("P:" + id, p.path("name").asText(null), preco, maior(anterior, preco), frete, disponivel, foto,
                p.path("permalink").asText(itemVencedor == null ? null : "https://produto.mercadolivre.com.br/" + itemVencedor));
    }

    /** Baixa a imagem do produto (só de domínios do Mercado Livre). */
    public byte[] baixarImagem(String url) {
        if (url == null) return null;
        try {
            URI u = URI.create(url.replace("http://", "https://"));
            if (u.getHost() == null || !(u.getHost().endsWith("mlstatic.com") || u.getHost().endsWith("mercadolibre.com"))) return null;
            HttpResponse<byte[]> r = http.send(HttpRequest.newBuilder(u).timeout(Duration.ofSeconds(20)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            return r.statusCode() == 200 ? r.body() : null;
        } catch (Exception e) {
            log.warn("Falha ao baixar imagem {}: {}", url, e.getMessage());
            return null;
        }
    }

    private static BigDecimal dec(JsonNode n) {
        return n == null || n.isMissingNode() || n.isNull() || !n.isNumber() ? null : n.decimalValue().setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static BigDecimal maior(BigDecimal anterior, BigDecimal preco) {
        return anterior != null && preco != null && anterior.compareTo(preco) > 0 ? anterior : null;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
