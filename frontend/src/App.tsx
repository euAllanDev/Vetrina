import { useEffect, type ReactNode } from 'react';
import { PAINEL } from './lib/painel';
import { LOJA_FISICA } from './lib/modo';
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
import { Afiliados } from './pages/Afiliados';
import { Celular } from './pages/Celular';
import { receberDoCompartilhar } from './lib/compartilhado';
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
  '/afiliados': () => <Afiliados />,
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

  // No modo comparador, telas de loja física (ex.: #/pdv de um favorito antigo) levam à primeira tela do menu.
  const celular = path === '/celular';

  // No celular (tela estreita ou app instalado), o painel abre direto no app do celular.
  useEffect(() => {
    const estreito = window.matchMedia('(max-width: 720px)').matches || window.matchMedia('(display-mode: standalone)').matches;
    if (estreito && !window.location.hash) navigate('/celular');
  }, []);

  useEffect(() => {
    if (usuario && !LOJA_FISICA && !celular && path !== '/' && path !== '/conta' && !permitidas.includes(path) && permitidas[0]) navigate(permitidas[0]);
  }, [usuario, path, permitidas]);

  // Quem não vê o dashboard cai na primeira tela permitida.
  useEffect(() => {
    if (usuario && path === '/' && !permitidas.includes('/') && permitidas[0]) navigate(permitidas[0]);
  }, [usuario, path, permitidas]);
  // (o app do celular tem layout próprio, sem o menu lateral do painel)

  useEffect(() => {
    const titulo = nav.flatMap((g) => g.items).find((i) => i.path === path)?.label;
    document.title = celular ? 'Vetrina · gestão' : titulo ? `${titulo} — Vetrina` : 'Vetrina · painel';
  }, [path, nav, celular]);

  if (carregando) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><span className="spinner" style={{ width: 22, height: 22 }} /></div>;
  if (!usuario) return <Login />;

  if (celular) return <Celular />;

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
  const caminho = window.location.pathname.replace(/\/+$/, '') || '/';
  if (/^\/loja(\/|$)/.test(caminho)) return <Store />;
  // Qualquer outro endereço que não seja o do painel vai para a loja: visitante nunca cai na tela de login.
  if (caminho !== PAINEL && !caminho.startsWith(`${PAINEL}/`)) {
    window.location.replace('/loja');
    return null;
  }
  prepararAppDoPainel();
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes />
      </ToastProvider>
    </AuthProvider>
  );
}

/**
 * O painel vira um app instalável próprio ("Vetrina Gestão"), separado do app da loja:
 * troca o manifesto, liga o service worker e recebe o que vier pelo "Compartilhar" do Android.
 */
let preparado = false;
function prepararAppDoPainel() {
  if (preparado) return;
  preparado = true;
  receberDoCompartilhar();
  const manifesto = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifesto) manifesto.href = '/painel.webmanifest';
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Vetrina ADM');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* sem app instalável, segue normal */ });
}
