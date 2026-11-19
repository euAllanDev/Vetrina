package br.com.erp.afiliado;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OfertaRepository extends JpaRepository<Oferta, Long> {

    @Query("select o from Oferta o join fetch o.parceiro where o.produto.id = :produtoId order by o.preco asc")
    List<Oferta> doProduto(@Param("produtoId") Long produtoId);

    /** Ofertas que aparecem na vitrine: ativas, de parceiro ativo. */
    @Query("select o from Oferta o join fetch o.parceiro p where o.ativo = true and p.ativo = true")
    List<Oferta> daVitrine();

    @Modifying
    @Query("update Oferta o set o.cliques = o.cliques + 1 where o.id = :id")
    void somarClique(@Param("id") Long id);

    long countByParceiroId(Long parceiroId);
}
