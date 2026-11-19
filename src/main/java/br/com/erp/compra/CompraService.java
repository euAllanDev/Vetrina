package br.com.erp.compra;

import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.SecurityUtils;
import br.com.erp.common.Valores;
import br.com.erp.compra.CompraDtos.*;
import br.com.erp.estoque.EstoqueService;
import br.com.erp.estoque.OrigemMovimentacao;
import br.com.erp.financeiro.FinanceiroService;
import br.com.erp.fornecedor.FornecedorService;
import br.com.erp.produto.ProdutoService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class CompraService {

    private final PedidoCompraRepository repository;
    private final FornecedorService fornecedorService;
    private final ProdutoService produtoService;
    private final EstoqueService estoqueService;
    private final FinanceiroService financeiroService;

    @Transactional(readOnly = true)
    public Page<PedidoCompraResponse> listar(StatusCompra status, Long fornecedorId, Pageable pageable) {
        Specification<PedidoCompra> spec = (root, query, cb) -> cb.conjunction();
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (fornecedorId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("fornecedor").get("id"), fornecedorId));
        }
        return repository.findAll(spec, pageable).map(PedidoCompraResponse::from);
    }

    @Transactional(readOnly = true)
    public PedidoCompraResponse buscar(Long id) {
        return PedidoCompraResponse.from(obter(id));
    }

    @Transactional
    public PedidoCompraResponse criar(PedidoCompraRequest req) {
        PedidoCompra p = new PedidoCompra();
        p.setUsuario(SecurityUtils.usuarioAtual());
        preencher(p, req);
        return PedidoCompraResponse.from(repository.save(p));
    }

    @Transactional
    public PedidoCompraResponse atualizar(Long id, PedidoCompraRequest req) {
        PedidoCompra p = obter(id);
        exigirAberto(p);
        p.getItens().clear();
        preencher(p, req);
        return PedidoCompraResponse.from(p);
    }

    /**
     * Recebimento da mercadoria: dá entrada no estoque (recalculando custo médio, com o frete rateado)
     * e gera as contas a pagar.
     */
    @Transactional
    public PedidoCompraResponse receber(Long id, ReceberCompraRequest req) {
        PedidoCompra p = obter(id);
        exigirAberto(p);
        String numeroNota = req == null ? null : req.numeroNotaFornecedor();

        BigDecimal totalItens = p.getValorTotal().subtract(p.getValorFrete());
        for (ItemCompra item : p.getItens()) {
            BigDecimal custo = item.getCustoUnitario();
            if (Valores.positivo(p.getValorFrete()) && Valores.positivo(totalItens)) {
                // Rateia o frete proporcionalmente ao valor do item e incorpora ao custo unitário.
                BigDecimal freteItem = p.getValorFrete().multiply(item.getSubtotal())
                        .divide(totalItens, 6, RoundingMode.HALF_EVEN);
                custo = custo.add(freteItem.divide(item.getQuantidade(), 4, RoundingMode.HALF_EVEN));
            }
            estoqueService.entrada(item.getProduto(), item.getQuantidade(), custo, OrigemMovimentacao.COMPRA,
                    p.getId(), numeroNota == null ? "Pedido de compra #" + p.getId() : "NF fornecedor " + numeroNota);
        }

        p.setStatus(StatusCompra.RECEBIDO);
        p.setDataRecebimento(LocalDateTime.now());
        p.setNumeroNotaFornecedor(numeroNota);
        if (Valores.positivo(p.getValorTotal())) {
            financeiroService.gerarPagaveisDaCompra(p.getId(), p.getFornecedor(), p.getValorTotal(),
                    p.getQuantidadeParcelas(), req == null ? null : req.primeiroVencimento(), numeroNota);
        }
        return PedidoCompraResponse.from(p);
    }

    @Transactional
    public PedidoCompraResponse cancelar(Long id) {
        PedidoCompra p = obter(id);
        exigirAberto(p);
        p.setStatus(StatusCompra.CANCELADO);
        return PedidoCompraResponse.from(p);
    }

    private void preencher(PedidoCompra p, PedidoCompraRequest req) {
        p.setFornecedor(fornecedorService.obter(req.fornecedorId()));
        p.setPrevisaoEntrega(req.previsaoEntrega());
        p.setQuantidadeParcelas(req.quantidadeParcelas() == null ? 1 : req.quantidadeParcelas());
        p.setValorFrete(Valores.moeda(req.valorFrete()));
        p.setObservacao(req.observacao());

        BigDecimal total = BigDecimal.ZERO;
        for (ItemCompraRequest ir : req.itens()) {
            ItemCompra item = new ItemCompra();
            item.setProduto(produtoService.obter(ir.produtoId()));
            item.setQuantidade(ir.quantidade());
            item.setCustoUnitario(ir.custoUnitario());
            item.setSubtotal(Valores.moeda(ir.quantidade().multiply(ir.custoUnitario())));
            p.adicionarItem(item);
            total = total.add(item.getSubtotal());
        }
        p.setValorTotal(total.add(p.getValorFrete()));
    }

    private void exigirAberto(PedidoCompra p) {
        if (p.getStatus() != StatusCompra.ABERTO) {
            throw new NegocioException("Pedido de compra #" + p.getId() + " não está aberto (status: " + p.getStatus() + ")");
        }
    }

    private PedidoCompra obter(Long id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Pedido de compra", id));
    }
}
