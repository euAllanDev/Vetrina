import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './icons';
import { Button } from './ui';
import { useAuth } from '../lib/auth';
import { href, navigate } from '../lib/router';
import { api } from '../lib/api';
import { useDebounced, useHotkey } from '../lib/hooks';
import { initials, money, ROLE_LABEL } from '../lib/format';
import type { Cliente, Page, Produto, Role } from '../lib/types';

export interface NavItem { path: string; label: string; icon: IconName; roles: Role[] }
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Operação', items: [
    { path: '/', label: 'Visão geral', icon: 'dashboard', roles: ['GERENTE'] },
    { path: '/pdv', label: 'Ponto de venda', icon: 'pdv', roles: ['GERENTE', 'VENDEDOR'] },
    { path: '/vendas', label: 'Vendas', icon: 'receipt', roles: ['GERENTE', 'VENDEDOR'] },
    { path: '/notas', label: 'Notas fiscais', icon: 'file', roles: ['GERENTE', 'VENDEDOR', 'FINANCEIRO'] },
  ] },
  { group: 'Estoque', items: [
    { path: '/produtos', label: 'Produtos', icon: 'package', roles: ['GERENTE', 'VENDEDOR', 'ESTOQUISTA', 'FINANCEIRO'] },
    { path: '/afiliados', label: 'Afiliados', icon: 'link', roles: ['GERENTE'] },
    { path: '/estoque', label: 'Movimentações', icon: 'boxes', roles: ['GERENTE', 'ESTOQUISTA'] },
    { path: '/compras', label: 'Compras', icon: 'truck', roles: ['GERENTE', 'ESTOQUISTA'] },
  ] },
  { group: 'Cadastros', items: [
    { path: '/clientes', label: 'Clientes', icon: 'users', roles: ['GERENTE', 'VENDEDOR', 'ESTOQUISTA', 'FINANCEIRO'] },
    { path: '/fornecedores', label: 'Fornecedores', icon: 'factory', roles: ['GERENTE', 'ESTOQUISTA', 'FINANCEIRO'] },
  ] },
  { group: 'Gestão', items: [
    { path: '/financeiro', label: 'Financeiro', icon: 'wallet', roles: ['GERENTE', 'FINANCEIRO'] },
    { path: '/relatorios', label: 'Relatórios', icon: 'chart', roles: ['GERENTE'] },
  ] },
  { group: 'Configurações', items: [
    { path: '/empresa', label: 'Empresa e NF-e', icon: 'building', roles: [] },
    { path: '/usuarios', label: 'Usuários', icon: 'shield', roles: [] },
  ] },
];

export function useNav() {
  const { pode } = useAuth();
  return useMemo(() => NAV.map((g) => ({ ...g, items: g.items.filter((i) => pode(...i.roles)) })).filter((g) => g.items.length), [pode]);
}

function useTheme(): [string, () => void] {
  const [tema, setTema] = useState(() => document.documentElement.dataset.theme || 'light');
  const toggle = () => {
    const next = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0e0e0e' : '#f7f7f5');
    try { localStorage.setItem('erp.tema', next); } catch { /* ignore */ }
    setTema(next);
  };
  return [tema, toggle];
}

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { usuario, empresa, sair } = useAuth();
  const nav = useNav();
  const [tema, toggleTema] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [palette, setPalette] = useState(false);

  useHotkey((e) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k', (e) => { e.preventDefault(); setPalette(true); });
  useEffect(() => { setMenuOpen(false); }, [path]);

  const active = (p: string) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`));

  return (
    <div className="shell">
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Navegação principal">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">{empresa?.nomeFantasia || 'ERP'}</div>
            <div className="brand-sub">{empresa?.razaoSocial ?? 'Gestão'}</div>
          </div>
        </div>
        <nav>
          {nav.map((g) => (
            <div key={g.group} className="nav-group">
              <div className="nav-label">{g.group}</div>
              {g.items.map((i) => (
                <a key={i.path} className="nav-item" href={href(i.path)} aria-current={active(i.path) ? 'page' : undefined}>
                  <Icon name={i.icon} size={17} />{i.label}
                  {i.path === '/pdv' && <span className="kbd">F2</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a className="nav-item" href="/loja" target="_blank" rel="noopener"><Icon name="store" size={17} />Ver a loja<Icon name="up" size={14} className="muted" style={{ marginLeft: 'auto' }} /></a>
          {empresa && (
            <div className="row" style={{ padding: '4px 10px', fontSize: 12 }}>
              <span className={`badge ${empresa.ambienteNfe === 1 ? 'badge-success' : 'badge-warning'}`}>
                NF-e {empresa.ambienteNfe === 1 ? 'produção' : 'homologação'}
              </span>
            </div>
          )}
        </div>
      </aside>
      {menuOpen && <div className="overlay" style={{ zIndex: 54 }} onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <Button variant="ghost" className="menu-btn" icon="menu" aria-label="Abrir menu" onClick={() => setMenuOpen(true)} />
          <button className="search-trigger" onClick={() => setPalette(true)} aria-label="Buscar (Ctrl+K)">
            <Icon name="search" size={16} />
            <span className="search-label">Buscar produto, cliente ou tela</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <div style={{ marginLeft: 'auto' }} className="row">
            <Button variant="ghost" icon={tema === 'dark' ? 'sun' : 'moon'} aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={toggleTema} />
            <div style={{ position: 'relative' }}>
              <button className="btn btn-ghost" style={{ paddingLeft: 4 }} aria-haspopup="menu" aria-expanded={userMenu} onClick={() => setUserMenu((v) => !v)}>
                <span className="avatar">{initials(usuario?.nome ?? '?')}</span>
                <span className="user-label" style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <span style={{ display: 'block', fontSize: 13 }}>{usuario?.nome}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{ROLE_LABEL[usuario?.role ?? '']}</span>
                </span>
                <Icon name="chevronDown" size={15} />
              </button>
              {userMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setUserMenu(false)} />
                  <div className="menu" role="menu">
                    <div style={{ padding: '6px 10px 8px' }}>
                      <div style={{ fontWeight: 500 }}>{usuario?.nome}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{usuario?.email}</div>
                    </div>
                    <div className="menu-sep" />
                    <button className="menu-item" role="menuitem" onClick={() => { setUserMenu(false); navigate('/conta'); }}>
                      <Icon name="user" size={16} />Minha conta
                    </button>
                    <button className="menu-item" role="menuitem" onClick={() => { setUserMenu(false); sair(); navigate('/'); }}>
                      <Icon name="logout" size={16} />Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main id="conteudo" className="content" tabIndex={-1}>{children}</main>
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

/* ---------- Ctrl+K ---------- */
interface Cmd { id: string; group: string; label: string; icon: IconName; hint?: string; run: () => void }

function CommandPalette({ onClose }: { onClose: () => void }) {
  const nav = useNav();
  const { pode } = useAuth();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [prods, setProds] = useState<Produto[]>([]);
  const [clis, setClis] = useState<Cliente[]>([]);
  const dq = useDebounced(q, 200);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dq.trim().length < 2) { setProds([]); setClis([]); return; }
    let vivo = true;
    api.get<Page<Produto>>('/produtos', { termo: dq, size: 5 }).then((p) => vivo && setProds(p.content)).catch(() => {});
    api.get<Page<Cliente>>('/clientes', { termo: dq, size: 4 }).then((p) => vivo && setClis(p.content)).catch(() => {});
    return () => { vivo = false; };
  }, [dq]);

  const go = (p: string) => () => { navigate(p); onClose(); };
  const cmds: Cmd[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const acoes: Cmd[] = [];
    if (pode('GERENTE', 'VENDEDOR')) acoes.push({ id: 'a-pdv', group: 'Ações', label: 'Nova venda no balcão', icon: 'pdv', hint: 'F2', run: go('/pdv') });
    if (pode('GERENTE', 'ESTOQUISTA')) acoes.push({ id: 'a-prod', group: 'Ações', label: 'Cadastrar produto', icon: 'plus', run: go('/produtos?novo=1') });
    if (pode('GERENTE', 'VENDEDOR')) acoes.push({ id: 'a-cli', group: 'Ações', label: 'Cadastrar cliente', icon: 'plus', run: go('/clientes?novo=1') });
    if (pode('GERENTE', 'ESTOQUISTA')) acoes.push({ id: 'a-comp', group: 'Ações', label: 'Novo pedido de compra', icon: 'truck', run: go('/compras?novo=1') });
    const telas: Cmd[] = nav.flatMap((g) => g.items.map((i) => ({ id: `n-${i.path}`, group: 'Ir para', label: i.label, icon: i.icon, run: go(i.path) })));
    const match = (c: Cmd) => !term || c.label.toLowerCase().includes(term);
    const p: Cmd[] = prods.map((x) => ({ id: `p-${x.id}`, group: 'Produtos', label: `${x.descricao}`, icon: 'package', hint: `${x.codigo} · ${money(x.precoVenda)}`, run: go(`/produtos?id=${x.id}`) }));
    const c: Cmd[] = clis.map((x) => ({ id: `c-${x.id}`, group: 'Clientes', label: x.nome, icon: 'user', hint: x.email ?? '', run: go(`/clientes?id=${x.id}`) }));
    return [...acoes.filter(match), ...telas.filter(match), ...p, ...c];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, prods, clis, nav]);

  useEffect(() => { setSel(0); }, [q, prods.length, clis.length]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const onKey = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(cmds.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); cmds[sel]?.run(); }
    if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';
  return createPortal(
    <>
      <div className="overlay" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Busca e comandos">
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Buscar produto, cliente ou tela…" aria-label="Buscar" role="combobox" aria-expanded="true" aria-controls="palette-list" />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {cmds.length === 0 && <div className="empty" style={{ padding: 28 }}><p className="empty-text">Nada encontrado para “{q}”.</p></div>}
          {cmds.map((c, i) => {
            const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
            return (
              <div key={c.id}>
                {head && <div className="palette-group">{head}</div>}
                <button className="palette-item" role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={c.run}>
                  <Icon name={c.icon} size={16} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                  {c.hint && <span className="hint">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );
}
