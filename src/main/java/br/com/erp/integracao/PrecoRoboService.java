package br.com.erp.integracao;

import br.com.erp.afiliado.*;
import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.produto.Categoria;
import br.com.erp.produto.CategoriaRepository;
import br.com.erp.produto.Produto;
import br.com.erp.produto.ProdutoImagemService;
import br.com.erp.produto.ProdutoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Robô de preços: confere as ofertas do Mercado Livre na API oficial e atualiza preço, "de/por",
 * frete e disponibilidade; quedas de preço viram o selo "Baixou" na vitrine.
 * Também importa um produto novo a partir do link.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PrecoRoboService {

    private final MercadoLivreClient ml;
    private final OfertaRepository ofertas;
    private final ParceiroRepository parceiros;
    private final HistoricoPrecoRepository historico;
    private final ProdutoRepository produtos;
    private final CategoriaRepository categorias;
    private final ProdutoImagemService imagens;
    private final IntegracaoContaRepository contas;
    private final TransactionTemplate tx;
    private final AtomicBoolean rodando = new AtomicBoolean(false);

    public record Resumo(int conferidas, int alteradas, int baixaram, int indisponiveis, int erros, String quando) {
        String texto() {
            return conferidas + " conferidas, " + alteradas + " com preço novo, " + baixaram + " baixaram, "
                    + indisponiveis + " indisponíveis, " + erros + " com erro";
        }
    }

    public record ImportarRequest(String urlProduto, String url, Long categoriaId, String nome) {
    }

    public record ImportarResponse(Long produtoId, Long ofertaId, String nome, BigDecimal preco, BigDecimal precoAnterior,
                                   boolean foto) {
    }

    /** Execução automática a cada 6 h (quando o servidor está acordado). */
    @Scheduled(cron = "${app.integracoes.cron:0 7 */6 * * *}", zone = "America/Sao_Paulo")
    public void agendado() {
        if (ml.configurado() && ml.conta().isPresent()) {
            try {
                sincronizar();
            } catch (Exception e) {
                log.warn("Robô de preços falhou: {}", e.getMessage());
            }
        }
    }

    /** Confere todas as ofertas do Mercado Livre com atualização automática ligada. */
    public Resumo sincronizar() {
        if (!rodando.compareAndSet(false, true)) {
            throw new NegocioException("O robô de preços já está rodando. Tente de novo em alguns minutos.");
        }
        try {
            ml.accessToken(); // falha cedo se a conta não estiver conectada
            List<Long> ids = tx.execute(s -> ofertas.findAll().stream()
                    .filter(o -> o.getParceiro().getRede() == RedeAfiliado.MERCADO_LIVRE && o.isAtivo() && o.isAtualizacaoAuto())
                    .map(Oferta::getId).toList());
            int conferidas = 0, alteradas = 0, baixaram = 0, indisp = 0, erros = 0;
            for (Long id : ids) {
                try {
                    int r = tx.execute(s -> atualizar(id));
                    conferidas++;
                    if ((r & 1) != 0) alteradas++;
                    if ((r & 2) != 0) baixaram++;
                    if ((r & 4) != 0) indisp++;
                } catch (Exception e) {
                    erros++;
                    String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                    tx.executeWithoutResult(s -> ofertas.findById(id).ifPresent(o -> {
                        o.setErroSincronizacao(msg.length() > 250 ? msg.substring(0, 250) : msg);
                        o.setSincronizadoEm(LocalDateTime.now());
                    }));
                }
                pausa();
            }
            Resumo resumo = new Resumo(conferidas, alteradas, baixaram, indisp, erros, LocalDateTime.now().toString());
            tx.executeWithoutResult(s -> contas.findById(MercadoLivreClient.PROVEDOR).ifPresent(c -> {
                c.setUltimaSincronizacao(LocalDateTime.now());
                c.setUltimoResumo(resumo.texto());
            }));
            log.info("Robô de preços: {}", resumo.texto());
            return resumo;
        } finally {
            rodando.set(false);
        }
    }

    /** Atualiza uma oferta. Retorna bits: 1 = preço mudou, 2 = baixou, 4 = ficou indisponível. */
    private int atualizar(Long ofertaId) {
        Oferta o = ofertas.findById(ofertaId).orElseThrow();
        String codigo = codigoDa(o);
        if (codigo == null) {
            throw new NegocioException("Sem código do Mercado Livre: preencha o endereço do produto na oferta");
        }
        if (o.getCodigoExterno() == null) o.setCodigoExterno(codigo);
        DadosLoja d = ml.consultar(codigo);
        int r = 0;
        LocalDateTime agora = LocalDateTime.now();
        if (d.disponivel() && d.preco() != null) {
            BigDecimal antes = o.getPreco();
            if (antes == null || antes.compareTo(d.preco()) != 0) {
                r |= 1;
                if (antes != null && d.preco().compareTo(antes) < 0) {
                    r |= 2;
                    o.setPrecoBaixouDe(antes);
                    o.setBaixouEm(agora);
                } else {
                    o.setPrecoBaixouDe(null);
                    o.setBaixouEm(null);
                }
                o.setPreco(d.preco());
            }
            o.setPrecoAnterior(d.precoAnterior());
            if (d.freteGratis() != null) {
                if (d.freteGratis()) o.setFrete(BigDecimal.ZERO);
                else if (o.getFrete() != null && o.getFrete().signum() == 0) o.setFrete(null);
            }
            if (!o.isDisponivel()) o.setDisponivel(true);
            // Desconto do Pix e parcelamento não vêm da API: o texto antigo poderia ficar errado.
            if ((r & 1) != 0 && o.getParcelamento() != null && o.getParcelamento().contains("R$")) o.setParcelamento(null);
        } else {
            if (o.isDisponivel()) r |= 4;
            o.setDisponivel(false);
        }
        historico.save(new HistoricoPreco(o, o.getPreco()));
        o.setVerificadoEm(agora);
        o.setSincronizadoEm(agora);
        o.setErroSincronizacao(null);
        return r;
    }

    private static String codigoDa(Oferta o) {
        if (o.getCodigoExterno() != null) return o.getCodigoExterno();
        String c = MercadoLivreClient.codigoDaUrl(o.getUrlProduto());
        if (c != null) return c;
        String cod = o.getProduto().getCodigo();
        return cod != null && cod.toUpperCase().startsWith("ML-MLB") ? cod.substring(3).toUpperCase() : null;
    }

    private static void pausa() {
        try {
            Thread.sleep(350);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // ---------------- importar ----------------

    public ImportarResponse importar(ImportarRequest req) {
        String urlProduto = req.urlProduto() == null ? null : req.urlProduto().trim();
        String codigo = MercadoLivreClient.codigoDaUrl(urlProduto);
        if (codigo == null) {
            throw new NegocioException("Não reconheci o produto nesse endereço. Use o link da página do produto no Mercado Livre "
                    + "(o endereço que aparece no navegador, com MLB no meio).");
        }
        String url = req.url() == null ? "" : req.url().trim();
        validarLink(url);
        DadosLoja d = ml.consultar(codigo);
        if (d.preco() == null) throw new NegocioException("O Mercado Livre não informou preço para este produto agora");

        ImportarResponse resp = tx.execute(s -> {
            Parceiro mlp = parceiros.findAll().stream().filter(p -> p.getRede() == RedeAfiliado.MERCADO_LIVRE).findFirst()
                    .orElseThrow(() -> new NegocioException("Cadastre a loja parceira Mercado Livre em Afiliados"));
            String cod = "ML-" + codigo.replace("P:", "");
            Produto p = produtos.findFirstByCodigoIgnoreCase(cod).orElse(null);
            if (p == null) {
                p = new Produto();
                p.setCodigo(cod);
                String nome = req.nome() != null && !req.nome().isBlank() ? req.nome().trim() : d.titulo();
                p.setDescricao(nome == null ? cod : (nome.length() > 120 ? nome.substring(0, 117) + "..." : nome));
                p.setUnidade("UN");
                p.setPrecoCusto(BigDecimal.ZERO);
                p.setPrecoVenda(d.preco());
                if (req.categoriaId() != null) {
                    Categoria c = categorias.findById(req.categoriaId())
                            .orElseThrow(() -> new RecursoNaoEncontradoException("Categoria", req.categoriaId()));
                    p.setCategoria(c);
                }
                p = produtos.save(p);
            }
            final Produto prod = p;
            Oferta o = ofertas.doProduto(prod.getId()).stream()
                    .filter(x -> x.getParceiro().getId().equals(mlp.getId())).findFirst().orElseGet(Oferta::new);
            boolean nova = o.getId() == null;
            o.setProduto(prod);
            o.setParceiro(mlp);
            o.setUrl(url);
            o.setUrlProduto(urlProduto.split("[?#]")[0]);
            o.setCodigoExterno(codigo);
            o.setPreco(d.preco());
            o.setPrecoAnterior(d.precoAnterior());
            o.setFrete(Boolean.TRUE.equals(d.freteGratis()) ? BigDecimal.ZERO : null);
            o.setDisponivel(d.disponivel());
            o.setAtivo(true);
            o.setAtualizacaoAuto(true);
            o.setVerificadoEm(LocalDateTime.now());
            o.setSincronizadoEm(LocalDateTime.now());
            o = ofertas.save(o);
            if (nova) historico.save(new HistoricoPreco(o, o.getPreco()));
            return new ImportarResponse(prod.getId(), o.getId(), prod.getDescricao(), d.preco(), d.precoAnterior(),
                    prod.getImagemAtualizadaEm() != null);
        });

        boolean foto = resp.foto();
        if (!foto) {
            byte[] img = ml.baixarImagem(d.imagemUrl());
            if (img != null) {
                try {
                    imagens.salvarBytes(resp.produtoId(), img);
                    foto = true;
                } catch (Exception e) {
                    log.warn("Imagem do produto {} não foi salva: {}", resp.produtoId(), e.getMessage());
                }
            }
        }
        return new ImportarResponse(resp.produtoId(), resp.ofertaId(), resp.nome(), resp.preco(), resp.precoAnterior(), foto);
    }

    private static void validarLink(String url) {
        try {
            URI u = URI.create(url);
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new NegocioException("Cole o seu link de afiliado (ex.: https://meli.la/...)");
        }
    }
}
