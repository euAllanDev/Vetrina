package br.com.erp.fiscal;

import br.com.erp.common.DocumentoValidator;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.empresa.Empresa;
import br.com.erp.empresa.EmpresaService;
import br.com.erp.fiscal.NotaFiscalDtos.*;
import br.com.erp.fiscal.sefaz.SefazClient;
import br.com.erp.fiscal.sefaz.SefazClient.RetornoSefaz;
import br.com.erp.venda.StatusVenda;
import br.com.erp.venda.Venda;
import br.com.erp.venda.VendaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotaFiscalService {

    private final NotaFiscalRepository repository;
    private final VendaService vendaService;
    private final EmpresaService empresaService;
    private final CalculadoraImpostos calculadora;
    private final NfeXmlBuilder xmlBuilder;
    private final SefazClient sefaz;

    @Value("${app.nfe.prazo-cancelamento-horas:24}")
    private long prazoCancelamentoHoras;

    @Transactional(readOnly = true)
    public Page<NotaFiscalResponse> listar(StatusNotaFiscal status, LocalDate de, LocalDate ate, Pageable pageable) {
        Specification<NotaFiscal> spec = (root, query, cb) -> cb.conjunction();
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (de != null) {
            LocalDateTime inicio = de.atStartOfDay();
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.<LocalDateTime>get("dataEmissao"), inicio));
        }
        if (ate != null) {
            LocalDateTime fim = ate.plusDays(1).atStartOfDay();
            spec = spec.and((root, query, cb) -> cb.lessThan(root.<LocalDateTime>get("dataEmissao"), fim));
        }
        return repository.findAll(spec, pageable).map(NotaFiscalResponse::from);
    }

    @Transactional(readOnly = true)
    public NotaFiscalResponse buscar(Long id) {
        return NotaFiscalResponse.from(obter(id));
    }

    @Transactional(readOnly = true)
    public List<NotaFiscalResponse> porVenda(Long vendaId) {
        return repository.findByVendaIdOrderByIdDesc(vendaId).stream().map(NotaFiscalResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public String xml(Long id) {
        return obter(id).getXml();
    }

    /**
     * Emite a NF-e de uma venda confirmada: reserva número (com lock), calcula tributos, gera chave e XML,
     * envia à SEFAZ e, se autorizada, marca a venda como FATURADA.
     */
    @Transactional
    public NotaFiscalResponse emitir(EmitirNotaRequest req) {
        Venda venda = vendaService.obter(req.vendaId());
        if (venda.getStatus() != StatusVenda.CONFIRMADA) {
            throw new NegocioException("Só é possível emitir NF-e para venda CONFIRMADA (atual: " + venda.getStatus() + ")");
        }
        if (repository.existsByVendaIdAndStatus(venda.getId(), StatusNotaFiscal.AUTORIZADA)) {
            throw new NegocioException("Venda #" + venda.getId() + " já possui NF-e autorizada");
        }

        Empresa empresa = empresaService.obterParaNumeracao();
        validarEmitente(empresa);

        int numero = empresa.getProximoNumeroNfe();
        empresa.setProximoNumeroNfe(numero + 1);

        NotaFiscal nf = new NotaFiscal();
        nf.setVenda(venda);
        nf.setCliente(venda.getCliente());
        nf.setSerie(empresa.getSerieNfe());
        nf.setNumero(numero);
        nf.setAmbiente(empresa.getAmbienteNfe());
        nf.setNaturezaOperacao(req.naturezaOperacao() == null || req.naturezaOperacao().isBlank()
                ? "VENDA DE MERCADORIA" : req.naturezaOperacao().toUpperCase());
        nf.setDataEmissao(LocalDateTime.now());
        nf.setInformacoesComplementares(req.informacoesComplementares());

        calculadora.calcular(venda, empresa).forEach(nf::adicionarItem);
        totalizar(nf);

        int codigoNumerico = gerarCodigoNumerico(numero);
        nf.setChaveAcesso(ChaveAcesso.gerar(empresa.getCodigoUf(), nf.getDataEmissao(), empresa.getCnpj(),
                nf.getModelo(), nf.getSerie(), numero, 1, codigoNumerico));
        nf.setXml(xmlBuilder.gerar(nf, empresa, venda.getCliente(), venda.getFormaPagamento()));

        RetornoSefaz retorno = sefaz.autorizar(nf);
        nf.setMotivoStatus(retorno.codigoStatus() + " - " + retorno.motivo());
        if (retorno.sucesso()) {
            nf.setStatus(StatusNotaFiscal.AUTORIZADA);
            nf.setProtocolo(retorno.protocolo());
            nf.setDataAutorizacao(LocalDateTime.now());
            venda.setStatus(StatusVenda.FATURADA);
        } else {
            // Número consumido: em produção, deve ser inutilizado na SEFAZ se não for reaproveitado.
            nf.setStatus(StatusNotaFiscal.REJEITADA);
            log.warn("NF-e {} rejeitada: {}", numero, nf.getMotivoStatus());
        }
        return NotaFiscalResponse.from(repository.save(nf));
    }

    /** Cancela NF-e autorizada dentro do prazo; a venda volta para CONFIRMADA. */
    @Transactional
    public NotaFiscalResponse cancelar(Long id, CancelarNotaRequest req) {
        NotaFiscal nf = obter(id);
        if (nf.getStatus() != StatusNotaFiscal.AUTORIZADA) {
            throw new NegocioException("Somente NF-e autorizada pode ser cancelada (atual: " + nf.getStatus() + ")");
        }
        long horas = Duration.between(nf.getDataAutorizacao(), LocalDateTime.now()).toHours();
        if (horas >= prazoCancelamentoHoras) {
            throw new NegocioException("Prazo de cancelamento expirado (" + prazoCancelamentoHoras
                    + "h). Emita uma NF-e de devolução/estorno.");
        }
        RetornoSefaz retorno = sefaz.cancelar(nf, req.justificativa());
        if (!retorno.sucesso()) {
            throw new NegocioException("SEFAZ rejeitou o cancelamento: " + retorno.codigoStatus() + " - " + retorno.motivo());
        }
        nf.setStatus(StatusNotaFiscal.CANCELADA);
        nf.setDataCancelamento(LocalDateTime.now());
        nf.setProtocoloCancelamento(retorno.protocolo());
        nf.setJustificativaCancelamento(req.justificativa());
        nf.setMotivoStatus(retorno.codigoStatus() + " - " + retorno.motivo());
        nf.getVenda().setStatus(StatusVenda.CONFIRMADA);
        return NotaFiscalResponse.from(nf);
    }

    private void totalizar(NotaFiscal nf) {
        List<ItemNotaFiscal> itens = nf.getItens();
        nf.setValorProdutos(soma(itens, ItemNotaFiscal::getValorBruto));
        nf.setValorDesconto(soma(itens, ItemNotaFiscal::getValorDesconto));
        nf.setValorFrete(soma(itens, ItemNotaFiscal::getValorFrete));
        nf.setBaseIcms(soma(itens, ItemNotaFiscal::getBaseIcms));
        nf.setValorIcms(soma(itens, ItemNotaFiscal::getValorIcms));
        nf.setValorIpi(soma(itens, ItemNotaFiscal::getValorIpi));
        nf.setValorPis(soma(itens, ItemNotaFiscal::getValorPis));
        nf.setValorCofins(soma(itens, ItemNotaFiscal::getValorCofins));
        nf.setValorTotal(nf.getValorProdutos().subtract(nf.getValorDesconto())
                .add(nf.getValorFrete()).add(nf.getValorIpi()));
    }

    private BigDecimal soma(List<ItemNotaFiscal> itens, Function<ItemNotaFiscal, BigDecimal> campo) {
        return itens.stream().map(campo).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void validarEmitente(Empresa e) {
        if (!DocumentoValidator.cnpjValido(e.getCnpj())) {
            throw new NegocioException("CNPJ do emitente inválido; ajuste em PUT /api/empresa");
        }
        if (e.getEndereco() == null || e.getEndereco().getCodigoMunicipio() == null || e.getEndereco().getUf() == null) {
            throw new NegocioException("Endereço do emitente incompleto (UF e código IBGE do município são obrigatórios)");
        }
    }

    /** cNF: 8 dígitos aleatórios, diferente do número da nota. */
    private int gerarCodigoNumerico(int numero) {
        int codigo;
        do {
            codigo = ThreadLocalRandom.current().nextInt(10_000_000, 100_000_000);
        } while (codigo == numero);
        return codigo;
    }

    private NotaFiscal obter(Long id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Nota fiscal", id));
    }
}
