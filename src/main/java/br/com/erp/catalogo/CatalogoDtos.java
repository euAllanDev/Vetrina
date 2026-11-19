package br.com.erp.catalogo;

import br.com.erp.financeiro.FormaPagamento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class CatalogoDtos {

    private CatalogoDtos() {
    }

    public record Loja(String nome, String razaoSocial, String telefone, String email, String cidade, String uf) {
    }

    public record CategoriaVitrine(Long id, String nome, long quantidade) {
    }

    /** Vista pública do produto: sem custo, sem dados fiscais, sem estoque exato (só "últimas unidades"). */
    public record ProdutoVitrine(Long id, String codigo, String nome, BigDecimal preco, Long categoriaId, String categoriaNome,
                                 String unidade, String imagemUrl, boolean disponivel, Integer ultimasUnidades,
                                 BigDecimal precoAnterior, Integer desconto, String detalhes, boolean novo, boolean maisVendido,
                                 List<OfertaVitrine> ofertas) {
    }

    /** Oferta numa loja parceira. O link de afiliado não vai para a vitrine: o clique passa por /api/ir/{id}. */
    public record OfertaVitrine(Long id, Long parceiroId, String loja, String cor, BigDecimal preco, BigDecimal precoAnterior,
                                BigDecimal frete, String parcelamento, BigDecimal nota, Integer avaliacoes,
                                boolean disponivel, LocalDateTime verificadoEm) {
    }

    public record ParceiroVitrine(Long id, String nome, String cor, long produtos) {
    }

    public record CatalogoResponse(Loja loja, List<CategoriaVitrine> categorias, List<ProdutoVitrine> produtos,
                                   List<ParceiroVitrine> parceiros) {
    }

    public record ItemPedido(@NotNull Long produtoId, @NotNull @Positive @Max(100) BigDecimal quantidade) {
    }

    public record PedidoLojaRequest(
            @NotBlank @Size(max = 120) String nome,
            @NotBlank @Pattern(regexp = "[0-9()+\\-\\s]{8,20}", message = "telefone inválido") String telefone,
            @Email @Size(max = 160) String email,
            @NotNull FormaPagamento formaPagamento,
            @Size(max = 300) String observacao,
            @NotEmpty @Size(max = 30) @Valid List<ItemPedido> itens) {
    }

    public record PedidoLojaResponse(Long pedido, BigDecimal total, int itens, String mensagem) {
    }
}
