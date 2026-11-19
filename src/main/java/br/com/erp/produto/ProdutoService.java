package br.com.erp.produto;

import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.common.Valores;
import br.com.erp.estoque.EstoqueService;
import br.com.erp.estoque.OrigemMovimentacao;
import br.com.erp.produto.ProdutoDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProdutoService {

    private final ProdutoRepository produtoRepository;
    private final CategoriaRepository categoriaRepository;
    private final EstoqueService estoqueService;

    // ---------- Categorias ----------

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listarCategorias() {
        return categoriaRepository.findAllByOrderByNomeAsc().stream().map(CategoriaResponse::from).toList();
    }

    @Transactional
    public CategoriaResponse criarCategoria(CategoriaRequest req) {
        if (categoriaRepository.existsByNomeIgnoreCase(req.nome())) {
            throw new NegocioException("Já existe uma categoria chamada " + req.nome());
        }
        Categoria c = new Categoria();
        preencherCategoria(c, req);
        return CategoriaResponse.from(categoriaRepository.save(c));
    }

    @Transactional
    public CategoriaResponse atualizarCategoria(Long id, CategoriaRequest req) {
        Categoria c = categoria(id);
        if (!c.getNome().equalsIgnoreCase(req.nome()) && categoriaRepository.existsByNomeIgnoreCase(req.nome())) {
            throw new NegocioException("Já existe uma categoria chamada " + req.nome());
        }
        preencherCategoria(c, req);
        return CategoriaResponse.from(c);
    }

    @Transactional
    public void excluirCategoria(Long id) {
        Categoria c = categoria(id);
        if (produtoRepository.existsByCategoriaId(id)) {
            throw new NegocioException("Categoria possui produtos vinculados; desative-a em vez de excluir");
        }
        categoriaRepository.delete(c);
    }

    private void preencherCategoria(Categoria c, CategoriaRequest req) {
        c.setNome(req.nome());
        c.setDescricao(req.descricao());
        if (req.ativo() != null) {
            c.setAtivo(req.ativo());
        }
    }

    private Categoria categoria(Long id) {
        return categoriaRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Categoria", id));
    }

    // ---------- Produtos ----------

    @Transactional(readOnly = true)
    public Page<ProdutoResponse> listar(String termo, Long categoriaId, Boolean ativo, Pageable pageable) {
        Specification<Produto> spec = (root, query, cb) -> cb.conjunction();
        if (termo != null && !termo.isBlank()) {
            String like = "%" + termo.trim().toLowerCase() + "%";
            String exato = termo.trim();
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("descricao")), like),
                    cb.like(cb.lower(root.get("codigo")), like),
                    cb.equal(root.get("ean"), exato)));
        }
        if (categoriaId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("categoria").get("id"), categoriaId));
        }
        if (ativo != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("ativo"), ativo));
        }
        return produtoRepository.findAll(spec, pageable).map(ProdutoResponse::from);
    }

    @Transactional(readOnly = true)
    public ProdutoResponse buscar(Long id) {
        return ProdutoResponse.from(obter(id));
    }

    @Transactional(readOnly = true)
    public List<ProdutoResponse> abaixoDoMinimo() {
        return produtoRepository.findAbaixoDoMinimo().stream().map(ProdutoResponse::from).toList();
    }

    @Transactional
    public ProdutoResponse criar(ProdutoRequest req) {
        if (produtoRepository.existsByCodigoIgnoreCase(req.codigo())) {
            throw new NegocioException("Já existe produto com o código " + req.codigo());
        }
        Produto p = new Produto();
        preencher(p, req);
        produtoRepository.save(p);
        if (Valores.positivo(req.estoqueInicial())) {
            estoqueService.entrada(p, req.estoqueInicial(), req.precoCusto(),
                    OrigemMovimentacao.ESTOQUE_INICIAL, null, "Estoque inicial no cadastro");
        }
        return ProdutoResponse.from(p);
    }

    @Transactional
    public ProdutoResponse atualizar(Long id, ProdutoRequest req) {
        Produto p = obter(id);
        if (!p.getCodigo().equalsIgnoreCase(req.codigo()) && produtoRepository.existsByCodigoIgnoreCase(req.codigo())) {
            throw new NegocioException("Já existe produto com o código " + req.codigo());
        }
        preencher(p, req);
        return ProdutoResponse.from(p);
    }

    @Transactional
    public void desativar(Long id) {
        obter(id).setAtivo(false);
    }

    public Produto obter(Long id) {
        return produtoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Produto", id));
    }

    /** Estoque não é alterado aqui: só via movimentações. */
    private void preencher(Produto p, ProdutoRequest req) {
        p.setCodigo(req.codigo().trim());
        p.setDescricao(req.descricao().trim());
        p.setEan(req.ean());
        p.setCategoria(req.categoriaId() == null ? null : categoria(req.categoriaId()));
        p.setUnidade(req.unidade() == null || req.unidade().isBlank() ? "UN" : req.unidade().toUpperCase());
        p.setPrecoCusto(req.precoCusto());
        p.setPrecoVenda(req.precoVenda());
        p.setEstoqueMinimo(req.estoqueMinimo() == null ? BigDecimal.ZERO : req.estoqueMinimo());
        if (req.ativo() != null) {
            p.setAtivo(req.ativo());
        }
        p.setNcm(req.ncm());
        p.setCest(req.cest());
        if (req.cfop() != null) {
            p.setCfop(req.cfop());
        }
        if (req.origem() != null) {
            p.setOrigem(req.origem());
        }
        if (req.cstIcms() != null) {
            p.setCstIcms(req.cstIcms());
        }
        p.setAliquotaIcms(Valores.nz(req.aliquotaIcms()));
        p.setAliquotaIpi(Valores.nz(req.aliquotaIpi()));
        p.setAliquotaPis(Valores.nz(req.aliquotaPis()));
        p.setAliquotaCofins(Valores.nz(req.aliquotaCofins()));
        p.setPrecoAnterior(Valores.positivo(req.precoAnterior()) ? req.precoAnterior() : null);
        p.setDetalhes(req.detalhes() == null || req.detalhes().isBlank() ? null : req.detalhes().trim());
    }
}
