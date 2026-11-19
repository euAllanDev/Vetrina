package br.com.erp.fiscal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface NotaFiscalRepository extends JpaRepository<NotaFiscal, Long>, JpaSpecificationExecutor<NotaFiscal> {

    boolean existsByVendaIdAndStatus(Long vendaId, StatusNotaFiscal status);

    List<NotaFiscal> findByVendaIdOrderByIdDesc(Long vendaId);
}
