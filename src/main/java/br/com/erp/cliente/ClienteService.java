package br.com.erp.cliente;

import br.com.erp.cliente.ClienteDtos.ClienteRequest;
import br.com.erp.cliente.ClienteDtos.ClienteResponse;
import br.com.erp.common.DocumentoValidator;
import br.com.erp.common.Endereco;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.TipoPessoa;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class ClienteService {

    private final ClienteRepository repository;

    @Transactional(readOnly = true)
    public Page<ClienteResponse> listar(String termo, Boolean ativo, Pageable pageable) {
        Specification<Cliente> spec = (root, query, cb) -> cb.conjunction();
        if (termo != null && !termo.isBlank()) {
            String like = "%" + termo.trim().toLowerCase() + "%";
            String doc = DocumentoValidator.normalizar(termo);
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("nome")), like),
                    cb.like(cb.lower(root.get("email")), like),
                    cb.equal(root.get("documento"), doc)));
        }
        if (ativo != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("ativo"), ativo));
        }
        return repository.findAll(spec, pageable).map(ClienteResponse::from);
    }

    @Transactional(readOnly = true)
    public ClienteResponse buscar(Long id) {
        return ClienteResponse.from(obter(id));
    }

    @Transactional
    public ClienteResponse criar(ClienteRequest req) {
        String documento = validarDocumento(req.tipoPessoa(), req.documento());
        if (repository.existsByDocumento(documento)) {
            throw new NegocioException("Já existe cliente com o documento " + documento);
        }
        Cliente c = new Cliente();
        preencher(c, req, documento);
        return ClienteResponse.from(repository.save(c));
    }

    @Transactional
    public ClienteResponse atualizar(Long id, ClienteRequest req) {
        Cliente c = obter(id);
        String documento = validarDocumento(req.tipoPessoa(), req.documento());
        if (!c.getDocumento().equals(documento) && repository.existsByDocumento(documento)) {
            throw new NegocioException("Já existe cliente com o documento " + documento);
        }
        preencher(c, req, documento);
        return ClienteResponse.from(c);
    }

    @Transactional
    public void desativar(Long id) {
        obter(id).setAtivo(false);
    }

    public Cliente obter(Long id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Cliente", id));
    }

    private String validarDocumento(TipoPessoa tipo, String documento) {
        String doc = DocumentoValidator.normalizar(documento);
        if (!DocumentoValidator.valido(tipo, doc)) {
            throw new NegocioException((tipo == TipoPessoa.FISICA ? "CPF" : "CNPJ") + " inválido: " + documento);
        }
        return doc;
    }

    private void preencher(Cliente c, ClienteRequest req, String documento) {
        c.setTipoPessoa(req.tipoPessoa());
        c.setNome(req.nome().trim());
        c.setDocumento(documento);
        c.setInscricaoEstadual(req.inscricaoEstadual());
        c.setEmail(req.email());
        c.setTelefone(req.telefone());
        c.setEndereco(req.endereco() == null ? new Endereco() : req.endereco().toEntity());
        c.setLimiteCredito(req.limiteCredito() == null ? BigDecimal.ZERO : req.limiteCredito());
        if (req.ativo() != null) {
            c.setAtivo(req.ativo());
        }
    }
}
