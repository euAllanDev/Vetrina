import { useEffect, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { navigate, useRoute } from './lib/router';
import { useHotkey } from './lib/hooks';
import { ToastProvider } from './components/overlay';
import { Shell, useNav } from './components/Shell';
import { Empty } from './components/ui';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Pdv } from './pages/Pdv';
import { Vendas } from './pages/Vendas';
import { Produtos } from './pages/Produtos';
import { Estoque } from './pages/Estoque';
import { Compras } from './pages/Compras';
import { Clientes } from './pages/Clientes';
import { Fornecedores } from './pages/Fornecedores';
import { Notas } from './pages/Notas';
import { Financeiro } from './pages/Financeiro';
import { Relatorios } from './pages/Relatorios';
import { EmpresaPage } from './pages/Empresa';
import { Usuarios } from './pages/Usuarios';
import { Conta } from './pages/Conta';
import { Store } from './store/Store';

const PAGES: Record<string, () => ReactNode> = {
  '/': () => <Dashboard />,
  '/pdv': () => <Pdv />,
  '/vendas': () => <Vendas />,
  '/produtos': () => <Produtos />,
  '/estoque': () => <Estoque />,
  '/compras': () => <Compras />,
  '/clientes': () => <Clientes />,
  '/fornecedores': () => <Fornecedores />,
  '/notas': () => <Notas />,
  '/financeiro': () => <Financeiro />,
  '/relatorios': () => <Relatorios />,
  '/empresa': () => <EmpresaPage />,
  '/usuarios': () => <Usuarios />,
  '/conta': () => <Conta />,
};

function Routes() {
  const { usuario, carregando } = useAuth();
  const { path } = useRoute();
  const nav = useNav();
  const permitidas = nav.flatMap((g) => g.items.map((i) => i.path));

  useHotkey((e) => e.key === 'F2', (e) => { if (permitidas.includes('/pdv')) { e.preventDefault(); navigate('/pdv'); } });

  // Quem não vê o dashboard cai na primeira tela permitida.
  useEffect(() => {
    if (usuario && path === '/' && !permitidas.includes('/') && permitidas[0]) navigate(permitidas[0]);
  }, [usuario, path, permitidas]);

  useEffect(() => {
    const titulo = nav.flatMap((g) => g.items).find((i) => i.path === path)?.label;
    document.title = titulo ? `${titulo} — ERP` : 'ERP';
  }, [path, nav]);

  if (carregando) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><span className="spinner" style={{ width: 22, height: 22 }} /></div>;
  if (!usuario) return <Login />;

  const page = PAGES[path];
  const allowed = path === '/conta' || permitidas.includes(path);
  return (
    <Shell path={path}>
      {page && allowed ? page() : (
        <Empty icon={page ? 'shield' : 'search'} title={page ? 'Sem acesso a esta tela' : 'Página não encontrada'}
          text={page ? 'Seu perfil não tem permissão. Fale com o administrador.' : 'O endereço não corresponde a nenhuma tela do sistema.'} />
      )}
    </Shell>
  );
}

export function App() {
  // A loja é pública e independente do painel administrativo.
  if (window.location.pathname.replace(/\/+$/, '') === '/loja') return <Store />;
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes />
      </ToastProvider>
    </AuthProvider>
  );
}
