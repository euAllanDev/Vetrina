package br.com.erp.estoque;

import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.SecurityUtils;
import br.com.erp.common.Valores;
import br.com.erp.estoque.EstoqueDtos.*;
import br.com.erp.produto.Produto;
import br.com.erp.produto.ProdutoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class EstoqueService {

    private final ProdutoRepository produtoRepository;
    private final MovimentacaoEstoqueRepository movimentacaoRepository;

    @Value("${app.estoque.permitir-negativo:false}")
    private boolean permitirNegativo;

    /**
     * Entrada de mercadoria. Quando o custo é informado, recalcula o custo médio ponderado do produto.
     */
    @Transactional
    public MovimentacaoEstoque entrada(Produto produto, BigDecimal quantidade, BigDecimal custoUnitario,
                                       OrigemMovimentacao origem, Long referenciaId, String observacao) {
        validarQuantidade(quantidade);
        BigDecimal saldoAnterior = produto.getEstoqueAtual();
        BigDecimal saldoNovo = saldoAnterior.add(quantidade);

        if (Valores.positivo(custoUnitario)) {
            BigDecimal saldoBase = saldoAnterior.max(BigDecimal.ZERO);
            BigDecimal totalAnterior = saldoBase.multiply(produto.getPrecoCusto());
            BigDecimal totalEntrada = quantidade.multiply(custoUnitario);
            BigDecimal custoMedio = totalAnterior.add(totalEntrada)
                    .divide(saldoBase.add(quantidade), 4, RoundingMode.HALF_EVEN);
            produto.setPrecoCusto(custoMedio);
        }
        produto.setEstoqueAtual(saldoNovo);
        return registrar(produto, TipoMovimentacao.ENTRADA, origem, referenciaId, quantidade, saldoAnterior,
                saldoNovo, custoUnitario, observacao);
    }

    @Transactional
    public MovimentacaoEstoque saida(Produto produto, BigDecimal quantidade, OrigemMovimentacao origem,
                                     Long referenciaId, String observacao) {
        validarQuantidade(quantidade);
        BigDecimal saldoAnterior = produto.getEstoqueAtual();
        BigDecimal saldoNovo = saldoAnterior.subtract(quantidade);
        if (saldoNovo.signum() < 0 && !permitirNegativo) {
            throw new NegocioException("Estoque insuficiente para " + produto.getCodigo() + " - "
                    + produto.getDescricao() + ": disponível " + saldoAnterior.stripTrailingZeros().toPlainString()
                    + ", solicitado " + quantidade.stripTrailingZeros().toPlainString());
        }
        produto.setEstoqueAtual(saldoNovo);
        return registrar(produto, TipoMovimentacao.SAIDA, origem, referenciaId, quantidade, saldoAnterior,
                saldoNovo, produto.getPrecoCusto(), observacao);
    }

    @Transactional
    public MovimentacaoResponse inventario(InventarioRequest req) {
        Produto produto = produto(req.produtoId());
        BigDecimal diferenca = req.quantidadeContada().subtract(produto.getEstoqueAtual());
        if (diferenca.signum() == 0) {
            throw new NegocioException("A quantidade contada é igual ao saldo atual; nenhum ajuste necessário");
        }
        MovimentacaoEstoque mov = diferenca.signum() > 0
                ? entrada(produto, diferenca, null, OrigemMovimentacao.AJUSTE_INVENTARIO, null, req.observacao())
                : saida(produto, diferenca.negate(), OrigemMovimentacao.AJUSTE_INVENTARIO, null, req.observacao());
        return MovimentacaoResponse.from(mov);
    }

    @Transactional
    public MovimentacaoResponse entradaManual(MovimentoManualRequest req) {
        Produto produto = produto(req.produtoId());
        return MovimentacaoResponse.from(entrada(produto, req.quantidade(), req.custoUnitario(),
                OrigemMovimentacao.ENTRADA_MANUAL, null, req.observacao()));
    }

    @Transactional
    public MovimentacaoResponse saidaManual(MovimentoManualRequest req) {
        Produto produto = produto(req.produtoId());
        return MovimentacaoResponse.from(saida(produto, req.quantidade(),
                OrigemMovimentacao.SAIDA_MANUAL, null, req.observacao()));
    }

    @Transactional(readOnly = true)
    public Page<MovimentacaoResponse> movimentacoes(Long produtoId, Pageable pageable) {
        Page<MovimentacaoEstoque> page = produtoId == null
                ? movimentacaoRepository.findAll(pageable)
                : movimentacaoRepository.findByProdutoId(produtoId, pageable);
        return page.map(MovimentacaoResponse::from);
    }

    @Transactional(readOnly = true)
    public ResumoEstoqueResponse resumo() {
        return new ResumoEstoqueResponse(produtoRepository.countAtivos(), produtoRepository.countAbaixoDoMinimo(),
                Valores.moeda(produtoRepository.valorTotalEmEstoque()));
    }

    private MovimentacaoEstoque registrar(Produto produto, TipoMovimentacao tipo, OrigemMovimentacao origem,
                                          Long referenciaId, BigDecimal quantidade, BigDecimal saldoAnterior,
                                          BigDecimal saldoPosterior, BigDecimal custo, String observacao) {
        MovimentacaoEstoque m = new MovimentacaoEstoque();
        m.setProduto(produto);
        m.setTipo(tipo);
        m.setOrigem(origem);
        m.setReferenciaId(referenciaId);
        m.setQuantidade(quantidade);
        m.setSaldoAnterior(saldoAnterior);
        m.setSaldoPosterior(saldoPosterior);
        m.setCustoUnitario(custo);
        m.setObservacao(observacao);
        m.setUsuario(SecurityUtils.usuarioAtual());
        return movimentacaoRepository.save(m);
    }

    private void validarQuantidade(BigDecimal quantidade) {
        if (!Valores.positivo(quantidade)) {
            throw new NegocioException("Quantidade deve ser maior que zero");
        }
    }

    private Produto produto(Long id) {
        return produtoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Produto", id));
    }
}
