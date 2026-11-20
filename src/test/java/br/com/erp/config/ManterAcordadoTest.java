package br.com.erp.config;

import org.junit.jupiter.api.Test;

import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ManterAcordadoTest {

    private static ManterAcordado com(String inicio, String fim) {
        return new ManterAcordado("https://exemplo.onrender.com", true, inicio, fim, "America/Sao_Paulo");
    }

    @Test
    void pausaDaMadrugada() {
        ManterAcordado m = com("02:00", "08:00");
        assertFalse(m.emPausa(LocalTime.of(1, 59)));
        assertTrue(m.emPausa(LocalTime.of(2, 0)));
        assertTrue(m.emPausa(LocalTime.of(5, 30)));
        assertTrue(m.emPausa(LocalTime.of(7, 59)));
        assertFalse(m.emPausa(LocalTime.of(8, 0)));
        assertFalse(m.emPausa(LocalTime.of(14, 0)));
    }

    @Test
    void pausaQueViraODia() {
        ManterAcordado m = com("23:00", "06:00");
        assertTrue(m.emPausa(LocalTime.of(23, 30)));
        assertTrue(m.emPausa(LocalTime.of(3, 0)));
        assertFalse(m.emPausa(LocalTime.of(6, 0)));
        assertFalse(m.emPausa(LocalTime.of(12, 0)));
    }

    @Test
    void semPausa() {
        assertFalse(com("", "").emPausa(LocalTime.of(3, 0)));
    }
}
