package br.com.erp.afiliado;

import br.com.erp.afiliado.AfiliadoDtos.*;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.produto.Produto;
import br.com.erp.produto.ProdutoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AfiliadoService {

    private final ParceiroRepository parceiros;
    private final OfertaRepository ofertas;
    private final HistoricoPrecoRepository historico;
    private final CliqueRepository cliques;
    private final ProdutoRepository produtos;
    private final br.com.erp.alerta.AlertaPrecoRepository alertas;
    private final org.springframework.context.ApplicationEventPublisher eventos;

    /** ID de publisher na Awin (Conta → Detalhes). Com ele, links Awin são montados sozinhos. */
    @Value("${app.afiliados.awin.publisher-id:}")
    private String awinPublisherId;

    // ---------------- parceiros ----------------

    @Transactional(readOnly = true)
    public List<ParceiroResponse> listarParceiros() {
        return parceiros.findAllByOrderByNomeAsc().stream()
                .map(p -> ParceiroResponse.from(p, ofertas.countByParceiroId(p.getId()))).toList();
    }

    @Transactional
    public ParceiroResponse criarParceiro(ParceiroRequest req) {
        if (parceiros.existsByNomeIgnoreCase(req.nome().trim())) {
            throw new NegocioException("Já existe uma loja parceira com esse nome");
        }
        Parceiro p = new Parceiro();
        preencher(p, req);
        return ParceiroResponse.from(parceiros.save(p), 0);
    }

    @Transactional
    public ParceiroResponse atualizarParceiro(Long id, ParceiroRequest req) {
        Parceiro p = parceiro(id);
        if (!p.getNome().equalsIgnoreCase(req.nome().trim()) && parceiros.existsByNomeIgnoreCase(req.nome().trim())) {
            throw new NegocioException("Já existe uma loja parceira com esse nome");
        }
        preencher(p, req);
        return ParceiroResponse.from(p, ofertas.countByParceiroId(id));
    }

    private void preencher(Parceiro p, ParceiroRequest req) {
        p.setNome(req.nome().trim());
        p.setRede(req.rede());
        p.setCor(vazioParaNulo(req.cor()));
        p.setSite(vazioParaNulo(req.site()));
        p.setAwinMerchantId(vazioParaNulo(req.awinMerchantId()));
        if (req.ativo() != null) p.setAtivo(req.ativo());
    }

    private Parceiro parceiro(Long id) {
        return parceiros.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Loja parceira", id));
    }

    // ---------------- ofertas ----------------

    @Transactional(readOnly = true)
    public List<OfertaResponse> ofertasDoProduto(Long produtoId) {
        return ofertas.doProduto(produtoId).stream().map(OfertaResponse::from).toList();
    }

    @Transactional
    public OfertaResponse criarOferta(Long produtoId, OfertaRequest req) {
        Produto produto = produtos.findById(produtoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Produto", produtoId));
        Oferta o = new Oferta();
        o.setProduto(produto);
        preencher(o, req);
        o = ofertas.save(o);
        historico.save(new HistoricoPreco(o, o.getPreco()));
        eventos.publishEvent(new br.com.erp.alerta.PrecoMudou(produtoId));
        return OfertaResponse.from(o);
    }

    @Transactional
    public OfertaResponse atualizarOferta(Long id, OfertaRequest req) {
        Oferta o = oferta(id);
        BigDecimal antes = o.getPreco();
        preencher(o, req);
        if (antes == null || antes.compareTo(o.getPreco()) != 0) {
            historico.save(new HistoricoPreco(o, o.getPreco()));
        }
        eventos.publishEvent(new br.com.erp.alerta.PrecoMudou(o.getProduto().getId()));
        return OfertaResponse.from(o);
    }

    /** Confirma que o preço continua o mesmo (registra a conferência e um ponto no histórico do dia). */
    @Transactional
    public OfertaResponse conferirOferta(Long id) {
        Oferta o = oferta(id);
        o.setVerificadoEm(LocalDateTime.now());
        historico.save(new HistoricoPreco(o, o.getPreco()));
        return OfertaResponse.from(o);
    }

    @Transactional
    public void excluirOferta(Long id) {
        Oferta o = oferta(id);
        historico.apagarDaOferta(id);
        ofertas.delete(o);
    }

    private void preencher(Oferta o, OfertaRequest req) {
        Parceiro p = parceiro(req.parceiroId());
        o.setParceiro(p);
        String urlProduto = vazioParaNulo(req.urlProduto());
        String url = montarLink(p, vazioParaNulo(req.url()), urlProduto);
        validarUrl(url, "Link de afiliado");
        if (urlProduto != null) validarUrl(urlProduto, "Endereço do produto");
        o.setUrl(url);
        o.setUrlProduto(urlProduto);
        if (o.getPreco() != null && o.getPreco().compareTo(req.preco()) != 0) {
            // Alteração manual de preço apaga o selo "Baixou" antigo.
            o.setPrecoBaixouDe(null);
            o.setBaixouEm(null);
        }
        o.setPreco(req.preco());
        o.setPrecoAnterior(req.precoAnterior() != null && req.precoAnterior().compareTo(req.preco()) > 0 ? req.precoAnterior() : null);
        o.setFrete(req.frete());
        o.setParcelamento(vazioParaNulo(req.parcelamento()));
        o.setNota(req.nota());
        o.setAvaliacoes(req.avaliacoes());
        if (req.disponivel() != null) o.setDisponivel(req.disponivel());
        if (req.ativo() != null) o.setAtivo(req.ativo());
        if (req.atualizacaoAuto() != null) o.setAtualizacaoAuto(req.atualizacaoAuto());
        String cod = vazioParaNulo(req.codigoExterno());
        if (cod == null && p.getRede() == RedeAfiliado.MERCADO_LIVRE) {
            cod = br.com.erp.integracao.MercadoLivreClient.codigoDaUrl(urlProduto);
        }
        if (cod != null) o.setCodigoExterno(cod.toUpperCase());
        o.setVerificadoEm(LocalDateTime.now());
    }

    /**
     * Usa o link de afiliado informado. Sem ele, monta o link da Awin quando a loja é da Awin e o
     * publisher está configurado. Nos demais casos o link de afiliado é obrigatório (gerado no painel da rede).
     */
    String montarLink(Parceiro p, String url, String urlProduto) {
        if (url != null) return url;
        if (p.getRede() == RedeAfiliado.AWIN && urlProduto != null && p.getAwinMerchantId() != null
                && awinPublisherId != null && !awinPublisherId.isBlank()) {
            return "https://www.awin1.com/cread.php?awinmid=" + p.getAwinMerchantId()
                    + "&awinaffid=" + awinPublisherId.trim()
                    + "&ued=" + URLEncoder.encode(urlProduto, StandardCharsets.UTF_8);
        }
        if (p.getRede() == RedeAfiliado.AWIN) {
            throw new NegocioException("Informe o link de afiliado, ou cadastre o ID do anunciante Awin na loja e o AWIN_PUBLISHER_ID no servidor");
        }
        throw new NegocioException("Informe o link de afiliado (gerado no painel de afiliados: " + p.getNome() + ")");
    }

    private static void validarUrl(String url, String campo) {
        try {
            URI u = URI.create(url);
            String s = u.getScheme();
            if (s == null || !(s.equalsIgnoreCase("https") || s.equalsIgnoreCase("http")) || u.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new NegocioException(campo + " inválido: use um endereço completo começando com https://");
        }
    }

    private Oferta oferta(Long id) {
        return ofertas.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Oferta", id));
    }

    // ---------------- clique ("Ver na loja") ----------------

    /** Conta o clique e devolve o link de afiliado. Só redireciona para links já cadastrados (não é um redirecionador aberto). */
    @Transactional
    public Optional<String> registrarClique(Long ofertaId) {
        return ofertas.findById(ofertaId).filter(Oferta::isAtivo).map(o -> {
            cliques.save(new Clique(o));
            ofertas.somarClique(o.getId());
            return o.getUrl();
        });
    }

    // ---------------- histórico ----------------

    @Transactional(readOnly = true)
    public HistoricoResponse historico(Long produtoId, int dias) {
        LocalDateTime desde = LocalDate.now().minusDays(dias - 1L).atStartOfDay();
        List<Oferta> atuais = ofertas.doProduto(produtoId).stream().filter(Oferta::isAtivo).toList();
        // Preço de cada oferta em cada dia = último registro até aquele dia (o preço "vale" até mudar).
        Map<Long, NavigableMap<LocalDate, BigDecimal>> porOferta = new HashMap<>();
        for (HistoricoPreco h : historico.doProdutoDesde(produtoId, desde.minusDays(400))) {
            porOferta.computeIfAbsent(h.getOferta().getId(), k -> new TreeMap<>())
                    .put(h.getRegistradoEm().toLocalDate(), h.getPreco());
        }
        Set<Long> ativas = new HashSet<>();
        atuais.forEach(o -> ativas.add(o.getId()));
        List<PontoPreco> pontos = new ArrayList<>();
        for (LocalDate d = desde.toLocalDate(); !d.isAfter(LocalDate.now()); d = d.plusDays(1)) {
            BigDecimal menorDia = null;
            for (var e : porOferta.entrySet()) {
                if (!ativas.contains(e.getKey())) continue;
                var vig = e.getValue().floorEntry(d);
                if (vig == null) continue;
                if (menorDia == null || vig.getValue().compareTo(menorDia) < 0) menorDia = vig.getValue();
            }
            if (menorDia != null) pontos.add(new PontoPreco(d, menorDia));
        }
        BigDecimal atual = atuais.stream().filter(Oferta::isDisponivel).map(Oferta::getPreco)
                .min(Comparator.naturalOrder()).orElse(null);
        BigDecimal menor = pontos.stream().map(PontoPreco::preco).min(Comparator.naturalOrder()).orElse(null);
        BigDecimal maior = pontos.stream().map(PontoPreco::preco).max(Comparator.naturalOrder()).orElse(null);
        // Só vale como "menor preço do período" com histórico de pelo menos 7 dias e alguma variação.
        boolean menorDoPeriodo = atual != null && menor != null && pontos.size() >= 7
                && maior.compareTo(menor) > 0 && atual.compareTo(menor) <= 0;
        return new HistoricoResponse(pontos, menor, maior, atual, menorDoPeriodo, dias);
    }

    // ---------------- relatório ----------------

    @Transactional(readOnly = true)
    public RelatorioCliques relatorio(int dias) {
        LocalDateTime desde = LocalDate.now().minusDays(dias - 1L).atStartOfDay();
        Map<Long, Parceiro> ps = new HashMap<>();
        parceiros.findAll().forEach(p -> ps.put(p.getId(), p));
        List<CliquesParceiro> porParceiro = cliques.porParceiro(desde).stream().map(r -> {
            Parceiro p = ps.get((Long) r[0]);
            return new CliquesParceiro((Long) r[0], p == null ? "—" : p.getNome(), p == null ? null : p.getCor(), (Long) r[1]);
        }).sorted(Comparator.comparingLong(CliquesParceiro::cliques).reversed()).toList();
        // Produtos da vitrine (com categoria numa consulta só), cliques e pedidos de aviso por produto.
        Map<Long, Produto> vitrine = new LinkedHashMap<>();
        produtos.daVitrine().forEach(p -> vitrine.put(p.getId(), p));
        Map<Long, Long> cliquesProd = new HashMap<>();
        List<Object[]> porProd = cliques.porProduto(desde);
        porProd.forEach(r -> cliquesProd.put((Long) r[0], (Long) r[1]));
        Map<Long, Long> avisos = new HashMap<>();
        alertas.ativosPorProduto().forEach(r -> avisos.put((Long) r[0], (Long) r[1]));
        Set<Long> comOferta = new HashSet<>();
        ofertas.daVitrine().forEach(o -> comOferta.add(o.getProduto().getId()));
        java.util.function.Function<Long, String> categoriaDe = id -> {
            Produto p = vitrine.get(id);
            return p == null || p.getCategoria() == null ? "Sem categoria" : p.getCategoria().getNome();
        };

        List<Object[]> topRaw = porProd.stream().limit(10).toList();
        Map<Long, String> nomes = new HashMap<>();
        produtos.findAllById(topRaw.stream().map(r -> (Long) r[0]).toList()).forEach(p -> nomes.put(p.getId(), p.getDescricao()));
        List<CliquesProduto> top = topRaw.stream()
                .map(r -> new CliquesProduto((Long) r[0], nomes.getOrDefault((Long) r[0], "—"), categoriaDe.apply((Long) r[0]),
                        (Long) r[1], avisos.getOrDefault((Long) r[0], 0L))).toList();

        Map<String, long[]> cat = new TreeMap<>();
        vitrine.keySet().forEach(id -> cat.computeIfAbsent(categoriaDe.apply(id), k -> new long[2])[1]++);
        cliquesProd.forEach((id, n) -> cat.computeIfAbsent(categoriaDe.apply(id), k -> new long[2])[0] += n);
        List<CliquesCategoria> porCategoria = cat.entrySet().stream()
                .filter(e -> e.getValue()[0] > 0 || e.getValue()[1] > 0)
                .map(e -> new CliquesCategoria(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .sorted(Comparator.comparingLong(CliquesCategoria::cliques).reversed().thenComparing(CliquesCategoria::nome)).toList();

        List<ProdutoParado> parados = vitrine.values().stream()
                .filter(p -> comOferta.contains(p.getId()) && !cliquesProd.containsKey(p.getId()))
                .sorted(Comparator.comparing(Produto::getCriadoEm))
                .map(p -> new ProdutoParado(p.getId(), p.getDescricao(), categoriaDe.apply(p.getId()), p.getPrecoVenda(),
                        avisos.getOrDefault(p.getId(), 0L)))
                .toList();
        long avisosAtivos = avisos.values().stream().mapToLong(Long::longValue).sum();
        Map<LocalDate, Long> porDiaMap = new HashMap<>();
        for (Object[] r : cliques.porDia(desde)) {
            LocalDate d = r[0] instanceof Date sd ? sd.toLocalDate() : LocalDate.parse(r[0].toString());
            porDiaMap.put(d, ((Number) r[1]).longValue());
        }
        List<CliquesDia> porDia = new ArrayList<>();
        for (LocalDate d = desde.toLocalDate(); !d.isAfter(LocalDate.now()); d = d.plusDays(1)) {
            porDia.add(new CliquesDia(d, porDiaMap.getOrDefault(d, 0L)));
        }
        long total = porDia.stream().mapToLong(CliquesDia::cliques).sum();
        return new RelatorioCliques(dias, total, porDia, porParceiro, top, porCategoria, parados, avisosAtivos);
    }

    private static String vazioParaNulo(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
