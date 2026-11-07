import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckCircle2, cls: 'text-emerald-300' },
  error: { icon: TriangleAlert, cls: 'text-rose-300' },
  info: { icon: Info, cls: 'text-sky-300' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message, type = 'info', duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((list) => [...list.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      info: (m) => show(m, 'info'),
      error: (m) => show(m, 'error', 7000),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type] ?? STYLES.info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-zinc-900/95 px-4 py-3 text-sm shadow-2xl ring-1 ring-white/10 backdrop-blur"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${cls}`} />
              <p className="flex-1 leading-snug text-zinc-200">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-200"
                aria-label="Закрыть уведомление"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() должен вызываться внутри <ToastProvider>');
  return ctx;
}
