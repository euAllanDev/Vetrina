package br.com.erp.produto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;

public interface ProdutoRepository extends JpaRepository<Produto, Long>, JpaSpecificationExecutor<Produto> {

    boolean existsByCodigoIgnoreCase(String codigo);

    boolean existsByCategoriaId(Long categoriaId);

    @Query("select p from Produto p where p.ativo = true and p.estoqueAtual <= p.estoqueMinimo order by p.descricao")
    List<Produto> findAbaixoDoMinimo();

    @Query("select count(p) from Produto p where p.ativo = true and p.estoqueAtual <= p.estoqueMinimo")
    long countAbaixoDoMinimo();

    @Query("select sum(p.estoqueAtual * p.precoCusto) from Produto p where p.ativo = true and p.estoqueAtual > 0")
    BigDecimal valorTotalEmEstoque();

    @Query("select count(p) from Produto p where p.ativo = true")
    long countAtivos();
}
