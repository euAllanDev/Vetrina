package br.com.erp.produto;

import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.produto.ProdutoDtos.ProdutoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProdutoImagemService {

    private static final long TAMANHO_MAXIMO = 3 * 1024 * 1024;
    private static final Set<String> TIPOS = Set.of("image/jpeg", "image/png", "image/webp");

    private final ProdutoImagemRepository imagemRepository;
    private final ProdutoRepository produtoRepository;

    @Transactional
    public ProdutoResponse salvar(Long produtoId, MultipartFile arquivo) {
        Produto produto = produtoRepository.findById(produtoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Produto", produtoId));
        if (arquivo == null || arquivo.isEmpty()) {
            throw new NegocioException("Envie um arquivo de imagem");
        }
        if (arquivo.getSize() > TAMANHO_MAXIMO) {
            throw new NegocioException("A imagem deve ter no máximo 3 MB");
        }
        byte[] dados;
        try {
            dados = arquivo.getBytes();
        } catch (IOException e) {
            throw new NegocioException("Não foi possível ler o arquivo enviado");
        }
        String tipo = detectarTipo(dados);
        if (tipo == null || !TIPOS.contains(tipo)) {
            throw new NegocioException("Formato não suportado. Use JPG, PNG ou WebP.");
        }

        LocalDateTime agora = LocalDateTime.now();
        ProdutoImagem img = imagemRepository.findById(produtoId).orElseGet(() -> {
            ProdutoImagem nova = new ProdutoImagem();
            nova.setProdutoId(produtoId);
            return nova;
        });
        img.setContentType(tipo);
        img.setDados(dados);
        img.setAtualizadoEm(agora);
        imagemRepository.save(img);
        produto.setImagemAtualizadaEm(agora);
        return ProdutoResponse.from(produto);
    }

    @Transactional
    public ProdutoResponse remover(Long produtoId) {
        Produto produto = produtoRepository.findById(produtoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Produto", produtoId));
        imagemRepository.findById(produtoId).ifPresent(imagemRepository::delete);
        produto.setImagemAtualizadaEm(null);
        return ProdutoResponse.from(produto);
    }

    @Transactional(readOnly = true)
    public Optional<ProdutoImagem> buscar(Long produtoId) {
        return imagemRepository.findById(produtoId);
    }

    /** Confere a assinatura do arquivo (não confia na extensão nem no Content-Type do cliente). */
    private static String detectarTipo(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "image/png";
        }
        if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}
