package br.com.erp.afiliado;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ParceiroRepository extends JpaRepository<Parceiro, Long> {
    boolean existsByNomeIgnoreCase(String nome);

    List<Parceiro> findAllByOrderByNomeAsc();
}
