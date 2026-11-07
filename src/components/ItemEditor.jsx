import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { MEDIA_TYPES, MEDIA_TYPE_KEYS } from '../constants.js';
import { useStore } from '../store/StoreContext.jsx';
import { createLibraryItem } from '../store/storage.js';
import { formatDate, makeId, metaLine } from '../utils/helpers.js';
import { Modal } from './ui/Modal.jsx';
import { Button, Field, Poster, RatingPicker, StatusSegmented, TypeBadge, inputClass } from './ui/primitives.jsx';
import { useToast } from './ui/Toast.jsx';

const TITLES = { add: 'Добавить в библиотеку', manual: 'Добавить вручную', edit: 'Редактирование' };

function validate(details) {
  const errors = {};
  if (!details.title.trim()) errors.title = 'Введите название';
  const year = details.year.trim();
  if (year && !(/^\d{4}$/.test(year) && Number(year) >= 1800 && Number(year) <= 2999)) {
    errors.year = 'Четыре цифры, например 2024';
  }
  const poster = details.poster_path.trim();
  if (poster && !/^https?:\/\/\S+$/i.test(poster)) errors.poster = 'Ссылка должна начинаться с http:// или https://';
  return errors;
}

const ErrorText = ({ children }) => (children ? <p className="text-xs text-rose-400">{children}</p> : null);

/**
 * mode="add"    — item = результат поиска;
 * mode="manual" — item = { title?, media_type? } (заготовка для ручного ввода);
 * mode="edit"   — item = запись библиотеки.
 * Название, год и постер можно поправить в любом режиме (например, если у тайтла нет обложки).
 */
export function ItemEditor({ mode, item, onClose }) {
  const { actions } = useStore();
  const toast = useToast();
  const isManual = mode === 'manual';

  const [status, setStatus] = useState(item.status ?? 'Planned');
  const [rating, setRating] = useState(item.user_rating ?? null);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [details, setDetails] = useState({
    media_type: item.media_type ?? 'movie',
    title: item.title ?? '',
    original_title: item.original_title ?? '',
    year: item.year ? String(item.year) : '',
    poster_path: item.poster_path ?? '',
  });
  const [detailsOpen, setDetailsOpen] = useState(isManual);
  const [errors, setErrors] = useState({});
  const setDetail = (patch) => setDetails((d) => ({ ...d, ...patch }));

  const save = () => {
    const found = validate(details);
    setErrors(found);
    if (Object.keys(found).length) {
      setDetailsOpen(true);
      return;
    }
    const data = {
      title: details.title.trim(),
      original_title: details.original_title.trim() || null,
      year: details.year.trim() ? Number(details.year) : null,
      poster_path: details.poster_path.trim() || null,
    };
    const values = { status, user_rating: rating, notes: notes.trim() };

    if (mode === 'edit') {
      actions.updateItem(item.uid, { ...data, ...values });
    } else {
      const base = isManual
        ? { id: `manual-${makeId()}`, media_type: details.media_type, meta: { source: 'manual' } }
        : item;
      actions.addItem(createLibraryItem({ ...base, ...data }, values));
      toast.success(`«${data.title}» добавлено в библиотеку`);
    }
    onClose();
  };

  const remove = () => {
    if (!window.confirm(`Удалить «${item.title}» из библиотеки? Тайтл исчезнет и из всех тир-листов.`)) return;
    actions.removeItem(item.uid);
    toast.info(`«${item.title}» удалено`);
    onClose();
  };

  const mediaType = isManual ? details.media_type : item.media_type;
  const previewTitle = details.title.trim() || 'Без названия';
  const sub = [details.year.trim(), metaLine(item)].filter(Boolean).join(' · ');
  const sourceUrl = item.meta?.url;

  const detailFields = (
    <div className="space-y-3">
      {isManual && (
        <Field label="Тип">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {MEDIA_TYPE_KEYS.map((k) => {
              const Icon = MEDIA_TYPES[k].icon;
              const active = details.media_type === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDetail({ media_type: k })}
                  aria-pressed={active}
                  className={`flex h-9 items-center justify-center gap-2 rounded-lg text-sm transition-colors ${
                    active ? 'bg-zinc-100 font-medium text-zinc-900' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <Icon size={14} className={active ? '' : MEDIA_TYPES[k].text} />
                  {MEDIA_TYPES[k].label}
                </button>
              );
            })}
          </div>
        </Field>
      )}
      <Field label="Название" htmlFor="item-title">
        <input
          id="item-title"
          value={details.title}
          onChange={(e) => setDetail({ title: e.target.value.slice(0, 200) })}
          autoFocus={isManual}
          className={inputClass}
        />
        <ErrorText>{errors.title}</ErrorText>
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Field label="Оригинальное название" htmlFor="item-original">
          <input
            id="item-original"
            value={details.original_title}
            onChange={(e) => setDetail({ original_title: e.target.value.slice(0, 200) })}
            className={inputClass}
          />
        </Field>
        <Field label="Год" htmlFor="item-year">
          <input
            id="item-year"
            value={details.year}
            onChange={(e) => setDetail({ year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            inputMode="numeric"
            placeholder="2024"
            className={inputClass}
          />
          <ErrorText>{errors.year}</ErrorText>
        </Field>
      </div>
      <Field
        label="Ссылка на постер"
        htmlFor="item-poster"
        hint="Правый клик по картинке на любом сайте → «Копировать адрес изображения». Чтобы постер попал в PNG тир-листа, сайт картинки должен разрешать CORS: TMDB, Википедия и AniList разрешают."
      >
        <input
          id="item-poster"
          value={details.poster_path}
          onChange={(e) => setDetail({ poster_path: e.target.value.trim() })}
          placeholder="https://…"
          spellCheck={false}
          className={`${inputClass} font-mono text-xs`}
        />
        <ErrorText>{errors.poster}</ErrorText>
      </Field>
    </div>
  );

  return (
    <Modal
      title={TITLES[mode]}
      onClose={onClose}
      footer={
        <>
          {mode === 'edit' && (
            <Button variant="danger" icon={Trash2} onClick={remove} className="mr-auto">
              Удалить
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save}>
            {mode === 'edit' ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <Poster
          src={details.poster_path.trim() || null}
          title={previewTitle}
          mediaType={mediaType}
          className="aspect-[2/3] w-24 shrink-0 rounded-lg sm:w-28"
        />
        <div className="min-w-0 space-y-1.5">
          <TypeBadge type={mediaType} />
          <h3 className="text-lg leading-snug font-semibold break-words text-zinc-50">{previewTitle}</h3>
          {details.original_title.trim() && details.original_title.trim() !== details.title.trim() && (
            <p className="text-sm text-zinc-400">{details.original_title}</p>
          )}
          {sub && <p className="text-sm text-zinc-500">{sub}</p>}
          {mode === 'edit' && <p className="text-xs text-zinc-600">Добавлено {formatDate(item.added_at)}</p>}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs text-violet-300 hover:underline"
            >
              {new URL(sourceUrl).hostname.replace(/^www\./, '')}
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {isManual ? (
          detailFields
        ) : (
          <details
            open={detailsOpen}
            onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
            className="rounded-lg bg-zinc-950/40 ring-1 ring-white/5"
          >
            <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-400 select-none hover:text-zinc-200">
              Исправить название, год или постер
            </summary>
            <div className="border-t border-white/5 p-3">{detailFields}</div>
          </details>
        )}

        <Field label="Статус">
          <StatusSegmented value={status} mediaType={mediaType} onChange={setStatus} />
        </Field>

        <Field label={`Оценка${rating ? `: ${rating}/10` : ''}`} hint="Повторный клик по выбранной оценке сбрасывает её.">
          <RatingPicker value={rating} onChange={setRating} />
        </Field>

        <Field label="Заметки" htmlFor="item-notes">
          <textarea
            id="item-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
            }}
            rows={4}
            placeholder="Впечатления, на какой серии остановились, с кем смотреть… (Ctrl+Enter — сохранить)"
            className="w-full resize-y rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-violet-500/60"
          />
        </Field>
      </div>
    </Modal>
  );
}
