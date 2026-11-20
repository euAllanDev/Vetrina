import { useEffect, useState } from 'react';
import { money } from '../lib/format';
import type { Produto } from './shared';

/**
 * "Me avise quando baixar": notificação do navegador (Web Push), grátis e sem cadastro.
 * O aparelho se inscreve no serviço de push do próprio navegador; o servidor avisa quando o preço cai.
 */
const CHAVE = 'loja.avisos';
const lerIds = (): number[] => { try { const v = JSON.parse(localStorage.getItem(CHAVE) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const gravarIds = (ids: number[]) => { try { localStorage.setItem(CHAVE, JSON.stringify(ids)); } catch { /* sem armazenamento */ } };

export const suportaAvisos = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function chaveBytes(b64: string) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function registro() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

async function inscricao(): Promise<PushSubscription> {
  const reg = await registro();
  const atual = await reg.pushManager.getSubscription();
  if (atual) return atual;
  const r = await fetch('/api/alertas/chave');
  if (!r.ok) throw new Error('O servidor está acordando. Tente de novo em instantes.');
  const { publicKey } = await r.json();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(publicKey) });
}

type Estado =
  | { k: 'off' } | { k: 'on' } | { k: 'carregando' }
  | { k: 'ok'; preco: number } | { k: 'erro'; msg: string } | { k: 'iphone' } | { k: 'bloqueado' } | { k: 'sem' };

export function AvisoPreco({ p }: { p: Produto }) {
  const [e, setE] = useState<Estado>(() => (lerIds().includes(p.id) ? { k: 'on' } : { k: 'off' }));
  useEffect(() => { setE(lerIds().includes(p.id) ? { k: 'on' } : { k: 'off' }); }, [p.id]);

  if (!p.disponivel && e.k === 'off') return null;
  const ativo = e.k === 'on' || e.k === 'ok';

  const ativar = async () => {
    if (!suportaAvisos()) { setE(ehIphone() && !instalado() ? { k: 'iphone' } : { k: 'sem' }); return; }
    if (Notification.permission === 'denied') { setE({ k: 'bloqueado' }); return; }
    setE({ k: 'carregando' });
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setE(perm === 'denied' ? { k: 'bloqueado' } : { k: 'off' }); return; }
      const sub = await inscricao();
      const r = await fetch('/api/alertas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId: p.id, subscription: sub.toJSON() }) });
      if (!r.ok) {
        let msg = 'Não foi possível ativar o aviso agora.';
        try { msg = (await r.json()).detail || msg; } catch { /* sem corpo */ }
        throw new Error(msg);
      }
      const d = await r.json();
      gravarIds([...new Set([...lerIds(), p.id])]);
      setE({ k: 'ok', preco: d.precoReferencia ?? p.preco });
    } catch (err) {
      // Mensagens do nosso servidor já vêm em português; as do navegador vêm em inglês e não ajudam.
      const m = err instanceof Error ? err.message : '';
      const nossa = /[ãçéíóúâêô]|Tente|aviso|servidor|produtos/i.test(m);
      setE({ k: 'erro', msg: nossa ? m : 'Não foi possível ativar os avisos neste navegador. Se estiver numa aba anônima, abra numa aba normal (ou no Chrome) e tente de novo.' });
    }
  };

  const desativar = async () => {
    setE({ k: 'carregando' });
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await fetch('/api/alertas/remover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId: p.id, endpoint: sub.endpoint }) });
    } catch { /* se falhar, o aviso some do aparelho mesmo assim */ }
    gravarIds(lerIds().filter((i) => i !== p.id));
    setE({ k: 'off' });
  };

  return (
    <div className="s-aviso">
      <button className={`s-aviso-btn ${ativo ? 'on' : ''}`} aria-pressed={ativo} disabled={e.k === 'carregando'}
        onClick={ativo ? desativar : ativar}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {e.k === 'carregando' ? 'Um instante…' : ativo ? 'Aviso de preço ativado' : 'Me avise quando baixar'}
      </button>
      {e.k === 'ok' && <p className="s-aviso-msg ok">Pronto! Você recebe uma notificação neste aparelho quando ficar abaixo de {money(e.preco)}. Toque no botão de novo para cancelar.</p>}
      {e.k === 'iphone' && <p className="s-aviso-msg">No iPhone, os avisos funcionam com a loja instalada: toque em <strong>Compartilhar</strong>, depois em <strong>Adicionar à Tela de Início</strong>. Abra a Vetrina pelo ícone e ative o aviso de novo.</p>}
      {e.k === 'sem' && <p className="s-aviso-msg">Este navegador não aceita notificações. Tente pelo Chrome, Edge ou Firefox.</p>}
      {e.k === 'bloqueado' && <p className="s-aviso-msg">As notificações estão bloqueadas para este site. Libere no cadeado ao lado do endereço (ou nas configurações do navegador) e tente de novo.</p>}
      {e.k === 'erro' && <p className="s-aviso-msg erro">{e.msg}</p>}
    </div>
  );
}
