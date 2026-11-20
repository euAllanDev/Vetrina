package br.com.erp.alerta;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Valores do sistema guardados no banco (ex.: chaves das notificações), para não depender de variáveis no servidor. */
@Entity
@Table(name = "configuracoes")
@Getter
@Setter
@NoArgsConstructor
public class Configuracao {

    @Id
    @Column(length = 60)
    private String chave;

    @Column(nullable = false, length = 500)
    private String valor;

    public Configuracao(String chave, String valor) {
        this.chave = chave;
        this.valor = valor;
    }
}
