import { Fragment, useEffect, useRef, useState } from 'react';
import { Check, KeyRound, Loader2, PenLine, Plus, Search, TriangleAlert, X } from 'lucide-react';
import { MEDIA_TYPES, SEARCH_CATEGORIES } from '../../constants.js';
import { useMediaSearch } from '../../hooks/useMediaSearch.js';
import { useStore } from '../../store/StoreContext.jsx';
import { createLibraryItem } from '../../store/storage.js';
import { isTypingTarget, metaLine } from '../../utils/helpers.js';
import { Poster, TypeBadge } from '../ui/primitives.jsx';
import { useToast } from '../ui/Toast.jsx';

/**
 * Поиск с автокомплитом.
 * Клик по строке → модалка добавления (статус/оценка/заметка); «+» → быстрое добавление в «В планах».
 * Клавиатура: «/» — фокус, ↑/↓ — выбор, Enter — открыть, Esc — закрыть.
 */
export function SearchBar({ onPick, onManualAdd, onOpenSettings }) {
  const { settings, libraryByUid, actions } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const category = settings.searchCategory;
  const { loading, pending, results, errors } = useMediaSearch(query, category);
  const showDropdown = open && query.trim().length >= 2;

  useEffect(() => setActive(0), [results]);

  // «/» фокусирует поиск из любого места страницы.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    // Escape закрывает список, даже если фокус ушёл на кнопку «+».
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (r) => {
    setOpen(false);
    inputRef.current?.blur();
    onPick(r);
  };

  const quickAdd = (r) => {
    actions.addItem(createLibraryItem(r));
    toast.success(`«${r.title}» → «В планах»`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && showDropdown && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const busy = loading || pending;

  return (
    <div ref={rootRef} className="relative w-full md:static">
      <div className="flex h-10 items-center rounded-xl bg-zinc-900 ring-1 ring-white/10 focus-within:ring-violet-500/60">
        <label className="sr-only" htmlFor="search-category">
          Категория поиска
        </label>
        <select
          id="search-category"
          value={category}
          onChange={(e) => {
            actions.updateSettings({ searchCategory: e.target.value });
            inputRef.current?.focus();
            setOpen(true);
          }}
          className="h-full cursor-pointer appearance-none rounded-l-xl border-r border-white/10 bg-transparent pr-2 pl-3 text-xs font-medium text-zinc-300 outline-none hover:text-white"
        >
          {SEARCH_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <Search size={16} className="ml-3 shrink-0 text-zinc-500" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Найти фильм, сериал, игру или аниме…"
          className="h-full w-0 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
        />
        {busy && query.trim().length >= 2 ? (
          <Loader2 size={16} className="mr-3 shrink-0 animate-spin text-zinc-500" aria-label="Загрузка" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="mr-2 rounded-md p-1 text-zinc-500 hover:text-zinc-200"
            aria-label="Очистить"
          >
            <X size={16} />
          </button>
        ) : (
          <kbd className="mr-3 hidden rounded border border-white/10 px-1.5 text-[10px] text-zinc-500 sm:block">/</kbd>
        )}
      </div>

      {showDropdown && (
        <div
          id="search-results"
          className="scroll-thin absolute top-full right-0 left-0 z-40 mt-2 max-h-[75vh] overflow-y-auto rounded-xl bg-zinc-900 pb-1 shadow-2xl ring-1 ring-white/10 md:right-auto md:left-1/2 md:max-h-[min(82vh,56rem)] md:w-[min(60rem,calc(100vw-2rem))] md:-translate-x-1/2"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/5 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-500 backdrop-blur">
            <span>
              {results.length > 0 ? `Найдено: ${results.length}` : busy ? 'Ищем…' : 'Нет результатов'}
              {busy && results.length > 0 && ' · обновляю…'}
            </span>
            <span className="hidden sm:inline">↑↓ — выбор · Enter — открыть · Esc — закрыть</span>
          </div>

          {errors.map((err) => (
            <div key={err.message} className="flex items-start gap-2 px-3 py-2 text-xs text-amber-200/90">
              {err.code === 'NO_KEY' ? (
                <KeyRound size={14} className="mt-0.5 shrink-0" />
              ) : (
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              )}
              <span className="flex-1">{err.message}</span>
              {err.code === 'NO_KEY' && (
                <button
                  type="button"
                  className="shrink-0 font-medium text-violet-300 hover:text-violet-200"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                >
                  Открыть настройки
                </button>
              )}
            </div>
          ))}
          {errors.length > 0 && results.length > 0 && <div className="my-1 border-t border-white/5" />}

          <ul ref={listRef} role="listbox" aria-label="Результаты поиска" className="grid gap-0.5 p-1 md:grid-cols-2">
            {results.map((r, i) => {
              const uid = `${r.media_type}:${r.id}`;
              const inLibrary = libraryByUid.has(uid);
              const groupStart = category === 'all' && (i === 0 || results[i - 1].media_type !== r.media_type);
              const original = r.original_title && r.original_title !== r.title ? r.original_title : null;
              const sub = [r.year, metaLine(r)].filter(Boolean).join(' · ');
              return (
                <Fragment key={uid}>
                  {groupStart && (
                    <li
                      role="presentation"
                      className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase md:col-span-2"
                    >
                      {MEDIA_TYPES[r.media_type].plural}
                    </li>
                  )}
                  <li
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(r)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${i === active ? 'bg-white/[0.07]' : ''}`}
                  >
                    <Poster
                      src={r.thumb ?? r.poster_path}
                      title={r.title}
                      mediaType={r.media_type}
                      className="h-20 w-14 shrink-0 rounded-md"
                      iconSize={16}
                      showTitle={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm leading-snug font-medium text-zinc-100">{r.title}</div>
                      {original && <div className="truncate text-xs text-zinc-400">{original}</div>}
                      {sub && <div className="truncate text-xs text-zinc-500">{sub}</div>}
                      {inLibrary && <div className="mt-0.5 text-[11px] text-emerald-400">в библиотеке</div>}
                    </div>
                    {category === 'all' && <TypeBadge type={r.media_type} compact className="hidden shrink-0 sm:inline-flex" />}
                    {inLibrary ? (
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-400"
                        title="Уже в библиотеке — нажмите, чтобы редактировать"
                      >
                        <Check size={18} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          quickAdd(r);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-200 hover:bg-violet-600 hover:text-white"
                        title="Быстро добавить в «В планах»"
                        aria-label={`Добавить «${r.title}»`}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>

          {!busy && results.length === 0 && errors.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">Ничего не найдено</div>
          )}
          {busy && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">Ищем…</div>
          )}

          <div className="mt-1 border-t border-white/5 px-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManualAdd({ title: query.trim(), media_type: category === 'all' ? 'movie' : category });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            >
              <PenLine size={15} className="shrink-0" />
              <span className="truncate">
                Нет нужного? Добавить «{query.trim()}» вручную
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
