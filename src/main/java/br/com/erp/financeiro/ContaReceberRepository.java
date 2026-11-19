package br.com.erp.financeiro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface ContaReceberRepository extends JpaRepository<ContaReceber, Long>, JpaSpecificationExecutor<ContaReceber> {

    List<ContaReceber> findByVendaId(Long vendaId);

    @Query("select sum(c.valorRecebido) from ContaReceber c "
            + "where c.status = :status and c.dataRecebimento between :inicio and :fim")
    BigDecimal somaRecebida(@Param("status") StatusTitulo status, @Param("inicio") LocalDate inicio,
                            @Param("fim") LocalDate fim);

    @Query("select sum(c.valor) from ContaReceber c "
            + "where c.status = :status and c.vencimento between :inicio and :fim")
    BigDecimal somaPorVencimento(@Param("status") StatusTitulo status, @Param("inicio") LocalDate inicio,
                                 @Param("fim") LocalDate fim);

    @Query("select sum(c.valor) from ContaReceber c where c.status = :status and c.vencimento < :data")
    BigDecimal somaVencidaAntesDe(@Param("status") StatusTitulo status, @Param("data") LocalDate data);

    @Query("select sum(c.valor) from ContaReceber c where c.status = :status and c.cliente.id = :clienteId")
    BigDecimal somaEmAbertoDoCliente(@Param("status") StatusTitulo status, @Param("clienteId") Long clienteId);
}
