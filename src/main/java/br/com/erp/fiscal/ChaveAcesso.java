package br.com.erp.fiscal;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Chave de acesso da NF-e (44 posições):
 * cUF(2) + AAMM(4) + CNPJ(14) + modelo(2) + série(3) + número(9) + tpEmis(1) + cNF(8) + DV(1).
 * O DV é calculado por módulo 11 (pesos 2 a 9 da direita para a esquerda). Caracteres alfanuméricos
 * do CNPJ entram com valor (ASCII - 48), conforme a regra do CNPJ alfanumérico.
 */
public final class ChaveAcesso {

    private static final DateTimeFormatter AAMM = DateTimeFormatter.ofPattern("yyMM");

    private ChaveAcesso() {
    }

    public static String gerar(int codigoUf, LocalDateTime emissao, String cnpj, String modelo, int serie,
                               int numero, int tipoEmissao, int codigoNumerico) {
        if (cnpj == null || cnpj.length() != 14) {
            throw new IllegalArgumentException("CNPJ do emitente deve ter 14 posições");
        }
        String base = String.format("%02d%s%s%s%03d%09d%d%08d",
                codigoUf, emissao.format(AAMM), cnpj, modelo, serie, numero, tipoEmissao, codigoNumerico);
        return base + digitoVerificador(base);
    }

    public static int digitoVerificador(String chave43) {
        int soma = 0;
        int peso = 2;
        for (int i = chave43.length() - 1; i >= 0; i--) {
            soma += (chave43.charAt(i) - '0') * peso;
            peso = peso == 9 ? 2 : peso + 1;
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }

    public static boolean valida(String chave) {
        return chave != null && chave.length() == 44
                && digitoVerificador(chave.substring(0, 43)) == chave.charAt(43) - '0';
    }
}
