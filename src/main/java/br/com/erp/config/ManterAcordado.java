package br.com.erp.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * O plano grátis do Render desliga o servidor depois de 15 minutos sem receber visitas, e ele leva
 * alguns minutos para voltar. Este agendador visita o próprio endereço público a cada 10 minutos
 * (a requisição entra pelo Render como uma visita normal), então o servidor nunca chega a dormir.
 *
 * <p>Usa {@code /actuator/health}, que não consulta o banco ({@code management.health.db.enabled=false}):
 * assim o Neon continua dormindo quando não há uso de verdade e não gasta as horas grátis.
 *
 * <p>O endereço vem de {@code RENDER_EXTERNAL_URL}, que o Render preenche sozinho. Fora do Render
 * (ou com {@code MANTER_ACORDADO=false}) não faz nada.
 */
@Component
public class ManterAcordado {

    private static final Logger log = LoggerFactory.getLogger(ManterAcordado.class);

    private final String url;
    private final boolean ligado;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public ManterAcordado(@Value("${app.manter-acordado.url:}") String url,
                          @Value("${app.manter-acordado.ligado:true}") boolean ligado) {
        this.url = url == null ? "" : url.replaceAll("/+$", "");
        this.ligado = ligado;
        if (ligado && !this.url.isBlank()) {
            log.info("Manter acordado: visitando {}/actuator/health a cada 10 minutos", this.url);
        }
    }

    @Scheduled(initialDelayString = "PT2M", fixedDelayString = "${app.manter-acordado.intervalo:PT10M}")
    public void cutucar() {
        if (!ligado || url.isBlank()) return;
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url + "/actuator/health"))
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", "vetrina-manter-acordado")
                    .GET().build();
            int status = http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status != 200) log.warn("Manter acordado: resposta {}", status);
        } catch (Exception e) {
            log.warn("Manter acordado: falhou ({})", e.getMessage());
        }
    }
}
