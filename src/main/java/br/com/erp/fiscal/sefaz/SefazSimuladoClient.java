package br.com.erp.fiscal.sefaz;

import br.com.erp.fiscal.ChaveAcesso;
import br.com.erp.fiscal.NotaFiscal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * SEFAZ simulada para desenvolvimento: valida o básico e autoriza localmente.
 * Ativa quando app.nfe.sefaz=simulado (padrão).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.nfe.sefaz", havingValue = "simulado", matchIfMissing = true)
public class SefazSimuladoClient implements SefazClient {

    @Override
    public RetornoSefaz autorizar(NotaFiscal nota) {
        if (!ChaveAcesso.valida(nota.getChaveAcesso())) {
            return new RetornoSefaz(false, "502", "Rejeição: Erro na Chave de Acesso", null);
        }
        boolean semNcm = nota.getItens().stream().anyMatch(i -> i.getNcm() == null || i.getNcm().isBlank());
        if (semNcm) {
            return new RetornoSefaz(false, "778", "Rejeição: Informado NCM inexistente (produto sem NCM no cadastro)", null);
        }
        log.info("[SEFAZ SIMULADA] Autorizando NF-e {} série {} chave {}", nota.getNumero(), nota.getSerie(),
                nota.getChaveAcesso());
        return new RetornoSefaz(true, "100", "Autorizado o uso da NF-e (simulado)", protocolo());
    }

    @Override
    public RetornoSefaz cancelar(NotaFiscal nota, String justificativa) {
        log.info("[SEFAZ SIMULADA] Cancelando NF-e {} chave {}", nota.getNumero(), nota.getChaveAcesso());
        return new RetornoSefaz(true, "135", "Evento registrado e vinculado a NF-e (simulado)", protocolo());
    }

    private String protocolo() {
        return "9" + String.format("%014d", ThreadLocalRandom.current().nextLong(100_000_000_000_000L));
    }
}
