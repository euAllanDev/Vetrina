package br.com.erp.catalogo;

import br.com.erp.catalogo.CatalogoDtos.*;
import br.com.erp.common.Endereco;
import br.com.erp.common.NegocioException;
import br.com.erp.empresa.Empresa;
import br.com.erp.empresa.EmpresaRepository;
import br.com.erp.financeiro.FormaPagamento;
import br.com.erp.produto.Categoria;
import br.com.erp.produto.Produto;
import br.com.erp.produto.ProdutoDtos.ProdutoResponse;
import br.com.erp.produto.ProdutoRepository;
import br.com.erp.venda.VendaDtos.ItemVendaRequest;
import br.com.erp.venda.VendaDtos.VendaRequest;
import br.com.erp.venda.VendaDtos.VendaResponse;
import br.com.erp.venda.VendaService;
import br.com.erp.venda.VendaRepository;
import br.com.erp.venda.StatusVenda;
import org.springframework.data.domain.PageRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CatalogoService {

    /** Na loja só entram formas que não exigem cadastro de cliente/limite de crédito. */
    private static final Set<FormaPagamento> FORMAS_LOJA =
            EnumSet.of(FormaPagamento.PIX, FormaPagamento.CARTAO_CREDITO, FormaPagamento.CARTAO_DEBITO, FormaPagamento.DINHEIRO);

    private final ProdutoRepository produtoRepository;
    private final EmpresaRepository empresaRepository;
    private final VendaService vendaService;
    private final VendaRepository vendaRepository;

    @Transactional(readOnly = true)
    public CatalogoResponse catalogo() {
        List<Produto> produtos = produtoRepository.findAll(
                (root, query, cb) -> cb.isTrue(root.get("ativo")), Sort.by("descricao"));

        // "Novo": os 8 cadastrados mais recentemente. "Mais vendido": top 8 em quantidade nos últimos 90 dias.
        Set<Long> novos = produtos.stream()
                .sorted(Comparator.comparing(Produto::getCriadoEm, Comparator.nullsFirst(Comparator.naturalOrder())).reversed())
                .limit(8).map(Produto::getId).collect(java.util.stream.Collectors.toSet());
        LocalDateTime ate = LocalDate.now().plusDays(1).atStartOfDay();
        Set<Long> maisVendidos = new HashSet<>();
        vendaRepository.maisVendidos(List.of(StatusVenda.CONFIRMADA, StatusVenda.FATURADA),
                ate.minusDays(91), ate, PageRequest.of(0, 8)).forEach(pv -> maisVendidos.add(pv.produtoId()));

        List<ProdutoVitrine> vitrine = produtos.stream()
                .map(p -> vitrine(p, novos.contains(p.getId()), maisVendidos.contains(p.getId()))).toList();

        Map<Long, String> nomes = new HashMap<>();
        Map<Long, Long> contagem = new HashMap<>();
        for (Produto p : produtos) {
            Categoria c = p.getCategoria();
            if (c != null && c.isAtivo()) {
                nomes.put(c.getId(), c.getNome());
                contagem.merge(c.getId(), 1L, Long::sum);
            }
        }
        List<CategoriaVitrine> categorias = nomes.entrySet().stream()
                .map(e -> new CategoriaVitrine(e.getKey(), e.getValue(), contagem.get(e.getKey())))
                .sorted(Comparator.comparing(CategoriaVitrine::nome))
                .toList();

        return new CatalogoResponse(loja(), categorias, vitrine);
    }

    @Transactional
    public PedidoLojaResponse pedido(PedidoLojaRequest req) {
        if (!FORMAS_LOJA.contains(req.formaPagamento())) {
            throw new NegocioException("Forma de pagamento indisponível na loja");
        }
        // Junta linhas repetidas do mesmo produto.
        Map<Long, BigDecimal> qtd = new LinkedHashMap<>();
        req.itens().forEach(i -> qtd.merge(i.produtoId(), i.quantidade(), BigDecimal::add));
        List<ItemVendaRequest> itens = qtd.entrySet().stream()
                .map(e -> new ItemVendaRequest(e.getKey(), e.getValue(), null, null)).toList();

        String contato = "Pedido da loja online. Cliente: " + req.nome().trim()
                + " · Tel: " + req.telefone().trim()
                + (req.email() == null || req.email().isBlank() ? "" : " · E-mail: " + req.email().trim())
                + (req.observacao() == null || req.observacao().isBlank() ? "" : " · Obs.: " + req.observacao().trim());

        VendaResponse v = vendaService.criarPedidoLoja(
                new VendaRequest(null, req.formaPagamento(), 1, BigDecimal.ZERO, BigDecimal.ZERO, null, itens), contato);
        return new PedidoLojaResponse(v.id(), v.valorTotal(), v.itens().size(),
                "Recebemos seu pedido. Vamos entrar em contato pelo telefone informado para confirmar.");
    }

    private ProdutoVitrine vitrine(Produto p, boolean novo, boolean maisVendido) {
        BigDecimal estoque = p.getEstoqueAtual();
        boolean disponivel = estoque.signum() > 0;
        Integer ultimas = disponivel && estoque.compareTo(BigDecimal.valueOf(5)) <= 0 ? estoque.intValue() : null;
        Categoria c = p.getCategoria();
        boolean promocao = p.getPrecoAnterior() != null && p.getPrecoAnterior().compareTo(p.getPrecoVenda()) > 0;
        return new ProdutoVitrine(p.getId(), p.getCodigo(), p.getDescricao(), p.getPrecoVenda(),
                c == null ? null : c.getId(), c == null ? null : c.getNome(), p.getUnidade(),
                ProdutoResponse.from(p).imagemUrl(), disponivel, ultimas,
                promocao ? p.getPrecoAnterior() : null, promocao ? desconto(p) : null, p.getDetalhes(), novo, maisVendido);
    }

    private static Integer desconto(Produto p) {
        BigDecimal diff = p.getPrecoAnterior().subtract(p.getPrecoVenda());
        return diff.multiply(BigDecimal.valueOf(100)).divide(p.getPrecoAnterior(), 0, java.math.RoundingMode.HALF_UP).intValue();
    }

    private Loja loja() {
        return empresaRepository.findFirstByOrderByIdAsc().map(this::loja).orElse(new Loja("Loja", null, null, null, null, null));
    }

    private Loja loja(Empresa e) {
        Endereco end = e.getEndereco();
        String nome = e.getNomeFantasia() == null || e.getNomeFantasia().isBlank() ? e.getRazaoSocial() : e.getNomeFantasia();
        return new Loja(nome, e.getRazaoSocial(), e.getTelefone(), e.getEmail(),
                end == null ? null : end.getMunicipio(), end == null ? null : end.getUf());
    }
}
