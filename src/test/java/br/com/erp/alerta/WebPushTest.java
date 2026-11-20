package br.com.erp.alerta;

import br.com.erp.common.NegocioException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class WebPushTest {

    private static final Base64.Decoder D = Base64.getUrlDecoder();

    /** Exemplo do Apêndice A da RFC 8291: mesma entrada tem que dar exatamente a mesma saída. */
    @Test
    void criptografiaIgualAoExemploDaRfc8291() throws Exception {
        KeyPair servidor = WebPush.par(D.decode("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
                D.decode("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"));
        byte[] corpo = WebPush.criptografar("When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8),
                D.decode("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"),
                D.decode("BTBZMqHH6r4Tts7J_aSIgg"), servidor, D.decode("DGv6ra1nlYgDCS1FRnbzlw"));
        assertEquals("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
                Base64.getUrlEncoder().withoutPadding().encodeToString(corpo));
    }

    @Test
    void vapidAssinadoComAChaveGerada() throws Exception {
        WebPush.ChavesVapid ch = WebPush.gerarChaves();
        assertEquals(65, D.decode(ch.publica()).length);
        assertEquals(32, D.decode(ch.privada()).length);
        String h = WebPush.autorizacao("https://fcm.googleapis.com/fcm/send/abc", ch, "mailto:x@y.com", 1_000L);
        assertTrue(h.startsWith("vapid t=") && h.endsWith(", k=" + ch.publica()));
        String[] jwt = h.substring(8, h.indexOf(',')).split("\\.");
        assertTrue(new String(D.decode(jwt[1]), StandardCharsets.UTF_8).contains("\"aud\":\"https://fcm.googleapis.com\""));
        Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
        s.initVerify(WebPush.publica(D.decode(ch.publica())));
        s.update((jwt[0] + "." + jwt[1]).getBytes(StandardCharsets.US_ASCII));
        assertTrue(s.verify(D.decode(jwt[2])));
    }

    @Test
    void soAceitaServicosDePushDosNavegadores() {
        assertDoesNotThrow(() -> AlertaService.validarEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
        assertDoesNotThrow(() -> AlertaService.validarEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"));
        assertDoesNotThrow(() -> AlertaService.validarEndpoint("https://web.push.apple.com/QK1"));
        assertDoesNotThrow(() -> AlertaService.validarEndpoint("https://wns2-by3p.notify.windows.com/w/?token=x"));
        assertThrows(NegocioException.class, () -> AlertaService.validarEndpoint("https://exemplo.com/fcm.googleapis.com"));
        assertThrows(NegocioException.class, () -> AlertaService.validarEndpoint("http://fcm.googleapis.com/x"));
        assertThrows(NegocioException.class, () -> AlertaService.validarEndpoint("https://evilfcm.googleapis.com.evil.com/x"));
    }
}
