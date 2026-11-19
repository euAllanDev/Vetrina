const TOKEN_KEY = 'erp.token';

export class ApiError extends Error {
  status: number;
  campos?: Record<string, string>;
  constructor(status: number, message: string, campos?: Record<string, string>) {
    super(message);
    this.status = status;
    this.campos = campos;
  }
}

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* armazenamento indisponível */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* idem */ } },
};

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(params: Query): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, raw: false | 'text' | 'blob' = false): Promise<T> {
  const headers: Record<string, string> = { Accept: raw ? '*/*' : 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique se a API está no ar.');
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    tokenStore.clear();
    onUnauthorized();
    throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    let campos: Record<string, string> | undefined;
    try {
      const pd = await res.json();
      msg = pd.detail || pd.title || msg;
      campos = pd.campos;
      if (res.status === 401) msg = 'E-mail ou senha inválidos.';
      if (res.status === 403) msg = 'Seu perfil não tem permissão para esta operação.';
    } catch { /* corpo não-JSON */ }
    throw new ApiError(res.status, msg, campos);
  }
  if (res.status === 204) return undefined as T;
  if (raw === 'blob') return (await res.blob()) as T;
  if (raw) return (await res.text()) as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: Query) => request<T>('GET', path + (params ? qs(params) : '')),
  text: (path: string) => request<string>('GET', path, undefined, 'text'),
  blob: (path: string) => request<Blob>('GET', path, undefined, 'blob'),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T = void>(path: string) => request<T>('DELETE', path),
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const token = tokenStore.get();
    const res = await fetch(`/api${path}`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try { const pd = await res.json(); msg = pd.detail || msg; } catch { /* sem corpo */ }
      throw new ApiError(res.status, msg);
    }
    return (await res.json()) as T;
  },
};
