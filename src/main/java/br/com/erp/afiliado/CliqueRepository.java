package br.com.erp.afiliado;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CliqueRepository extends JpaRepository<Clique, Long> {

    @Query("select c.parceiroId, count(c) from Clique c where c.criadoEm >= :desde group by c.parceiroId")
    List<Object[]> porParceiro(@Param("desde") LocalDateTime desde);

    @Query("select c.produtoId, count(c) from Clique c where c.criadoEm >= :desde group by c.produtoId order by count(c) desc")
    List<Object[]> porProduto(@Param("desde") LocalDateTime desde);

    @Query(value = "select cast(criado_em as date) as dia, count(*) from cliques where criado_em >= :desde group by dia order by dia", nativeQuery = true)
    List<Object[]> porDia(@Param("desde") LocalDateTime desde);

    long countByCriadoEmGreaterThanEqual(LocalDateTime desde);
}
