import { useEffect, useState } from 'react';

/** Roteador por hash (#/vendas?status=ABERTO). Sem dependências e funciona em qualquer servidor estático. */
export interface Route { path: string; query: URLSearchParams }

function read(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, q = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (window.location.hash !== target) window.location.hash = target;
}

export const href = (to: string) => `#${to}`;
