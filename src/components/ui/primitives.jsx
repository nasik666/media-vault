import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ImageOff, Star } from 'lucide-react';
import { MEDIA_TYPES, STATUSES, statusDot, statusLabel } from '../../constants.js';
import { ratingTone } from '../../utils/helpers.js';

/* ---------------------------------- Button --------------------------------- */

const VARIANTS = {
  primary: 'bg-violet-600 text-white hover:bg-violet-500',
  secondary: 'bg-zinc-800 text-zinc-100 ring-1 ring-white/5 hover:bg-zinc-700',
  ghost: 'text-zinc-300 hover:bg-white/5 hover:text-white',
  danger: 'bg-rose-600/15 text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-600/25',
};

const SIZES = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
  icon: 'h-9 w-9 justify-center',
  iconSm: 'h-7 w-7 justify-center',
};

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' || size === 'iconSm' ? 14 : 16} aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ---------------------------------- Select --------------------------------- */

export function Select({ value, onChange, options, className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 pr-8 pl-3 text-sm text-zinc-100 ring-1 ring-white/5 outline-none hover:bg-zinc-700 focus:ring-violet-500/60"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

/* ---------------------------------- Poster --------------------------------- */

const withCacheBust = (url) => `${url}${url.includes('?') ? '&' : '?'}cors=1`;

/**
 * crossOrigin="anonymous" важен: картинка сразу кэшируется с CORS-заголовками,
 * и html2canvas потом может нарисовать её на canvas без «tainted canvas».
 * Если в HTTP-кэше уже лежит ответ без CORS (картинку где-то загрузили без crossOrigin),
 * CORS-загрузка падает — тогда одна повторная попытка с другим URL (?cors=1) в обход кэша.
 */
export function Poster({ src, title, mediaType, className = '', iconSize = 28, showTitle = true }) {
  const [failure, setFailure] = useState({ src: null, count: 0 });
  const failures = failure.src === src ? failure.count : 0;
  const Icon = MEDIA_TYPES[mediaType]?.icon ?? ImageOff;

  if (!src || failures >= 2) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 bg-linear-to-br from-zinc-800 to-zinc-900 p-2 text-center text-zinc-500 ${className}`}
      >
        <Icon size={iconSize} aria-hidden="true" />
        {showTitle && <span className="line-clamp-3 text-[10px] leading-tight text-zinc-400">{title}</span>}
      </div>
    );
  }

  return (
    <img
      crossOrigin="anonymous"
      src={failures === 1 ? withCacheBust(src) : src}
      alt={title}
      loading="lazy"
      decoding="async"
      draggable={false}
      data-poster=""
      onError={() => setFailure({ src, count: failures + 1 })}
      className={`object-cover select-none ${className}`}
    />
  );
}

/* -------------------------------- TypeBadge -------------------------------- */

export function TypeBadge({ type, overlay = false, compact = false, className = '' }) {
  const t = MEDIA_TYPES[type];
  if (!t) return null;
  const Icon = t.icon;
  const tone = overlay ? `bg-black/75 ring-white/10 ${t.text}` : `${t.soft} ${t.text}`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-inset ${tone} ${className}`}
      title={t.label}
    >
      <Icon size={11} aria-hidden="true" />
      {!compact && t.label}
    </span>
  );
}

/* ------------------------------- RatingBadge ------------------------------- */

export function RatingBadge({ rating, className = '' }) {
  if (!rating) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${ratingTone(rating)} ${className}`}
    >
      <Star size={11} className="fill-current" aria-hidden="true" />
      {rating}
    </span>
  );
}

/* ------------------------------- RatingPicker ------------------------------ */

export function RatingPicker({ value, onChange, dense = false }) {
  const cell = dense ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  return (
    <div className={`grid ${dense ? 'grid-cols-5' : 'grid-cols-5 sm:grid-cols-10'} gap-1`} role="radiogroup" aria-label="Оценка">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(value === n ? null : n)}
            title={value === n ? 'Нажмите ещё раз, чтобы сбросить' : `Оценка ${n}`}
            className={`${cell} rounded-lg font-semibold tabular-nums transition-colors ${
              active ? ratingTone(value) : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            } ${value === n ? 'ring-2 ring-white/70' : ''}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Popover --------------------------------- */

/** Мини-поповер: закрывается кликом снаружи и по Escape. */
export function Popover({ renderTrigger, children, align = 'left', side = 'top', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      {renderTrigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={`absolute z-30 rounded-xl bg-zinc-900 p-2 shadow-2xl ring-1 ring-white/10 ${
            side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          } ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${className}`}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ StatusSelect ------------------------------- */

export function StatusSelect({ value, mediaType, onChange, className = '' }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <span className={`pointer-events-none absolute top-1/2 left-2.5 h-2 w-2 -translate-y-1/2 rounded-full ${statusDot(value)}`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Статус"
        className="h-8 w-full cursor-pointer appearance-none truncate rounded-lg bg-zinc-800 pr-6 pl-6 text-xs text-zinc-200 outline-none hover:bg-zinc-700 focus:ring-1 focus:ring-violet-500/60"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s, mediaType)}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}

/* ---------------------------- StatusSegmented ------------------------------ */

export function StatusSegmented({ value, mediaType, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Статус">
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={`flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm transition-colors ${
            value === s
              ? 'bg-zinc-100 font-medium text-zinc-900'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${statusDot(s)}`} />
          {statusLabel(s, mediaType)}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- Field ---------------------------------- */

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-200">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs leading-relaxed text-zinc-500">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'h-9 w-full rounded-lg bg-zinc-950 px-3 text-sm text-zinc-100 ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-violet-500/60';
