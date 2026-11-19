package br.com.erp.fornecedor;

import br.com.erp.common.DocumentoValidator;
import br.com.erp.common.Endereco;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.TipoPessoa;
import br.com.erp.fornecedor.FornecedorDtos.FornecedorRequest;
import br.com.erp.fornecedor.FornecedorDtos.FornecedorResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FornecedorService {

    private final FornecedorRepository repository;

    @Transactional(readOnly = true)
    public Page<FornecedorResponse> listar(String termo, Boolean ativo, Pageable pageable) {
        Specification<Fornecedor> spec = (root, query, cb) -> cb.conjunction();
        if (termo != null && !termo.isBlank()) {
            String like = "%" + termo.trim().toLowerCase() + "%";
            String doc = DocumentoValidator.normalizar(termo);
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("razaoSocial")), like),
                    cb.like(cb.lower(root.get("nomeFantasia")), like),
                    cb.equal(root.get("documento"), doc)));
        }
        if (ativo != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("ativo"), ativo));
        }
        return repository.findAll(spec, pageable).map(FornecedorResponse::from);
    }

    @Transactional(readOnly = true)
    public FornecedorResponse buscar(Long id) {
        return FornecedorResponse.from(obter(id));
    }

    @Transactional
    public FornecedorResponse criar(FornecedorRequest req) {
        String documento = validarDocumento(req.tipoPessoa(), req.documento());
        if (repository.existsByDocumento(documento)) {
            throw new NegocioException("Já existe fornecedor com o documento " + documento);
        }
        Fornecedor f = new Fornecedor();
        preencher(f, req, documento);
        return FornecedorResponse.from(repository.save(f));
    }

    @Transactional
    public FornecedorResponse atualizar(Long id, FornecedorRequest req) {
        Fornecedor f = obter(id);
        String documento = validarDocumento(req.tipoPessoa(), req.documento());
        if (!f.getDocumento().equals(documento) && repository.existsByDocumento(documento)) {
            throw new NegocioException("Já existe fornecedor com o documento " + documento);
        }
        preencher(f, req, documento);
        return FornecedorResponse.from(f);
    }

    @Transactional
    public void desativar(Long id) {
        obter(id).setAtivo(false);
    }

    public Fornecedor obter(Long id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Fornecedor", id));
    }

    private String validarDocumento(TipoPessoa tipo, String documento) {
        String doc = DocumentoValidator.normalizar(documento);
        if (!DocumentoValidator.valido(tipo, doc)) {
            throw new NegocioException((tipo == TipoPessoa.FISICA ? "CPF" : "CNPJ") + " inválido: " + documento);
        }
        return doc;
    }

    private void preencher(Fornecedor f, FornecedorRequest req, String documento) {
        f.setTipoPessoa(req.tipoPessoa());
        f.setRazaoSocial(req.razaoSocial().trim());
        f.setNomeFantasia(req.nomeFantasia());
        f.setDocumento(documento);
        f.setInscricaoEstadual(req.inscricaoEstadual());
        f.setEmail(req.email());
        f.setTelefone(req.telefone());
        f.setContato(req.contato());
        f.setEndereco(req.endereco() == null ? new Endereco() : req.endereco().toEntity());
        if (req.ativo() != null) {
            f.setAtivo(req.ativo());
        }
    }
}
