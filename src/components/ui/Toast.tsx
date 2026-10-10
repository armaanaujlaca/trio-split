import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, Undo2, XCircle } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
}

interface ToastCtx {
  show: (message: string, opts?: { variant?: ToastVariant; action?: ToastItem['action'] }) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const show = useCallback<ToastCtx['show']>((message, opts) => {
    const id = idRef.current++;
    const item: ToastItem = {
      id,
      message,
      variant: opts?.variant ?? 'success',
      action: opts?.action,
    };
    setItems((xs) => [...xs, item]);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((it) =>
      window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== it.id)), 4200),
    );
    return () => timers.forEach(clearTimeout);
  }, [items]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-24 sm:bottom-6 inset-x-0 flex flex-col items-center z-[60] gap-2 px-4">
        {items.map((it) => (
          <div
            key={it.id}
            className="pointer-events-auto card px-4 py-3 flex items-center gap-3 max-w-md w-full"
          >
            {it.variant === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            {it.variant === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
            {it.variant === 'info' && <Info className="w-5 h-5 text-brand-500" />}
            <span className="flex-1 text-sm">{it.message}</span>
            {it.action && (
              <button
                className="btn-ghost !py-1 !px-2 text-brand-600 dark:text-brand-300 flex items-center gap-1 text-sm"
                onClick={() => {
                  it.action!.onClick();
                  setItems((xs) => xs.filter((x) => x.id !== it.id));
                }}
              >
                <Undo2 className="w-4 h-4" />
                {it.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
