package br.com.erp.usuario;

import br.com.erp.common.NegocioException;
import br.com.erp.common.RecursoNaoEncontradoException;
import br.com.erp.usuario.UsuarioDtos.AlterarSenhaRequest;
import br.com.erp.usuario.UsuarioDtos.UsuarioRequest;
import br.com.erp.usuario.UsuarioDtos.UsuarioResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UsuarioService implements UserDetailsService {

    private final UsuarioRepository repository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String email) {
        return repository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));
    }

    @Transactional(readOnly = true)
    public Page<UsuarioResponse> listar(Pageable pageable) {
        return repository.findAll(pageable).map(UsuarioResponse::from);
    }

    @Transactional(readOnly = true)
    public UsuarioResponse buscar(Long id) {
        return UsuarioResponse.from(obter(id));
    }

    @Transactional
    public UsuarioResponse criar(UsuarioRequest req) {
        if (repository.existsByEmailIgnoreCase(req.email())) {
            throw new NegocioException("Já existe um usuário com o e-mail " + req.email());
        }
        if (req.senha() == null || req.senha().isBlank()) {
            throw new NegocioException("Senha é obrigatória no cadastro");
        }
        Usuario u = new Usuario();
        u.setNome(req.nome());
        u.setEmail(req.email().toLowerCase());
        u.setSenha(passwordEncoder.encode(req.senha()));
        u.setRole(req.role());
        u.setAtivo(req.ativo() == null || req.ativo());
        return UsuarioResponse.from(repository.save(u));
    }

    @Transactional
    public UsuarioResponse atualizar(Long id, UsuarioRequest req) {
        Usuario u = obter(id);
        if (!u.getEmail().equalsIgnoreCase(req.email()) && repository.existsByEmailIgnoreCase(req.email())) {
            throw new NegocioException("Já existe um usuário com o e-mail " + req.email());
        }
        u.setNome(req.nome());
        u.setEmail(req.email().toLowerCase());
        u.setRole(req.role());
        if (req.ativo() != null) {
            u.setAtivo(req.ativo());
        }
        if (req.senha() != null && !req.senha().isBlank()) {
            u.setSenha(passwordEncoder.encode(req.senha()));
        }
        return UsuarioResponse.from(u);
    }

    @Transactional
    public void alterarSenha(String email, AlterarSenhaRequest req) {
        Usuario u = repository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário", email));
        if (!passwordEncoder.matches(req.senhaAtual(), u.getSenha())) {
            throw new NegocioException("Senha atual incorreta");
        }
        u.setSenha(passwordEncoder.encode(req.novaSenha()));
    }

    @Transactional
    public void desativar(Long id) {
        obter(id).setAtivo(false);
    }

    private Usuario obter(Long id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário", id));
    }
}
