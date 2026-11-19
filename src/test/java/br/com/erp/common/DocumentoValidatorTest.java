package br.com.erp.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoValidatorTest {

    @Test
    void cpfValidoComESemMascara() {
        assertThat(DocumentoValidator.cpfValido("529.982.247-25")).isTrue();
        assertThat(DocumentoValidator.cpfValido("52998224725")).isTrue();
    }

    @Test
    void cpfInvalido() {
        assertThat(DocumentoValidator.cpfValido("52998224724")).isFalse();
        assertThat(DocumentoValidator.cpfValido("11111111111")).isFalse();
        assertThat(DocumentoValidator.cpfValido("123")).isFalse();
        assertThat(DocumentoValidator.cpfValido(null)).isFalse();
    }

    @Test
    void cnpjNumerico() {
        assertThat(DocumentoValidator.cnpjValido("11.222.333/0001-81")).isTrue();
        assertThat(DocumentoValidator.cnpjValido("11444777000161")).isTrue();
        assertThat(DocumentoValidator.cnpjValido("11444777000162")).isFalse();
        assertThat(DocumentoValidator.cnpjValido("00000000000000")).isFalse();
    }

    @Test
    void cnpjAlfanumerico() {
        // Exemplo publicado pela Receita Federal para o CNPJ alfanumérico.
        assertThat(DocumentoValidator.cnpjValido("12.ABC.345/01DE-35")).isTrue();
        assertThat(DocumentoValidator.cnpjValido("12ABC34501DE36")).isFalse();
    }
}
