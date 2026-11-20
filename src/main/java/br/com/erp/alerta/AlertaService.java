package br.com.erp.alerta;

import br.com.erp.afiliado.Oferta;
import br.com.erp.afiliado.OfertaRepository;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.produto.Produto;
import br.com.erp.produto.ProdutoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.NumberFormat;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * "Me avise quando baixar" por notificação do navegador (Web Push), sem serviço pago.
 * As chaves VAPID são criadas na primeira vez e ficam no banco.
 */
@Service
public class AlertaService {

    private static final Logger log = LoggerFactory.getLogger(AlertaService.class);
    /** Só serviços de push dos navegadores: o servidor nunca chama outro endereço que alguém mandar. */
    private static final List<String> SERVICOS_PUSH = List.of(
            "fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com",
            ".notify.windows.com", "web.push.apple.com", "push.apple.com");
    private static final int MAX_POR_NAVEGADOR = 100;

    private final AlertaPrecoRepository alertas;
    private final ConfiguracaoRepository configs;
    private final ProdutoRepository produtos;
    private final OfertaRepository ofertas;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    private final String contato;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ExecutorService fila = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "alertas-preco");
        t.setDaemon(true);
        return t;
    });
    private volatile WebPush.ChavesVapid chaves;

    public AlertaService(AlertaPrecoRepository alertas, ConfiguracaoRepository configs, ProdutoRepository produtos,
                         OfertaRepository ofertas, PlatformTransactionManager txManager, ObjectMapper json,
                         @Value("${app.alertas.contato:mailto:${app.admin.email:admin@erp.com}}") String contato) {
        this.alertas = alertas;
        this.configs = configs;
        this.produtos = produtos;
        this.ofertas = ofertas;
        this.tx = new TransactionTemplate(txManager);
        this.json = json;
        this.contato = contato.startsWith("mailto:") || contato.startsWith("https:") ? contato : "mailto:" + contato;
    }

    public record Inscricao(String endpoint, Map<String, String> keys) {
    }

    // ---------------- chaves ----------------

    public String chavePublica() {
        return chaves().publica();
    }

    private WebPush.ChavesVapid chaves() {
        WebPush.ChavesVapid c = chaves;
        if (c != null) return c;
        synchronized (this) {
            if (chaves == null) {
                chaves = tx.execute(s -> {
                    var pub = configs.findById("vapid.publica");
                    var priv = configs.findById("vapid.privada");
                    if (pub.isPresent() && priv.isPresent()) return new WebPush.ChavesVapid(pub.get().getValor(), priv.get().getValor());
                    WebPush.ChavesVapid n = WebPush.gerarChaves();
                    configs.save(new Configuracao("vapid.publica", n.publica()));
                    configs.save(new Configuracao("vapid.privada", n.privada()));
                    log.info("Chaves das notificações criadas");
                    return n;
                });
            }
            return chaves;
        }
    }

    // ---------------- inscrição ----------------

    public BigDecimal inscrever(Long produtoId, Inscricao ins) {
        String endpoint = validarEndpoint(ins == null ? null : ins.endpoint());
        String p256dh = ins.keys() == null ? null : ins.keys().get("p256dh");
        String auth = ins.keys() == null ? null : ins.keys().get("auth");
        if (p256dh == null || auth == null || p256dh.length() > 200 || auth.length() > 100) {
            throw new NegocioException("Inscrição de notificação inválida");
        }
        return tx.execute(s -> {
            Produto p = produtos.findById(produtoId).filter(Produto::isAtivo)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Produto", produtoId));
            AlertaPreco a = alertas.findByProdutoIdAndEndpoint(produtoId, endpoint).orElse(null);
            if (a == null) {
                if (alertas.countByEndpointAndAtivoTrue(endpoint) >= MAX_POR_NAVEGADOR) {
                    throw new NegocioException("Você já acompanha muitos produtos. Remova algum aviso antes.");
                }
                a = new AlertaPreco();
                a.setProduto(p);
                a.setEndpoint(endpoint);
            }
            BigDecimal atual = precoAtual(p);
            a.setP256dh(p256dh);
            a.setAuth(auth);
            a.setPrecoReferencia(atual);
            a.setAtivo(true);
            alertas.save(a);
            return atual;
        });
    }

    public void remover(Long produtoId, String endpoint) {
        tx.executeWithoutResult(s -> alertas.findByProdutoIdAndEndpoint(produtoId, endpoint).ifPresent(a -> a.setAtivo(false)));
    }

    static String validarEndpoint(String endpoint) {
        try {
            URI u = URI.create(endpoint);
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
            boolean conhecido = SERVICOS_PUSH.stream().anyMatch(s -> s.startsWith(".") ? host.endsWith(s) : host.equals(s) || host.endsWith("." + s));
            if (!"https".equals(u.getScheme()) || !conhecido || endpoint.length() > 1000) throw new IllegalArgumentException();
            return endpoint;
        } catch (RuntimeException e) {
            throw new NegocioException("Este navegador não é compatível com os avisos de preço");
        }
    }

    /** Preço que a vitrine mostra: a oferta disponível mais barata, ou o preço do produto. */
    BigDecimal precoAtual(Produto p) {
        return ofertas.doProduto(p.getId()).stream()
                .filter(o -> o.isAtivo() && o.isDisponivel() && o.getParceiro().isAtivo())
                .map(Oferta::getPreco).min(Comparator.naturalOrder())
                .orElse(p.getPrecoVenda());
    }

    // ---------------- avisos ----------------

    /** Depois que a mudança de preço é gravada, confere os avisos do produto (em segundo plano). */
    @TransactionalEventListener(fallbackExecution = true)
    public void aoMudarPreco(PrecoMudou e) {
        if (e.produtoId() == null) return;
        fila.submit(() -> {
            try {
                verificar(e.produtoId());
            } catch (Exception ex) {
                log.warn("Avisos do produto {} falharam: {}", e.produtoId(), ex.getMessage());
            }
        });
    }

    /** Envia notificação para quem acompanha o produto e o preço caiu abaixo da referência. Retorna quantas foram. */
    public int verificar(Long produtoId) {
        record Envio(Long id, String endpoint, String p256dh, String auth, BigDecimal de) {
        }
        record Dados(List<Envio> envios, BigDecimal atual, String nome, String loja) {
        }
        Dados d = tx.execute(s -> {
            List<AlertaPreco> lista = alertas.ativosDoProduto(produtoId);
            if (lista.isEmpty()) return null;
            Produto p = lista.get(0).getProduto();
            if (!p.isAtivo()) return null;
            BigDecimal atual = precoAtual(p);
            String loja = ofertas.doProduto(p.getId()).stream()
                    .filter(o -> o.isAtivo() && o.isDisponivel() && o.getPreco().compareTo(atual) == 0)
                    .map(o -> o.getParceiro().getNome()).findFirst().orElse(null);
            List<Envio> envios = lista.stream().filter(a -> a.getPrecoReferencia().compareTo(atual) > 0)
                    .map(a -> new Envio(a.getId(), a.getEndpoint(), a.getP256dh(), a.getAuth(), a.getPrecoReferencia())).toList();
            return new Dados(envios, atual, p.getDescricao(), loja);
        });
        if (d == null || d.envios().isEmpty()) return 0;

        int ok = 0;
        Set<Long> enviados = new HashSet<>();
        Set<Long> mortos = new HashSet<>();
        for (Envio en : d.envios()) {
            String corpo = "De " + reais(en.de()) + " por " + reais(d.atual()) + (d.loja() != null ? " " + naLoja(d.loja()) : "") + ". Toque para ver.";
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("titulo", "Baixou! " + d.nome());
            msg.put("corpo", corpo);
            msg.put("url", "/loja/p/" + produtoId);
            msg.put("imagem", "/api/img?id=" + produtoId);
            msg.put("tag", "preco-" + produtoId);
            int status = enviar(en.endpoint(), en.p256dh(), en.auth(), msg);
            if (status >= 200 && status < 300) {
                ok++;
                enviados.add(en.id());
            } else if (status == 404 || status == 410) {
                mortos.add(en.id()); // a pessoa bloqueou ou desinstalou: não adianta tentar de novo
            }
        }
        tx.executeWithoutResult(s -> {
            alertas.findAllById(enviados).forEach(a -> {
                a.setPrecoReferencia(d.atual());
                a.setAvisadoEm(LocalDateTime.now());
                a.setAvisos(a.getAvisos() + 1);
            });
            alertas.findAllById(mortos).forEach(a -> a.setAtivo(false));
        });
        log.info("Produto {}: {} aviso(s) de preço enviados", produtoId, ok);
        return ok;
    }

    /** Notificação de teste para um navegador (o próprio dono confere se está funcionando). */
    public int testar(Inscricao ins) {
        String endpoint = validarEndpoint(ins.endpoint());
        Map<String, Object> msg = Map.of("titulo", "Avisos ativados", "corpo", "Assim chega o aviso quando um preço baixar.", "url", "/loja", "tag", "teste");
        return enviar(endpoint, ins.keys().get("p256dh"), ins.keys().get("auth"), msg);
    }

    /** Manda uma notificação de teste para todos que acompanham o produto, sem mexer no preço. */
    public int testarProduto(Long produtoId) {
        record Alvo(String endpoint, String p256dh, String auth) {
        }
        List<Alvo> alvos = tx.execute(s -> alertas.ativosDoProduto(produtoId).stream()
                .map(a -> new Alvo(a.getEndpoint(), a.getP256dh(), a.getAuth())).toList());
        int ok = 0;
        for (Alvo a : alvos) {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("titulo", "Teste: avisos da Vetrina");
            msg.put("corpo", "Está tudo certo! É assim que chega o aviso quando o preço baixar.");
            msg.put("url", "/loja/p/" + produtoId);
            msg.put("imagem", "/api/img?id=" + produtoId);
            msg.put("tag", "teste-" + produtoId);
            int st = enviar(a.endpoint(), a.p256dh(), a.auth(), msg);
            if (st >= 200 && st < 300) ok++;
        }
        return ok;
    }

    private int enviar(String endpoint, String p256dh, String auth, Map<String, Object> msg) {
        try {
            byte[] corpo = WebPush.criptografar(json.writeValueAsBytes(msg), p256dh, auth);
            HttpRequest req = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", WebPush.autorizacao(endpoint, chaves(), contato, System.currentTimeMillis() / 1000))
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("TTL", String.valueOf(3 * 24 * 3600))
                    .header("Urgency", "normal")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(corpo))
                    .build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() >= 300) log.warn("Push respondeu {}: {}", r.statusCode(), r.body().length() > 200 ? r.body().substring(0, 200) : r.body());
            return r.statusCode();
        } catch (Exception e) {
            log.warn("Falha ao enviar push: {}", e.getMessage());
            return -1;
        }
    }

    private static String reais(BigDecimal v) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(v.setScale(2, RoundingMode.HALF_UP)).replace(' ', ' ');
    }

    private static String naLoja(String loja) {
        String l = loja.toLowerCase(Locale.ROOT);
        return (l.startsWith("mercado") || l.startsWith("magazine") ? "no " : "na ") + loja;
    }
}
