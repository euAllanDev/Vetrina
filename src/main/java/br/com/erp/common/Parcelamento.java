package br.com.erp.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

public final class Parcelamento {

    private Parcelamento() {
    }

    /** Divide um valor em N parcelas; a diferença de arredondamento vai para a última. */
    public static List<BigDecimal> dividir(BigDecimal total, int quantidade) {
        if (quantidade < 1) {
            throw new NegocioException("Quantidade de parcelas deve ser maior que zero");
        }
        BigDecimal base = total.divide(BigDecimal.valueOf(quantidade), 2, RoundingMode.DOWN);
        List<BigDecimal> parcelas = new ArrayList<>();
        BigDecimal acumulado = BigDecimal.ZERO;
        for (int i = 1; i < quantidade; i++) {
            parcelas.add(base);
            acumulado = acumulado.add(base);
        }
        parcelas.add(total.subtract(acumulado).setScale(2, RoundingMode.HALF_EVEN));
        return parcelas;
    }
}
