package br.com.erp.venda;

import br.com.erp.relatorio.ProdutoVendido;
import br.com.erp.relatorio.ResumoVendas;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface VendaRepository extends JpaRepository<Venda, Long>, JpaSpecificationExecutor<Venda> {

    @Query("select new br.com.erp.relatorio.ResumoVendas(count(v), sum(v.valorTotal)) "
            + "from Venda v where v.status in :status and v.dataConfirmacao >= :inicio and v.dataConfirmacao < :fim")
    ResumoVendas resumo(@Param("status") Collection<StatusVenda> status,
                        @Param("inicio") LocalDateTime inicio, @Param("fim") LocalDateTime fim);

    @Query("select new br.com.erp.relatorio.ProdutoVendido("
            + "i.produto.id, i.produto.codigo, i.produto.descricao, sum(i.quantidade), sum(i.subtotal), "
            + "sum(i.quantidade * i.custoUnitario)) "
            + "from ItemVenda i where i.venda.status in :status "
            + "and i.venda.dataConfirmacao >= :inicio and i.venda.dataConfirmacao < :fim "
            + "group by i.produto.id, i.produto.codigo, i.produto.descricao "
            + "order by sum(i.quantidade) desc")
    List<ProdutoVendido> maisVendidos(@Param("status") Collection<StatusVenda> status,
                                      @Param("inicio") LocalDateTime inicio, @Param("fim") LocalDateTime fim,
                                      Pageable pageable);

    @Query(value = "select cast(v.data_confirmacao as date) as dia, count(*) as quantidade, sum(v.valor_total) as total "
            + "from vendas v where v.status in ('CONFIRMADA', 'FATURADA') "
            + "and v.data_confirmacao >= :inicio and v.data_confirmacao < :fim "
            + "group by cast(v.data_confirmacao as date) order by 1", nativeQuery = true)
    List<Object[]> vendasPorDia(@Param("inicio") LocalDateTime inicio, @Param("fim") LocalDateTime fim);
}
