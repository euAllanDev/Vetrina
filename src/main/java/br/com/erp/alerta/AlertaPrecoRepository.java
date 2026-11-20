package br.com.erp.alerta;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AlertaPrecoRepository extends JpaRepository<AlertaPreco, Long> {

    Optional<AlertaPreco> findByProdutoIdAndEndpoint(Long produtoId, String endpoint);

    @Query("select a from AlertaPreco a join fetch a.produto where a.produto.id = :produtoId and a.ativo = true")
    List<AlertaPreco> ativosDoProduto(@Param("produtoId") Long produtoId);

    long countByEndpointAndAtivoTrue(String endpoint);

    List<AlertaPreco> findByEndpoint(String endpoint);

    long countByAtivoTrue();
}
