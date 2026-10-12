'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Button, Modal } from './kit';

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}
interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, the user must type this text to confirm (destructive actions). */
  typeToConfirm?: string;
}

const FeedbackContext = createContext<{
  toast: (text: string, tone?: ToastTone) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
} | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const seq = useRef(0);

  const toast = useCallback((text: string, tone: ToastTone = 'success') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => {
    setTyped('');
    setPending(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon name={t.tone === 'success' ? 'check' : t.tone === 'error' ? 'alert' : 'info'} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <Modal
        open={pending !== null}
        onClose={() => close(false)}
        title={pending?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button
              variant={pending?.danger ? 'danger' : 'primary'}
              disabled={Boolean(pending?.typeToConfirm) && typed !== pending?.typeToConfirm}
              onClick={() => close(true)}
            >
              {pending?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="stack">
          <div>{pending?.message}</div>
          {pending?.typeToConfirm ? (
            <label className="field">
              <span>
                Escribe <strong>{pending.typeToConfirm}</strong> para confirmar
              </span>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            </label>
          ) : null}
        </div>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const v = useContext(FeedbackContext);
  if (!v) throw new Error('useFeedback outside FeedbackProvider');
  return v;
}
