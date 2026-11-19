import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { Empresa, Role, Usuario } from './types';

interface AuthState {
  usuario: Usuario | null;
  empresa: Empresa | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  pode: (...roles: Role[]) => boolean;
  recarregarEmpresa: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [carregando, setCarregando] = useState(true);

  const sair = useCallback(() => {
    tokenStore.clear();
    setUsuario(null);
    setEmpresa(null);
  }, []);

  const recarregarEmpresa = useCallback(() => {
    api.get<Empresa>('/empresa').then(setEmpresa).catch(() => setEmpresa(null));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setUsuario(null); setEmpresa(null); });
    if (!tokenStore.get()) { setCarregando(false); return; }
    api.get<Usuario>('/auth/me')
      .then((u) => { setUsuario(u); recarregarEmpresa(); })
      .catch(() => tokenStore.clear())
      .finally(() => setCarregando(false));
  }, [recarregarEmpresa]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await api.post<{ accessToken: string; usuario: Usuario }>('/auth/login', { email, senha });
    tokenStore.set(r.accessToken);
    setUsuario(r.usuario);
    recarregarEmpresa();
  }, [recarregarEmpresa]);

  const pode = useCallback((...roles: Role[]) => !!usuario && (usuario.role === 'ADMIN' || roles.includes(usuario.role)), [usuario]);

  const value = useMemo(() => ({ usuario, empresa, carregando, entrar, sair, pode, recarregarEmpresa }),
    [usuario, empresa, carregando, entrar, sair, pode, recarregarEmpresa]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
