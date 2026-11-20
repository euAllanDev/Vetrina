package br.com.erp.integracao;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Conta conectada numa loja (tokens OAuth). Uma linha por provedor. */
@Entity
@Table(name = "integracoes")
@Getter
@Setter
public class IntegracaoConta {

    @Id
    @Column(length = 30)
    private String provedor;

    @Column(columnDefinition = "text")
    private String accessToken;

    @Column(columnDefinition = "text")
    private String refreshToken;

    private LocalDateTime expiraEm;

    @Column(length = 40)
    private String usuarioExterno;

    @Column(length = 120)
    private String apelido;

    private LocalDateTime conectadoEm;

    private LocalDateTime ultimaSincronizacao;

    @Column(length = 500)
    private String ultimoResumo;
}
