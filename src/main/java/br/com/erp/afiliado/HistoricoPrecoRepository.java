package br.com.erp.afiliado;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface HistoricoPrecoRepository extends JpaRepository<HistoricoPreco, Long> {

    @Query("select h from HistoricoPreco h join fetch h.oferta o where o.produto.id = :produtoId and h.registradoEm >= :desde order by h.registradoEm")
    List<HistoricoPreco> doProdutoDesde(@Param("produtoId") Long produtoId, @Param("desde") LocalDateTime desde);

    @Modifying
    @Query("delete from HistoricoPreco h where h.oferta.id = :ofertaId")
    void apagarDaOferta(@Param("ofertaId") Long ofertaId);
}
