package br.com.erp.anuncio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BannerRepository extends JpaRepository<Banner, Long> {

    List<Banner> findAllByOrderByPosicaoAscOrdemAscIdDesc();

    @Modifying
    @Query("update Banner b set b.cliques = b.cliques + 1 where b.id = :id")
    int somarClique(@Param("id") Long id);
}
