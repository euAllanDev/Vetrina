package br.com.erp.venda;

import br.com.erp.cliente.Cliente;
import br.com.erp.cliente.ClienteService;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.SecurityUtils;
import br.com.erp.common.Valores;
import br.com.erp.estoque.EstoqueService;
import br.com.erp.estoque.OrigemMovimentacao;
import br.com.erp.financeiro.FinanceiroService;
import br.com.erp.financeiro.FormaPagamento;
import br.com.erp.produto.Produto;
import br.com.erp.produto.ProdutoService;
import br.com.erp.venda.VendaDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class VendaService {

    private final VendaRepository repository;
    private final ClienteService clienteService;
    private final ProdutoService produtoService;
    private final EstoqueService estoqueService;
    private final FinanceiroService financeiroService;

    @Transactional(readOnly = true)
    public Page<VendaResponse> listar(StatusVenda status, Long clienteId, LocalDate de, LocalDate ate,
                                      Pageable pageable) {
        Specification<Venda> spec = (root, query, cb) -> cb.conjunction();
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (clienteId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("cliente").get("id"), clienteId));
        }
        if (de != null) {
            LocalDateTime inicio = de.atStartOfDay();
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.<LocalDateTime>get("criadoEm"), inicio));
        }
        if (ate != null) {
            LocalDateTime fim = ate.plusDays(1).atStartOfDay();
            spec = spec.and((root, query, cb) -> cb.lessThan(root.<LocalDateTime>get("criadoEm"), fim));
        }
        return repository.findAll(spec, pageable).map(VendaResponse::from);
    }

    @Transactional(readOnly = true)
    public VendaResponse buscar(Long id) {
        return VendaResponse.from(obter(id));
    }

    /** Cria a venda como orçamento (não movimenta estoque). */
    @Transactional
    public VendaResponse criar(VendaRequest req) {
        Venda v = new Venda();
        v.setVendedor(SecurityUtils.usuarioAtual());
        preencher(v, req);
        return VendaResponse.from(repository.save(v));
    }

    public static final String VENDEDOR_LOJA = "Loja online";

    /**
     * Pedido feito pelo cliente na loja: entra como orçamento (não baixa estoque) para a equipe confirmar.
     * Recusa quantidade acima do estoque disponível no momento do pedido.
     */
    @Transactional
    public VendaResponse criarPedidoLoja(VendaRequest req, String contato) {
        Venda v = new Venda();
        v.setVendedor(VENDEDOR_LOJA);
        preencher(v, req);
        for (ItemVenda item : v.getItens()) {
            Produto p = item.getProduto();
            if (!p.isAtivo()) {
                throw new NegocioException(p.getDescricao() + " não está mais disponível");
            }
            if (item.getQuantidade().compareTo(p.getEstoqueAtual()) > 0) {
                throw new NegocioException("Só temos " + p.getEstoqueAtual().stripTrailingZeros().toPlainString()
                        + " unidade(s) de " + p.getDescricao());
            }
        }
        v.setObservacao(contato.length() > 500 ? contato.substring(0, 500) : contato);
        return VendaResponse.from(repository.save(v));
    }

    @Transactional
    public VendaResponse atualizar(Long id, VendaRequest req) {
        Venda v = obter(id);
        if (v.getStatus() != StatusVenda.ORCAMENTO) {
            throw new NegocioException("Somente orçamentos podem ser alterados");
        }
        v.getItens().clear();
        preencher(v, req);
        return VendaResponse.from(v);
    }

    /** Cria e confirma em uma única operação (fluxo de PDV / balcão). */
    @Transactional
    public VendaResponse criarEConfirmar(VendaRequest req) {
        Venda v = new Venda();
        v.setVendedor(SecurityUtils.usuarioAtual());
        preencher(v, req);
        repository.save(v);
        confirmar(v);
        return VendaResponse.from(v);
    }

    /** Confirma: baixa o estoque e gera as contas a receber. */
    @Transactional
    public VendaResponse confirmar(Long id) {
        Venda v = obter(id);
        confirmar(v);
        return VendaResponse.from(v);
    }

    private void confirmar(Venda v) {
        if (v.getStatus() != StatusVenda.ORCAMENTO) {
            throw new NegocioException("Venda #" + v.getId() + " não está em orçamento (status: " + v.getStatus() + ")");
        }
        validarCredito(v);
        for (ItemVenda item : v.getItens()) {
            Produto produto = item.getProduto();
            if (!produto.isAtivo()) {
                throw new NegocioException("Produto inativo: " + produto.getCodigo());
            }
            item.setCustoUnitario(produto.getPrecoCusto());
            estoqueService.saida(produto, item.getQuantidade(), OrigemMovimentacao.VENDA, v.getId(),
                    "Venda #" + v.getId());
        }
        v.setStatus(StatusVenda.CONFIRMADA);
        v.setDataConfirmacao(LocalDateTime.now());
        if (Valores.positivo(v.getValorTotal())) {
            financeiroService.gerarRecebiveisDaVenda(v.getId(), v.getCliente(), v.getValorTotal(),
                    v.getFormaPagamento(), v.getQuantidadeParcelas());
        }
    }

    /**
     * Cancela a venda. Se já confirmada, devolve os itens ao estoque e estorna os títulos.
     * Vendas faturadas exigem cancelar a NF-e antes.
     */
    @Transactional
    public VendaResponse cancelar(Long id, CancelamentoRequest req) {
        Venda v = obter(id);
        switch (v.getStatus()) {
            case CANCELADA -> throw new NegocioException("Venda já está cancelada");
            case FATURADA -> throw new NegocioException("Venda faturada: cancele a NF-e antes de cancelar a venda");
            case CONFIRMADA -> {
                for (ItemVenda item : v.getItens()) {
                    estoqueService.entrada(item.getProduto(), item.getQuantidade(), null,
                            OrigemMovimentacao.CANCELAMENTO_VENDA, v.getId(), "Cancelamento da venda #" + v.getId());
                }
                financeiroService.cancelarRecebiveisDaVenda(v.getId(), req.motivo());
            }
            case ORCAMENTO -> {
                // nada a estornar
            }
        }
        v.setStatus(StatusVenda.CANCELADA);
        v.setDataCancelamento(LocalDateTime.now());
        v.setMotivoCancelamento(req.motivo());
        return VendaResponse.from(v);
    }

    public Venda obter(Long id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Venda", id));
    }

    private void preencher(Venda v, VendaRequest req) {
        Cliente cliente = req.clienteId() == null ? null : clienteService.obter(req.clienteId());
        if (cliente != null && !cliente.isAtivo()) {
            throw new NegocioException("Cliente inativo: " + cliente.getNome());
        }
        int parcelas = req.quantidadeParcelas() == null ? 1 : req.quantidadeParcelas();
        if (req.formaPagamento().isAVista() && parcelas > 1) {
            throw new NegocioException(req.formaPagamento() + " não permite parcelamento");
        }
        if (!req.formaPagamento().isAVista() && req.formaPagamento() != FormaPagamento.CARTAO_CREDITO
                && cliente == null) {
            throw new NegocioException("Venda a prazo (" + req.formaPagamento() + ") exige cliente identificado");
        }
        v.setCliente(cliente);
        v.setFormaPagamento(req.formaPagamento());
        v.setQuantidadeParcelas(parcelas);
        v.setValorDesconto(Valores.moeda(req.valorDesconto()));
        v.setValorFrete(Valores.moeda(req.valorFrete()));
        v.setObservacao(req.observacao());

        BigDecimal subtotal = BigDecimal.ZERO;
        for (ItemVendaRequest ir : req.itens()) {
            Produto produto = produtoService.obter(ir.produtoId());
            ItemVenda item = new ItemVenda();
            item.setProduto(produto);
            item.setQuantidade(ir.quantidade());
            item.setPrecoUnitario(ir.precoUnitario() != null ? Valores.moeda(ir.precoUnitario()) : produto.getPrecoVenda());
            item.setValorDesconto(Valores.moeda(ir.valorDesconto()));
            BigDecimal bruto = Valores.moeda(item.valorBruto());
            if (item.getValorDesconto().compareTo(bruto) > 0) {
                throw new NegocioException("Desconto do item " + produto.getCodigo() + " maior que o valor do item");
            }
            item.setSubtotal(bruto.subtract(item.getValorDesconto()));
            item.setCustoUnitario(produto.getPrecoCusto());
            v.adicionarItem(item);
            subtotal = subtotal.add(item.getSubtotal());
        }
        if (v.getValorDesconto().compareTo(subtotal) > 0) {
            throw new NegocioException("Desconto maior que o subtotal da venda");
        }
        v.setSubtotal(subtotal);
        v.setValorTotal(subtotal.subtract(v.getValorDesconto()).add(v.getValorFrete()));
    }

    private void validarCredito(Venda v) {
        Cliente c = v.getCliente();
        if (c == null || v.getFormaPagamento().isAVista() || c.getLimiteCredito().signum() == 0) {
            return;
        }
        BigDecimal emAberto = financeiroService.emAbertoDoCliente(c.getId());
        if (emAberto.add(v.getValorTotal()).compareTo(c.getLimiteCredito()) > 0) {
            throw new NegocioException("Limite de crédito excedido para " + c.getNome() + ": limite "
                    + c.getLimiteCredito() + ", em aberto " + emAberto + ", venda " + v.getValorTotal());
        }
    }
}
