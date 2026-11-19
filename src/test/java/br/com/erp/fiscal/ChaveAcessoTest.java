package br.com.erp.fiscal;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ChaveAcessoTest {

    @Test
    void geraChaveCom44PosicoesEDvValido() {
        String chave = ChaveAcesso.gerar(35, LocalDateTime.of(2026, 11, 18, 10, 0), "11222333000181",
                "55", 1, 123, 1, 12345678);

        assertThat(chave).hasSize(44);
        assertThat(chave).startsWith("352611" + "11222333000181" + "55" + "001" + "000000123" + "1" + "12345678");
        assertThat(ChaveAcesso.valida(chave)).isTrue();
    }

    @Test
    void detectaDvErrado() {
        String chave = ChaveAcesso.gerar(25, LocalDateTime.of(2026, 1, 5, 8, 0), "11444777000161",
                "55", 1, 1, 1, 87654321);
        int dv = chave.charAt(43) - '0';
        String adulterada = chave.substring(0, 43) + ((dv + 1) % 10);
        assertThat(ChaveAcesso.valida(adulterada)).isFalse();
    }

    @Test
    void digitoVerificadorExemploManual() {
        // Soma ponderada de "0000000000000000000000000000000000000000001" = 1*2 = 2 -> resto 2 -> DV 9
        assertThat(ChaveAcesso.digitoVerificador("0".repeat(42) + "1")).isEqualTo(9);
    }
}
