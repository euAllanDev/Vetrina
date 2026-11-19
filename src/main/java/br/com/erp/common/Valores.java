package br.com.erp.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class Valores {

    private Valores() {
    }

    public static BigDecimal nz(BigDecimal valor) {
        return valor == null ? BigDecimal.ZERO : valor;
    }

    public static BigDecimal moeda(BigDecimal valor) {
        return nz(valor).setScale(2, RoundingMode.HALF_EVEN);
    }

    /** valor * percentual / 100, arredondado em centavos. */
    public static BigDecimal percentual(BigDecimal valor, BigDecimal percentual) {
        return moeda(nz(valor).multiply(nz(percentual)).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_EVEN));
    }

    public static boolean positivo(BigDecimal valor) {
        return valor != null && valor.signum() > 0;
    }
}
