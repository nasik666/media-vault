import { Check } from 'lucide-react';
import { STATUSES, statusDot, statusLabel } from '../../constants.js';

/**
 * Переключатели статусов для фильтра тир-листа: включённые — светлые с галочкой,
 * выключенные — тусклые и зачёркнутые. Последний включённый выключить нельзя.
 */
export function StatusToggles({ value, onChange, mediaType = 'all' }) {
  const toggle = (status) => {
    const next = value.includes(status)
      ? value.filter((s) => s !== status)
      : STATUSES.filter((s) => s === status || value.includes(s));
    if (next.length) onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Какие статусы попадают в тир-лист">
      {STATUSES.map((status) => {
        const on = value.includes(status);
        const last = on && value.length === 1;
        const label = statusLabel(status, mediaType === 'all' ? undefined : mediaType);
        return (
          <button
            key={status}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(status)}
            disabled={last}
            title={last ? 'Хотя бы один статус должен остаться' : on ? `Скрыть «${label}»` : `Показать «${label}»`}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors disabled:cursor-not-allowed ${
              on
                ? 'bg-zinc-100 font-medium text-zinc-900'
                : 'bg-zinc-900 text-zinc-500 line-through decoration-zinc-600 ring-1 ring-white/5 hover:text-zinc-300'
            }`}
          >
            {on ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <span className={`h-2 w-2 rounded-full opacity-50 ${statusDot(status)}`} aria-hidden="true" />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
