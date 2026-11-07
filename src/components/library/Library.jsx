import { useMemo, useState } from 'react';
import { ClipboardCopy, FileDown, FileSpreadsheet, KeyRound, LibraryBig, Search, X } from 'lucide-react';
import { MEDIA_TYPES, MEDIA_TYPE_KEYS, SORT_OPTIONS, STATUSES, statusDot, statusLabel } from '../../constants.js';
import { usePersistentState } from '../../hooks/usePersistentState.js';
import { useStore } from '../../store/StoreContext.jsx';
import { buildRatingsText, downloadRatingsCsv } from '../../utils/exportRatings.js';
import { pluralize, TITLE_FORMS } from '../../utils/helpers.js';
import { Button, Popover, Select } from '../ui/primitives.jsx';
import { useToast } from '../ui/Toast.jsx';
import { LibraryCard } from './LibraryCard.jsx';

/** Экспорт оценок ровно того, что сейчас видно: с учётом фильтров и сортировки. */
function ExportMenu({ items }) {
  const toast = useToast();

  const itemClass =
    'flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-200 hover:bg-white/5';

  const copyText = async (close) => {
    try {
      await navigator.clipboard.writeText(buildRatingsText(items));
      toast.success(`Скопировано: ${pluralize(items.length, TITLE_FORMS)}`);
    } catch {
      toast.error('Браузер не дал доступ к буферу обмена');
    }
    close();
  };

  return (
    <Popover
      side="bottom"
      align="right"
      className="w-72"
      renderTrigger={({ toggle, open }) => (
        <Button icon={FileDown} onClick={toggle} aria-expanded={open} disabled={items.length === 0} title="Экспорт оценок">
          <span className="hidden sm:inline">Экспорт</span>
        </Button>
      )}
    >
      {({ close }) => (
        <div className="space-y-1">
          <p className="px-2.5 pt-1 pb-1.5 text-xs text-zinc-500">
            {pluralize(items.length, TITLE_FORMS)} — с текущими фильтрами и сортировкой
          </p>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              downloadRatingsCsv(items);
              toast.success(`CSV сохранён: ${pluralize(items.length, TITLE_FORMS)}`);
              close();
            }}
          >
            <FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-emerald-400" />
            <span>
              Скачать таблицу CSV
              <span className="block text-xs text-zinc-500">Открывается в Excel и Google Таблицах</span>
            </span>
          </button>
          <button type="button" className={itemClass} onClick={() => copyText(close)}>
            <ClipboardCopy size={16} className="mt-0.5 shrink-0 text-sky-400" />
            <span>
              Скопировать списком
              <span className="block text-xs text-zinc-500">«9/10 · Название (2024) · Просмотрено»</span>
            </span>
          </button>
        </div>
      )}
    </Popover>
  );
}

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

const SORTERS = {
  added_desc: (a, b) => b.added_at - a.added_at,
  added_asc: (a, b) => a.added_at - b.added_at,
  // Без оценки — всегда в конце.
  rating_desc: (a, b) => (b.user_rating ?? -1) - (a.user_rating ?? -1) || b.added_at - a.added_at,
  rating_asc: (a, b) => (a.user_rating ?? 99) - (b.user_rating ?? 99) || b.added_at - a.added_at,
  title_asc: (a, b) => collator.compare(a.title, b.title),
  title_desc: (a, b) => collator.compare(b.title, a.title),
  year_desc: (a, b) => (b.year ?? 0) - (a.year ?? 0) || collator.compare(a.title, b.title),
};

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors ${
        active ? 'bg-zinc-100 font-medium text-zinc-900' : 'bg-zinc-900 text-zinc-300 ring-1 ring-white/5 hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  );
}

const Count = ({ n }) => <span className="text-xs text-zinc-500 tabular-nums">{n}</span>;

export function Library({ onOpenItem, onOpenSettings }) {
  const { library, settings, actions } = useStore();
  const [type, setType] = usePersistentState('lib:type', 'all');
  const [status, setStatus] = usePersistentState('lib:status', 'all');
  const [sort, setSort] = usePersistentState('lib:sort', 'added_desc');
  const [hideKeyHint, setHideKeyHint] = usePersistentState('lib:hideKeyHint', false);
  const [q, setQ] = useState('');

  const typeCounts = useMemo(() => {
    const counts = { all: library.length };
    for (const k of MEDIA_TYPE_KEYS) counts[k] = 0;
    for (const i of library) counts[i.media_type] += 1;
    return counts;
  }, [library]);

  const byType = useMemo(
    () => (type === 'all' ? library : library.filter((i) => i.media_type === type)),
    [library, type],
  );

  const statusCounts = useMemo(() => {
    const counts = { all: byType.length };
    for (const s of STATUSES) counts[s] = 0;
    for (const i of byType) counts[i.status] += 1;
    return counts;
  }, [byType]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return byType
      .filter((i) => status === 'all' || i.status === status)
      .filter(
        (i) =>
          !needle ||
          i.title.toLowerCase().includes(needle) ||
          i.original_title?.toLowerCase().includes(needle) ||
          i.notes?.toLowerCase().includes(needle),
      )
      .sort(SORTERS[sort] ?? SORTERS.added_desc);
  }, [byType, status, q, sort]);

  const missingKeys = !settings.tmdbKey || !settings.rawgKey;

  return (
    <div className="space-y-5">
      {missingKeys && !hideKeyHint && (
        <div className="flex flex-col gap-3 rounded-xl bg-violet-500/10 p-4 ring-1 ring-violet-500/25 sm:flex-row sm:items-center">
          <KeyRound size={20} className="shrink-0 text-violet-300" />
          <p className="flex-1 text-sm text-zinc-300">
            Для поиска {!settings.tmdbKey && 'фильмов и сериалов (TMDB)'}
            {!settings.tmdbKey && !settings.rawgKey && ' и '}
            {!settings.rawgKey && 'игр (RAWG)'} нужен бесплатный API-ключ. Аниме ищется без ключа.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={onOpenSettings}>
              Добавить ключи
            </Button>
            <Button variant="ghost" size="sm" icon={X} onClick={() => setHideKeyHint(true)} aria-label="Скрыть подсказку" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0">
          <Chip active={type === 'all'} onClick={() => setType('all')}>
            Все <Count n={typeCounts.all} />
          </Chip>
          {MEDIA_TYPE_KEYS.map((k) => {
            const Icon = MEDIA_TYPES[k].icon;
            return (
              <Chip key={k} active={type === k} onClick={() => setType(k)}>
                <Icon size={14} className={type === k ? '' : MEDIA_TYPES[k].text} />
                {MEDIA_TYPES[k].plural} <Count n={typeCounts[k]} />
              </Chip>
            );
          })}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-56 lg:flex-none">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Фильтр по библиотеке"
              className="h-9 w-full rounded-lg bg-zinc-900 pr-3 pl-8 text-sm text-zinc-100 ring-1 ring-white/5 outline-none placeholder:text-zinc-500 focus:ring-violet-500/60"
            />
          </div>
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} className="w-36 sm:w-44" aria-label="Сортировка" />
          <ExportMenu items={items} />
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <Chip active={status === 'all'} onClick={() => setStatus('all')}>
          Любой статус <Count n={statusCounts.all} />
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            <span className={`h-2 w-2 rounded-full ${statusDot(s)}`} />
            {statusLabel(s, type === 'all' ? undefined : type)} <Count n={statusCounts[s]} />
          </Chip>
        ))}
      </div>

      {library.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
          <LibraryBig size={40} className="text-zinc-600" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-200">Библиотека пуста</h2>
          <p className="mt-1 max-w-md text-sm text-zinc-500">
            Найдите фильм, сериал, игру или аниме через поиск вверху (клавиша <kbd className="text-zinc-300">/</kbd>) и
            добавьте его. Всё хранится локально в этом браузере — не забывайте делать экспорт в JSON.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-500">Под выбранные фильтры ничего не подходит.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <LibraryCard key={item.uid} item={item} onOpen={onOpenItem} onUpdate={actions.updateItem} />
          ))}
        </div>
      )}
    </div>
  );
}
