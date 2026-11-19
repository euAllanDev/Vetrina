package br.com.erp.financeiro;

import br.com.erp.cliente.Cliente;
import br.com.erp.cliente.ClienteService;
import br.com.erp.common.NegocioException;
import br.com.erp.common.Parcelamento;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.Valores;
import br.com.erp.financeiro.FinanceiroDtos.*;
import br.com.erp.fornecedor.Fornecedor;
import br.com.erp.fornecedor.FornecedorService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FinanceiroService {

    private final ContaReceberRepository receberRepository;
    private final ContaPagarRepository pagarRepository;
    private final ClienteService clienteService;
    private final FornecedorService fornecedorService;

    // ======================= Integração com vendas/compras =======================

    /**
     * Gera os títulos a receber de uma venda. À vista: um título já quitado.
     * A prazo: N parcelas mensais, a primeira em 30 dias.
     */
    @Transactional
    public List<ContaReceber> gerarRecebiveisDaVenda(Long vendaId, Cliente cliente, BigDecimal total,
                                                     FormaPagamento forma, int parcelas) {
        LocalDate hoje = LocalDate.now();
        if (forma.isAVista()) {
            ContaReceber c = novoReceber(cliente, vendaId, "Venda #" + vendaId, 1, 1, total, hoje, forma);
            c.setStatus(StatusTitulo.PAGO);
            c.setValorRecebido(total);
            c.setDataRecebimento(hoje);
            return List.of(receberRepository.save(c));
        }
        List<BigDecimal> valores = Parcelamento.dividir(total, parcelas);
        return java.util.stream.IntStream.range(0, valores.size())
                .mapToObj(i -> receberRepository.save(novoReceber(cliente, vendaId,
                        "Venda #" + vendaId + " - parcela " + (i + 1) + "/" + valores.size(),
                        i + 1, valores.size(), valores.get(i), hoje.plusMonths(i + 1L), forma)))
                .toList();
    }

    /** Cancela (estorna) todos os títulos de uma venda. */
    @Transactional
    public void cancelarRecebiveisDaVenda(Long vendaId, String motivo) {
        for (ContaReceber c : receberRepository.findByVendaId(vendaId)) {
            if (c.getStatus() != StatusTitulo.CANCELADO) {
                String obs = c.getStatus() == StatusTitulo.PAGO
                        ? "Estornado (valor devolvido) - cancelamento da venda: " + motivo
                        : "Cancelado - cancelamento da venda: " + motivo;
                c.setStatus(StatusTitulo.CANCELADO);
                c.setObservacao(limitar(obs));
            }
        }
    }

    @Transactional
    public void gerarPagaveisDaCompra(Long compraId, Fornecedor fornecedor, BigDecimal total, int parcelas,
                                      LocalDate primeiroVencimento, String numeroNota) {
        List<BigDecimal> valores = Parcelamento.dividir(total, parcelas);
        LocalDate vencimento = primeiroVencimento == null ? LocalDate.now().plusDays(30) : primeiroVencimento;
        String doc = numeroNota == null || numeroNota.isBlank() ? "Compra #" + compraId : "NF " + numeroNota;
        for (int i = 0; i < valores.size(); i++) {
            ContaPagar c = new ContaPagar();
            c.setFornecedor(fornecedor);
            c.setCompraId(compraId);
            c.setDescricao(doc + " - parcela " + (i + 1) + "/" + valores.size());
            c.setCategoria("Mercadorias");
            c.setNumeroParcela(i + 1);
            c.setTotalParcelas(valores.size());
            c.setValor(valores.get(i));
            c.setVencimento(vencimento.plusMonths(i));
            c.setFormaPagamento(FormaPagamento.BOLETO);
            pagarRepository.save(c);
        }
    }

    /** Total em aberto do cliente (para checar limite de crédito). */
    @Transactional(readOnly = true)
    public BigDecimal emAbertoDoCliente(Long clienteId) {
        return Valores.nz(receberRepository.somaEmAbertoDoCliente(StatusTitulo.ABERTO, clienteId));
    }

    // ======================= Contas a receber =======================

    @Transactional(readOnly = true)
    public Page<ContaReceberResponse> listarReceber(StatusTitulo status, Long clienteId, LocalDate inicio,
                                                    LocalDate fim, boolean somenteVencidas, Pageable pageable) {
        Specification<ContaReceber> spec = filtros(status, inicio, fim, somenteVencidas);
        if (clienteId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("cliente").get("id"), clienteId));
        }
        return receberRepository.findAll(spec, pageable).map(ContaReceberResponse::from);
    }

    @Transactional
    public ContaReceberResponse criarReceber(ContaReceberRequest req) {
        Cliente cliente = req.clienteId() == null ? null : clienteService.obter(req.clienteId());
        ContaReceber c = novoReceber(cliente, null, req.descricao(), 1, 1, req.valor(), req.vencimento(),
                req.formaPagamento());
        c.setObservacao(req.observacao());
        return ContaReceberResponse.from(receberRepository.save(c));
    }

    @Transactional
    public ContaReceberResponse baixarReceber(Long id, BaixaRequest req) {
        ContaReceber c = receberRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Conta a receber", id));
        exigirAberto(c.getStatus());
        c.setValorRecebido(req != null && req.valor() != null ? req.valor() : c.getValor());
        c.setDataRecebimento(req != null && req.data() != null ? req.data() : LocalDate.now());
        if (req != null && req.formaPagamento() != null) {
            c.setFormaPagamento(req.formaPagamento());
        }
        c.setStatus(StatusTitulo.PAGO);
        return ContaReceberResponse.from(c);
    }

    @Transactional
    public ContaReceberResponse cancelarReceber(Long id) {
        ContaReceber c = receberRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Conta a receber", id));
        exigirAberto(c.getStatus());
        if (c.getVendaId() != null) {
            throw new NegocioException("Título gerado por venda: cancele a venda #" + c.getVendaId());
        }
        c.setStatus(StatusTitulo.CANCELADO);
        return ContaReceberResponse.from(c);
    }

    // ======================= Contas a pagar =======================

    @Transactional(readOnly = true)
    public Page<ContaPagarResponse> listarPagar(StatusTitulo status, Long fornecedorId, LocalDate inicio,
                                                LocalDate fim, boolean somenteVencidas, Pageable pageable) {
        Specification<ContaPagar> spec = filtros(status, inicio, fim, somenteVencidas);
        if (fornecedorId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("fornecedor").get("id"), fornecedorId));
        }
        return pagarRepository.findAll(spec, pageable).map(ContaPagarResponse::from);
    }

    @Transactional
    public ContaPagarResponse criarPagar(ContaPagarRequest req) {
        Fornecedor fornecedor = req.fornecedorId() == null ? null : fornecedorService.obter(req.fornecedorId());
        ContaPagar c = new ContaPagar();
        c.setFornecedor(fornecedor);
        c.setDescricao(req.descricao());
        c.setCategoria(req.categoria());
        c.setValor(req.valor());
        c.setVencimento(req.vencimento());
        c.setFormaPagamento(req.formaPagamento());
        c.setObservacao(req.observacao());
        return ContaPagarResponse.from(pagarRepository.save(c));
    }

    @Transactional
    public ContaPagarResponse baixarPagar(Long id, BaixaRequest req) {
        ContaPagar c = pagarRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Conta a pagar", id));
        exigirAberto(c.getStatus());
        c.setValorPago(req != null && req.valor() != null ? req.valor() : c.getValor());
        c.setDataPagamento(req != null && req.data() != null ? req.data() : LocalDate.now());
        if (req != null && req.formaPagamento() != null) {
            c.setFormaPagamento(req.formaPagamento());
        }
        c.setStatus(StatusTitulo.PAGO);
        return ContaPagarResponse.from(c);
    }

    @Transactional
    public ContaPagarResponse cancelarPagar(Long id) {
        ContaPagar c = pagarRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Conta a pagar", id));
        exigirAberto(c.getStatus());
        c.setStatus(StatusTitulo.CANCELADO);
        return ContaPagarResponse.from(c);
    }

    // ======================= Fluxo de caixa =======================

    @Transactional(readOnly = true)
    public FluxoCaixaResponse fluxoCaixa(LocalDate inicio, LocalDate fim) {
        if (fim.isBefore(inicio)) {
            throw new NegocioException("Data final anterior à inicial");
        }
        BigDecimal recebido = Valores.moeda(receberRepository.somaRecebida(StatusTitulo.PAGO, inicio, fim));
        BigDecimal pago = Valores.moeda(pagarRepository.somaPaga(StatusTitulo.PAGO, inicio, fim));
        BigDecimal aReceber = Valores.moeda(receberRepository.somaPorVencimento(StatusTitulo.ABERTO, inicio, fim));
        BigDecimal aPagar = Valores.moeda(pagarRepository.somaPorVencimento(StatusTitulo.ABERTO, inicio, fim));
        BigDecimal saldoRealizado = recebido.subtract(pago);
        return new FluxoCaixaResponse(inicio, fim, recebido, pago, saldoRealizado, aReceber, aPagar,
                saldoRealizado.add(aReceber).subtract(aPagar));
    }

    // ======================= Auxiliares =======================

    private <T> Specification<T> filtros(StatusTitulo status, LocalDate inicio, LocalDate fim, boolean somenteVencidas) {
        Specification<T> spec = (root, query, cb) -> cb.conjunction();
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (inicio != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.<LocalDate>get("vencimento"), inicio));
        }
        if (fim != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.<LocalDate>get("vencimento"), fim));
        }
        if (somenteVencidas) {
            LocalDate hoje = LocalDate.now();
            spec = spec.and((root, query, cb) -> cb.and(
                    cb.equal(root.get("status"), StatusTitulo.ABERTO),
                    cb.lessThan(root.<LocalDate>get("vencimento"), hoje)));
        }
        return spec;
    }

    private ContaReceber novoReceber(Cliente cliente, Long vendaId, String descricao, int parcela, int total,
                                     BigDecimal valor, LocalDate vencimento, FormaPagamento forma) {
        ContaReceber c = new ContaReceber();
        c.setCliente(cliente);
        c.setVendaId(vendaId);
        c.setDescricao(descricao);
        c.setNumeroParcela(parcela);
        c.setTotalParcelas(total);
        c.setValor(valor);
        c.setVencimento(vencimento);
        c.setFormaPagamento(forma);
        return c;
    }

    private void exigirAberto(StatusTitulo status) {
        if (status != StatusTitulo.ABERTO) {
            throw new NegocioException("Operação permitida apenas para títulos em aberto (atual: " + status + ")");
        }
    }

    private String limitar(String texto) {
        return texto.length() <= 255 ? texto : texto.substring(0, 255);
    }
}
