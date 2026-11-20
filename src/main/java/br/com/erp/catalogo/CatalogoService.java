package br.com.erp.catalogo;

import br.com.erp.afiliado.Oferta;
import br.com.erp.afiliado.OfertaRepository;
import br.com.erp.afiliado.Parceiro;
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
    private final OfertaRepository ofertaRepository;

    private final org.springframework.transaction.PlatformTransactionManager txManager;

    /** Catálogo pronto em memória: o banco fica longe do servidor e montar tudo leva segundos. */
    private record Guardado(CatalogoResponse resposta, long versao, long em) {
    }

    private volatile Guardado guardado;

    /**
     * Devolve o catálogo guardado enquanto nada da vitrine mudou (e por no máximo 2 minutos, por causa dos
     * selos que vencem com o tempo). Sem transação aqui: uma visita com o catálogo pronto nem abre conexão
     * com o banco, que pode continuar dormindo.
     */
    public CatalogoResponse catalogo() {
        Guardado g = guardado;
        long versao = CatalogoInvalidador.VERSAO.get();
        if (g != null && g.versao() == versao && System.currentTimeMillis() - g.em() < 120_000) return g.resposta();
        var tx = new org.springframework.transaction.support.TransactionTemplate(txManager);
        tx.setReadOnly(true);
        CatalogoResponse r = tx.execute(s -> montar());
        guardado = new Guardado(r, versao, System.currentTimeMillis());
        return r;
    }

    private CatalogoResponse montar() {
        List<Produto> produtos = produtoRepository.daVitrine();

        // "Novo": os 8 cadastrados mais recentemente. "Mais vendido": top 8 em quantidade nos últimos 90 dias.
        Set<Long> novos = produtos.stream()
                .sorted(Comparator.comparing(Produto::getCriadoEm, Comparator.nullsFirst(Comparator.naturalOrder())).reversed())
                .limit(8).map(Produto::getId).collect(java.util.stream.Collectors.toSet());
        LocalDateTime ate = LocalDate.now().plusDays(1).atStartOfDay();
        Set<Long> maisVendidos = new HashSet<>();
        vendaRepository.maisVendidos(List.of(StatusVenda.CONFIRMADA, StatusVenda.FATURADA),
                ate.minusDays(91), ate, PageRequest.of(0, 8)).forEach(pv -> maisVendidos.add(pv.produtoId()));

        // Ofertas das lojas parceiras, agrupadas por produto (mais barata primeiro).
        Map<Long, List<Oferta>> ofertasPorProduto = new HashMap<>();
        Map<Long, Parceiro> parceirosUsados = new LinkedHashMap<>();
        Map<Long, Set<Long>> produtosPorParceiro = new HashMap<>();
        for (Oferta o : ofertaRepository.daVitrine()) {
            ofertasPorProduto.computeIfAbsent(o.getProduto().getId(), k -> new ArrayList<>()).add(o);
        }
        ofertasPorProduto.values().forEach(l -> l.sort(Comparator
                .comparing((Oferta o) -> !o.isDisponivel())
                .thenComparing(o -> o.getPreco().add(o.getFrete() == null ? BigDecimal.ZERO : o.getFrete()))));
        Set<Long> ativos = new HashSet<>();
        produtos.forEach(p -> ativos.add(p.getId()));
        ofertasPorProduto.forEach((pid, l) -> {
            if (!ativos.contains(pid)) return;
            l.forEach(o -> {
                parceirosUsados.putIfAbsent(o.getParceiro().getId(), o.getParceiro());
                produtosPorParceiro.computeIfAbsent(o.getParceiro().getId(), k -> new HashSet<>()).add(pid);
            });
        });

        List<ProdutoVitrine> vitrine = produtos.stream()
                .map(p -> vitrine(p, novos.contains(p.getId()), maisVendidos.contains(p.getId()),
                        ofertasPorProduto.getOrDefault(p.getId(), List.of()))).toList();
        List<ParceiroVitrine> parceiros = parceirosUsados.values().stream()
                .map(pa -> new ParceiroVitrine(pa.getId(), pa.getNome(), pa.getCor(), produtosPorParceiro.get(pa.getId()).size()))
                .sorted(Comparator.comparing(ParceiroVitrine::nome)).toList();

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

        return new CatalogoResponse(loja(), categorias, vitrine, parceiros);
    }

    @Transactional
    public PedidoLojaResponse pedido(PedidoLojaRequest req) {
        if (!FORMAS_LOJA.contains(req.formaPagamento())) {
            throw new NegocioException("Forma de pagamento indisponível na loja");
        }
        Set<Long> deAfiliado = new HashSet<>();
        ofertaRepository.daVitrine().forEach(o -> deAfiliado.add(o.getProduto().getId()));
        if (req.itens().stream().anyMatch(i -> deAfiliado.contains(i.produtoId()))) {
            throw new NegocioException("Este produto é vendido nas lojas parceiras: use o botão \"Ver na loja\".");
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

    private ProdutoVitrine vitrine(Produto p, boolean novo, boolean maisVendido, List<Oferta> ofertas) {
        Categoria c = p.getCategoria();
        List<OfertaVitrine> ov = ofertas.stream().map(o -> new OfertaVitrine(o.getId(), o.getParceiro().getId(),
                o.getParceiro().getNome(), o.getParceiro().getCor(), o.getPreco(), o.getPrecoAnterior(), o.getFrete(),
                o.getParcelamento(), o.getNota(), o.getAvaliacoes(), o.isDisponivel(), o.getVerificadoEm(), baixouDe(o))).toList();
        if (!ofertas.isEmpty()) {
            // Produto de afiliado: preço e disponibilidade vêm da melhor oferta.
            Oferta melhor = ofertas.get(0);
            boolean disponivel = melhor.isDisponivel();
            BigDecimal ant = melhor.getPrecoAnterior() != null && melhor.getPrecoAnterior().compareTo(melhor.getPreco()) > 0
                    ? melhor.getPrecoAnterior() : null;
            Integer desc = ant == null ? null : ant.subtract(melhor.getPreco()).multiply(BigDecimal.valueOf(100))
                    .divide(ant, 0, java.math.RoundingMode.HALF_UP).intValue();
            return new ProdutoVitrine(p.getId(), p.getCodigo(), p.getDescricao(), melhor.getPreco(),
                    c == null ? null : c.getId(), c == null ? null : c.getNome(), p.getUnidade(),
                    ProdutoResponse.from(p).imagemUrl(), disponivel, null, ant, desc, p.getDetalhes(), novo, maisVendido, ov,
                    disponivel ? baixouDe(melhor) : null);
        }
        BigDecimal estoque = p.getEstoqueAtual();
        boolean disponivel = estoque.signum() > 0;
        Integer ultimas = disponivel && estoque.compareTo(BigDecimal.valueOf(5)) <= 0 ? estoque.intValue() : null;
        boolean promocao = p.getPrecoAnterior() != null && p.getPrecoAnterior().compareTo(p.getPrecoVenda()) > 0;
        return new ProdutoVitrine(p.getId(), p.getCodigo(), p.getDescricao(), p.getPrecoVenda(),
                c == null ? null : c.getId(), c == null ? null : c.getNome(), p.getUnidade(),
                ProdutoResponse.from(p).imagemUrl(), disponivel, ultimas,
                promocao ? p.getPrecoAnterior() : null, promocao ? desconto(p) : null, p.getDetalhes(), novo, maisVendido, ov, null);
    }

    /** Preço antes da queda, se a oferta baixou de preço nos últimos 3 dias. */
    private static BigDecimal baixouDe(Oferta o) {
        if (o.getPrecoBaixouDe() == null || o.getBaixouEm() == null) return null;
        if (o.getBaixouEm().isBefore(LocalDateTime.now().minusDays(3))) return null;
        return o.getPrecoBaixouDe().compareTo(o.getPreco()) > 0 ? o.getPrecoBaixouDe() : null;
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
