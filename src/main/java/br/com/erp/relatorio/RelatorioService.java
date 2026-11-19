package br.com.erp.relatorio;

import br.com.erp.common.NegocioException;
import br.com.erp.common.Valores;
import br.com.erp.financeiro.ContaPagarRepository;
import br.com.erp.financeiro.ContaReceberRepository;
import br.com.erp.financeiro.StatusTitulo;
import br.com.erp.produto.ProdutoRepository;
import br.com.erp.relatorio.RelatorioDtos.*;
import br.com.erp.venda.StatusVenda;
import br.com.erp.venda.VendaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RelatorioService {

    private static final List<StatusVenda> REALIZADAS = List.of(StatusVenda.CONFIRMADA, StatusVenda.FATURADA);

    private final VendaRepository vendaRepository;
    private final ProdutoRepository produtoRepository;
    private final ContaReceberRepository receberRepository;
    private final ContaPagarRepository pagarRepository;

    public DashboardResponse dashboard() {
        LocalDate hoje = LocalDate.now();
        LocalDate inicioMes = hoje.withDayOfMonth(1);
        LocalDateTime amanha = hoje.plusDays(1).atStartOfDay();

        ResumoVendas vendasHoje = vendaRepository.resumo(REALIZADAS, hoje.atStartOfDay(), amanha);
        ResumoVendas vendasMes = vendaRepository.resumo(REALIZADAS, inicioMes.atStartOfDay(), amanha);
        List<ProdutoVendido> top = vendaRepository.maisVendidos(REALIZADAS, inicioMes.atStartOfDay(), amanha,
                PageRequest.of(0, 5));

        return new DashboardResponse(
                Periodo.de(vendasHoje),
                Periodo.de(vendasMes),
                produtoRepository.countAbaixoDoMinimo(),
                Valores.moeda(produtoRepository.valorTotalEmEstoque()),
                Valores.moeda(receberRepository.somaVencidaAntesDe(StatusTitulo.ABERTO, hoje)),
                Valores.moeda(receberRepository.somaPorVencimento(StatusTitulo.ABERTO, hoje, hoje.plusDays(7))),
                Valores.moeda(pagarRepository.somaVencidaAntesDe(StatusTitulo.ABERTO, hoje)),
                Valores.moeda(pagarRepository.somaPorVencimento(StatusTitulo.ABERTO, hoje, hoje.plusDays(7))),
                top);
    }

    public RelatorioVendasResponse vendas(LocalDate inicio, LocalDate fim) {
        validarPeriodo(inicio, fim);
        LocalDateTime de = inicio.atStartOfDay();
        LocalDateTime ate = fim.plusDays(1).atStartOfDay();
        ResumoVendas totais = vendaRepository.resumo(REALIZADAS, de, ate);
        List<VendaDia> dias = vendaRepository.vendasPorDia(de, ate).stream()
                .map(r -> new VendaDia(LocalDate.parse(r[0].toString().substring(0, 10)),
                        ((Number) r[1]).longValue(),
                        Valores.moeda(new BigDecimal(r[2].toString()))))
                .toList();
        return new RelatorioVendasResponse(inicio, fim, Periodo.de(totais), dias);
    }

    public List<ProdutoVendido> maisVendidos(LocalDate inicio, LocalDate fim, int limite) {
        validarPeriodo(inicio, fim);
        return vendaRepository.maisVendidos(REALIZADAS, inicio.atStartOfDay(), fim.plusDays(1).atStartOfDay(),
                PageRequest.of(0, Math.min(Math.max(limite, 1), 500)));
    }

    /** Curva ABC por faturamento: A até 80%, B até 95%, C o restante. */
    public List<CurvaAbcItem> curvaAbc(LocalDate inicio, LocalDate fim) {
        validarPeriodo(inicio, fim);
        List<ProdutoVendido> produtos = new ArrayList<>(vendaRepository.maisVendidos(REALIZADAS,
                inicio.atStartOfDay(), fim.plusDays(1).atStartOfDay(), Pageable.unpaged()));
        produtos.sort((a, b) -> b.faturamento().compareTo(a.faturamento()));
        BigDecimal total = produtos.stream().map(ProdutoVendido::faturamento).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<CurvaAbcItem> curva = new ArrayList<>();
        BigDecimal acumulado = BigDecimal.ZERO;
        for (ProdutoVendido p : produtos) {
            BigDecimal pct = total.signum() == 0 ? BigDecimal.ZERO
                    : p.faturamento().multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_EVEN);
            // Classifica pelo acumulado ANTES do item: quem "entra" na faixa dos 80% é A, mesmo que a ultrapasse.
            BigDecimal anterior = acumulado;
            acumulado = acumulado.add(pct);
            String classe = anterior.compareTo(BigDecimal.valueOf(80)) < 0 ? "A"
                    : anterior.compareTo(BigDecimal.valueOf(95)) < 0 ? "B" : "C";
            curva.add(new CurvaAbcItem(p.produtoId(), p.codigo(), p.descricao(), p.quantidade(), p.faturamento(),
                    p.lucroBruto(), pct, acumulado, classe));
        }
        return curva;
    }

    private void validarPeriodo(LocalDate inicio, LocalDate fim) {
        if (fim.isBefore(inicio)) {
            throw new NegocioException("Data final anterior à inicial");
        }
    }
}
