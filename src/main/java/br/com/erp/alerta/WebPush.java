package br.com.erp.alerta;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.Arrays;
import java.util.Base64;

/**
 * Notificações Web Push só com o Java (sem bibliotecas): criptografia "aes128gcm" (RFC 8291 / RFC 8188)
 * e identificação do servidor por VAPID (RFC 8292). Os navegadores (Chrome, Firefox, Edge, Safari)
 * entregam a mensagem ao aparelho da pessoa.
 */
public final class WebPush {

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();
    private static final ECParameterSpec P256 = parametrosP256();

    private WebPush() {
    }

    /** Par de chaves VAPID: pública (65 bytes, ponto não comprimido) e privada (32 bytes), em base64url. */
    public record ChavesVapid(String publica, String privada) {
    }

    public static ChavesVapid gerarChaves() {
        KeyPair kp = novoPar();
        return new ChavesVapid(B64.encodeToString(ponto((ECPublicKey) kp.getPublic())),
                B64.encodeToString(fixo32(((ECPrivateKey) kp.getPrivate()).getS())));
    }

    /** Cabeçalho Authorization (VAPID) para o serviço de push que hospeda o endpoint. */
    public static String autorizacao(String endpoint, ChavesVapid chaves, String contato, long agoraSegundos) {
        try {
            URI u = URI.create(endpoint);
            String aud = u.getScheme() + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
            String header = B64.encodeToString("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
            String claims = B64.encodeToString(("{\"aud\":\"" + aud + "\",\"exp\":" + (agoraSegundos + 12 * 3600)
                    + ",\"sub\":\"" + contato + "\"}").getBytes(StandardCharsets.UTF_8));
            String dados = header + "." + claims;
            Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
            s.initSign(privada(B64D.decode(chaves.privada())));
            s.update(dados.getBytes(StandardCharsets.US_ASCII));
            String jwt = dados + "." + B64.encodeToString(s.sign());
            return "vapid t=" + jwt + ", k=" + chaves.publica();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Falha ao assinar VAPID", e);
        }
    }

    /** Corpo criptografado (aes128gcm) para a inscrição do navegador. */
    public static byte[] criptografar(byte[] mensagem, String p256dh, String auth) {
        KeyPair servidor = novoPar();
        byte[] sal = new byte[16];
        new SecureRandom().nextBytes(sal);
        return criptografar(mensagem, B64D.decode(p256dh), B64D.decode(auth), servidor, sal);
    }

    /** Versão determinística (chaves do servidor e sal informados), usada nos testes com o exemplo da RFC 8291. */
    static byte[] criptografar(byte[] mensagem, byte[] uaPublica, byte[] segredoAuth, KeyPair servidor, byte[] sal) {
        try {
            byte[] asPublica = ponto((ECPublicKey) servidor.getPublic());
            KeyAgreement ka = KeyAgreement.getInstance("ECDH");
            ka.init(servidor.getPrivate());
            ka.doPhase(publica(uaPublica), true);
            byte[] ecdh = ka.generateSecret();

            byte[] prkKey = hmac(segredoAuth, ecdh);
            byte[] keyInfo = junta("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublica, asPublica, new byte[]{1});
            byte[] ikm = hmac(prkKey, keyInfo);
            byte[] prk = hmac(sal, ikm);
            byte[] cek = Arrays.copyOf(hmac(prk, junta("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 16);
            byte[] nonce = Arrays.copyOf(hmac(prk, junta("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 12);

            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            byte[] cifrado = c.doFinal(junta(mensagem, new byte[]{2}));

            ByteBuffer cab = ByteBuffer.allocate(16 + 4 + 1 + asPublica.length);
            cab.put(sal).putInt(4096).put((byte) asPublica.length).put(asPublica);
            return junta(cab.array(), cifrado);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Falha ao criptografar a notificação", e);
        }
    }

    // ---------------- utilidades de chave ----------------

    static KeyPair novoPar() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"));
            return g.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static KeyPair par(byte[] privada32, byte[] publica65) throws GeneralSecurityException {
        return new KeyPair(publica(publica65), privada(privada32));
    }

    static PublicKey publica(byte[] ponto65) throws GeneralSecurityException {
        if (ponto65.length != 65 || ponto65[0] != 4) throw new InvalidKeyException("Chave pública inválida");
        ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(ponto65, 1, 33)), new BigInteger(1, Arrays.copyOfRange(ponto65, 33, 65)));
        return KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, P256));
    }

    static PrivateKey privada(byte[] d32) throws GeneralSecurityException {
        return KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d32), P256));
    }

    static byte[] ponto(ECPublicKey k) {
        return junta(new byte[]{4}, fixo32(k.getW().getAffineX()), fixo32(k.getW().getAffineY()));
    }

    private static byte[] fixo32(BigInteger n) {
        byte[] b = n.toByteArray();
        if (b.length == 32) return b;
        byte[] r = new byte[32];
        if (b.length > 32) System.arraycopy(b, b.length - 32, r, 0, 32);
        else System.arraycopy(b, 0, r, 32 - b.length, b.length);
        return r;
    }

    private static ECParameterSpec parametrosP256() {
        try {
            AlgorithmParameters p = AlgorithmParameters.getInstance("EC");
            p.init(new ECGenParameterSpec("secp256r1"));
            return p.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] hmac(byte[] chave, byte[] dados) throws GeneralSecurityException {
        Mac m = Mac.getInstance("HmacSHA256");
        m.init(new SecretKeySpec(chave, "HmacSHA256"));
        return m.doFinal(dados);
    }

    private static byte[] junta(byte[]... partes) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        for (byte[] p : partes) o.writeBytes(p);
        return o.toByteArray();
    }
}
