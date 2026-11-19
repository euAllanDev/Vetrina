package br.com.erp.empresa;

import br.com.erp.common.DocumentoValidator;
import br.com.erp.common.NegocioException;
import br.com.erp.empresa.EmpresaDtos.EmpresaRequest;
import br.com.erp.empresa.EmpresaDtos.EmpresaResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmpresaService {

    private final EmpresaRepository repository;

    @Transactional(readOnly = true)
    public EmpresaResponse buscar() {
        return EmpresaResponse.from(obter());
    }

    @Transactional
    public EmpresaResponse atualizar(EmpresaRequest req) {
        String cnpj = DocumentoValidator.normalizar(req.cnpj());
        if (!DocumentoValidator.cnpjValido(cnpj)) {
            throw new NegocioException("CNPJ inválido");
        }
        Empresa e = repository.findFirstByOrderByIdAsc().orElseGet(Empresa::new);
        e.setRazaoSocial(req.razaoSocial());
        e.setNomeFantasia(req.nomeFantasia());
        e.setCnpj(cnpj);
        e.setInscricaoEstadual(req.inscricaoEstadual());
        e.setInscricaoMunicipal(req.inscricaoMunicipal());
        e.setCrt(req.crt());
        e.setTelefone(req.telefone());
        e.setEmail(req.email());
        e.setEndereco(req.endereco().toEntity());
        e.setCodigoUf(req.codigoUf());
        e.setSerieNfe(req.serieNfe());
        e.setProximoNumeroNfe(req.proximoNumeroNfe());
        e.setAmbienteNfe(req.ambienteNfe());
        return EmpresaResponse.from(repository.save(e));
    }

    public Empresa obter() {
        return repository.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new NegocioException("Cadastre os dados da empresa em PUT /api/empresa"));
    }

    /** Retorna a empresa com lock pessimista (usar dentro de transação). */
    public Empresa obterParaNumeracao() {
        Long id = obter().getId();
        return repository.findByIdParaAtualizacao(id).orElseThrow();
    }
}
