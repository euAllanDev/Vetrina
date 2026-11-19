package br.com.erp.financeiro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface ContaPagarRepository extends JpaRepository<ContaPagar, Long>, JpaSpecificationExecutor<ContaPagar> {

    List<ContaPagar> findByCompraId(Long compraId);

    @Query("select sum(c.valorPago) from ContaPagar c "
            + "where c.status = :status and c.dataPagamento between :inicio and :fim")
    BigDecimal somaPaga(@Param("status") StatusTitulo status, @Param("inicio") LocalDate inicio,
                        @Param("fim") LocalDate fim);

    @Query("select sum(c.valor) from ContaPagar c "
            + "where c.status = :status and c.vencimento between :inicio and :fim")
    BigDecimal somaPorVencimento(@Param("status") StatusTitulo status, @Param("inicio") LocalDate inicio,
                                 @Param("fim") LocalDate fim);

    @Query("select sum(c.valor) from ContaPagar c where c.status = :status and c.vencimento < :data")
    BigDecimal somaVencidaAntesDe(@Param("status") StatusTitulo status, @Param("data") LocalDate data);
}
