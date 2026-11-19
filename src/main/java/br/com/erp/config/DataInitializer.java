package br.com.erp.config;

import br.com.erp.afiliado.Parceiro;
import br.com.erp.afiliado.ParceiroRepository;
import br.com.erp.afiliado.RedeAfiliado;
import br.com.erp.cliente.ClienteDtos.ClienteRequest;
import br.com.erp.cliente.ClienteRepository;
import br.com.erp.cliente.ClienteService;
import br.com.erp.common.Endereco;
import br.com.erp.common.EnderecoDto;
import br.com.erp.common.TipoPessoa;
import br.com.erp.empresa.Empresa;
import br.com.erp.empresa.EmpresaRepository;
import br.com.erp.fornecedor.FornecedorDtos.FornecedorRequest;
import br.com.erp.fornecedor.FornecedorService;
import br.com.erp.produto.ProdutoDtos.CategoriaRequest;
import br.com.erp.produto.ProdutoDtos.CategoriaResponse;
import br.com.erp.produto.ProdutoDtos.ProdutoRequest;
import br.com.erp.produto.ProdutoRepository;
import br.com.erp.produto.ProdutoService;
import br.com.erp.usuario.Role;
import br.com.erp.usuario.Usuario;
import br.com.erp.usuario.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/** Cria o usuário administrador, a empresa padrão e (opcionalmente) dados de demonstração. */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final EmpresaRepository empresaRepository;
    private final ProdutoRepository produtoRepository;
    private final ClienteRepository clienteRepository;
    private final ProdutoService produtoService;
    private final ClienteService clienteService;
    private final FornecedorService fornecedorService;
    private final PasswordEncoder passwordEncoder;
    private final ParceiroRepository parceiroRepository;

    @Value("${app.admin.email}")
    private String adminEmail;
    @Value("${app.admin.senha}")
    private String adminSenha;
    @Value("${app.seed-demo:true}")
    private boolean seedDemo;

    @Override
    @Transactional
    public void run(String... args) {
        if (usuarioRepository.count() == 0) {
            Usuario admin = new Usuario();
            admin.setNome("Administrador");
            admin.setEmail(adminEmail.toLowerCase());
            admin.setSenha(passwordEncoder.encode(adminSenha));
            admin.setRole(Role.ADMIN);
            usuarioRepository.save(admin);
            log.info("Usuário administrador criado: {}", adminEmail);
        }

        if (empresaRepository.count() == 0) {
            Empresa e = new Empresa();
            e.setRazaoSocial("EMPRESA DEMONSTRACAO LTDA");
            e.setNomeFantasia("Loja Demo");
            e.setCnpj("11222333000181");
            e.setInscricaoEstadual("111111111111");
            e.setCrt(1);
            e.setTelefone("11999999999");
            e.setEmail("contato@lojademo.com.br");
            e.setEndereco(new Endereco("Avenida Paulista", "1000", null, "Bela Vista", "Sao Paulo",
                    "3550308", "SP", "01310100"));
            e.setCodigoUf(35);
            e.setSerieNfe(1);
            e.setProximoNumeroNfe(1);
            e.setAmbienteNfe(2);
            empresaRepository.save(e);
            log.info("Empresa de demonstração criada; ajuste os dados em PUT /api/empresa");
        }

        if (parceiroRepository.count() == 0) {
            parceiro("Mercado Livre", RedeAfiliado.MERCADO_LIVRE, "#FFE600", "https://www.mercadolivre.com.br");
            parceiro("AliExpress", RedeAfiliado.ALIEXPRESS, "#E62E04", "https://pt.aliexpress.com");
            parceiro("Shopee", RedeAfiliado.SHOPEE, "#EE4D2D", "https://shopee.com.br");
            parceiro("KaBuM!", RedeAfiliado.AWIN, "#0060B1", "https://www.kabum.com.br");
            log.info("Lojas parceiras criadas: Mercado Livre, AliExpress, Shopee e KaBuM! (Awin)");
        }
        if (seedDemo && produtoRepository.count() == 0 && clienteRepository.count() == 0) {
            criarDadosDemo();
        }
    }

    private void parceiro(String nome, RedeAfiliado rede, String cor, String site) {
        Parceiro p = new Parceiro();
        p.setNome(nome);
        p.setRede(rede);
        p.setCor(cor);
        p.setSite(site);
        parceiroRepository.save(p);
    }

    private void criarDadosDemo() {
        CategoriaResponse informatica = produtoService.criarCategoria(new CategoriaRequest("Informática", "Periféricos e acessórios", true));
        CategoriaResponse papelaria = produtoService.criarCategoria(new CategoriaRequest("Papelaria", "Material de escritório", true));

        produto("MOU-001", "Mouse óptico USB", "7891234567895", informatica.id(), "84716053",
                new BigDecimal("18.50"), new BigDecimal("39.90"), new BigDecimal("50"), new BigDecimal("10"));
        produto("TEC-001", "Teclado ABNT2 USB", null, informatica.id(), "84716052",
                new BigDecimal("45.00"), new BigDecimal("89.90"), new BigDecimal("30"), new BigDecimal("5"));
        produto("CAB-HDMI", "Cabo HDMI 2m", null, informatica.id(), "85444200",
                new BigDecimal("9.80"), new BigDecimal("24.90"), new BigDecimal("100"), new BigDecimal("20"));
        produto("CAD-200", "Caderno universitário 200 folhas", null, papelaria.id(), "48202000",
                new BigDecimal("12.00"), new BigDecimal("27.50"), new BigDecimal("8"), new BigDecimal("10"));

        EnderecoDto endSp = new EnderecoDto("Rua Augusta", "500", null, "Consolação", "Sao Paulo", "3550308", "SP", "01304000");
        clienteService.criar(new ClienteRequest(TipoPessoa.FISICA, "Maria da Silva", "52998224725", null,
                "maria@email.com", "11988887777", endSp, new BigDecimal("2000"), true));
        clienteService.criar(new ClienteRequest(TipoPessoa.JURIDICA, "Comercial Exemplo LTDA", "11444777000161",
                "123456789012", "compras@exemplo.com.br", "1133334444", endSp, BigDecimal.ZERO, true));
        fornecedorService.criar(new FornecedorRequest(TipoPessoa.JURIDICA, "Distribuidora Tech SA", "Tech Dist",
                "45723174000110", null, "vendas@techdist.com.br", "1144445555", "João", endSp, true));
        log.info("Dados de demonstração criados (4 produtos, 2 clientes, 1 fornecedor)");
    }

    private void produto(String codigo, String descricao, String ean, Long categoriaId, String ncm,
                         BigDecimal custo, BigDecimal venda, BigDecimal estoqueInicial, BigDecimal estoqueMinimo) {
        produtoService.criar(new ProdutoRequest(codigo, descricao, ean, categoriaId, "UN", custo, venda,
                estoqueMinimo, estoqueInicial, true, ncm, null, "5102", 0, "102",
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, null));
    }
}
