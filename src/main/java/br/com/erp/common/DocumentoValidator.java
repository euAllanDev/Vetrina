package br.com.erp.common;

/**
 * Validação de CPF e CNPJ. Suporta o CNPJ alfanumérico (IN RFB 2.229/2024, vigente a partir de julho/2026):
 * os 12 primeiros caracteres podem ser letras ou números; os 2 dígitos verificadores são sempre numéricos.
 * O valor de cada caractere é (código ASCII - 48), o que mantém o cálculo idêntico para CNPJs só numéricos.
 */
public final class DocumentoValidator {

    private static final int[] PESOS_CNPJ_1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
    private static final int[] PESOS_CNPJ_2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    private DocumentoValidator() {
    }

    /** Remove máscara (pontos, barras, traços) e converte para maiúsculas. */
    public static String normalizar(String documento) {
        if (documento == null) {
            return null;
        }
        return documento.replaceAll("[^0-9A-Za-z]", "").toUpperCase();
    }

    public static boolean valido(TipoPessoa tipo, String documento) {
        return tipo == TipoPessoa.FISICA ? cpfValido(documento) : cnpjValido(documento);
    }

    public static boolean cpfValido(String valor) {
        String cpf = normalizar(valor);
        if (cpf == null || !cpf.matches("\\d{11}") || cpf.chars().distinct().count() == 1) {
            return false;
        }
        for (int j = 9; j < 11; j++) {
            int soma = 0;
            for (int i = 0; i < j; i++) {
                soma += (cpf.charAt(i) - '0') * ((j + 1) - i);
            }
            int dv = (soma * 10) % 11;
            if (dv == 10) {
                dv = 0;
            }
            if (dv != cpf.charAt(j) - '0') {
                return false;
            }
        }
        return true;
    }

    public static boolean cnpjValido(String valor) {
        String cnpj = normalizar(valor);
        if (cnpj == null || !cnpj.matches("[0-9A-Z]{12}\\d{2}") || cnpj.chars().distinct().count() == 1) {
            return false;
        }
        int dv1 = calcularDvCnpj(cnpj, PESOS_CNPJ_1);
        int dv2 = calcularDvCnpj(cnpj, PESOS_CNPJ_2);
        return dv1 == cnpj.charAt(12) - '0' && dv2 == cnpj.charAt(13) - '0';
    }

    private static int calcularDvCnpj(String cnpj, int[] pesos) {
        int soma = 0;
        for (int i = 0; i < pesos.length; i++) {
            soma += (cnpj.charAt(i) - '0') * pesos[i];
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
