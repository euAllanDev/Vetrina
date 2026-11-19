import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { Icon } from './icons';

/* ---------- Focus trap + Esc ---------- */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    // Foca o campo marcado com data-autofocus; senão, o próprio diálogo (sem anel em botão aleatório).
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Só o diálogo do topo reage (ex.: confirmação aberta sobre um drawer).
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== el) return;
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

/* ---------- Drawer ---------- */
export function Drawer({ open, onClose, title, sub, children, footer, wide }:
  { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={`drawer ${wide ? 'drawer-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <div>
            <h2 id="drawer-title" className="drawer-title">{title}</h2>
            {sub && <div className="muted" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          <Button variant="ghost" icon="x" aria-label="Fechar" onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, children, footer, label }:
  { open: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode; label: string }) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-label={label}>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

/* ---------- Toasts ---------- */
interface Toast { id: number; kind: 'ok' | 'err'; text: string; action?: { label: string; run: () => void } }
interface ToastApi { ok: (text: string, action?: Toast['action']) => void; err: (text: string) => void }
const ToastCtx = createContext<ToastApi>({ ok: () => {}, err: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.action ? 7000 : 4200);
  }, []);
  const apiRef = useRef<ToastApi>({ ok: (text, action) => push({ kind: 'ok', text, action }), err: (text) => push({ kind: 'err', text }) });
  return (
    <ToastCtx.Provider value={apiRef.current}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'err' ? 'alert' : 'status'}>
              <span className="toast-icon"><Icon name={t.kind === 'ok' ? 'check' : 'alert'} size={17} /></span>
              <span>{t.text}</span>
              {t.action && (
                <button className="toast-action" onClick={() => { t.action!.run(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Confirmação ---------- */
export function Confirm({ open, title, text, confirmLabel, danger, busy, onConfirm, onClose, children }:
  { open: boolean; title: string; text?: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean;
    onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} label={title}
      footer={<>
        <Button onClick={onClose}>Voltar</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <h2 className="section-title" style={{ fontSize: 17 }}>{title}</h2>
      {text && <p className="ink-2" style={{ marginTop: 8 }}>{text}</p>}
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </Modal>
  );
}
