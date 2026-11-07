import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Стек открытых модалок: Escape закрывает только верхнюю.
const stack = [];

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
};

/** Модалку монтируют только когда она нужна: {open && <Modal …/>} — так черновики форм всегда свежие. */
export function Modal({ title, onClose, children, footer, size = 'md' }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panelRef = useRef(null);

  useEffect(() => {
    const token = {};
    stack.push(token);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === token) {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    // Фокус внутрь диалога (если внутри нет autoFocus-поля).
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = prevOverflow;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10 outline-none sm:rounded-2xl ${SIZES[size]}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
