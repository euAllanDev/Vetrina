package br.com.erp.common;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ParcelamentoTest {

    @Test
    void diferencaDeArredondamentoVaiParaUltimaParcela() {
        List<BigDecimal> parcelas = Parcelamento.dividir(new BigDecimal("100.00"), 3);
        assertThat(parcelas).containsExactly(new BigDecimal("33.33"), new BigDecimal("33.33"), new BigDecimal("33.34"));
        assertThat(parcelas.stream().reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("100.00");
    }

    @Test
    void parcelaUnica() {
        assertThat(Parcelamento.dividir(new BigDecimal("59.90"), 1)).containsExactly(new BigDecimal("59.90"));
    }

    @Test
    void rejeitaQuantidadeInvalida() {
        assertThatThrownBy(() -> Parcelamento.dividir(BigDecimal.TEN, 0)).isInstanceOf(NegocioException.class);
    }
}
