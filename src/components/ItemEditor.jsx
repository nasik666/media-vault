import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { createLibraryItem } from '../store/storage.js';
import { formatDate, metaLine } from '../utils/helpers.js';
import { Modal } from './ui/Modal.jsx';
import { Button, Field, Poster, RatingPicker, StatusSegmented, TypeBadge } from './ui/primitives.jsx';
import { useToast } from './ui/Toast.jsx';

/**
 * Модалка добавления (mode="add", item = результат поиска)
 * и редактирования (mode="edit", item = запись библиотеки).
 */
export function ItemEditor({ mode, item, onClose }) {
  const { actions } = useStore();
  const toast = useToast();
  const [status, setStatus] = useState(item.status ?? 'Planned');
  const [rating, setRating] = useState(item.user_rating ?? null);
  const [notes, setNotes] = useState(item.notes ?? '');

  const save = () => {
    const values = { status, user_rating: rating, notes: notes.trim() };
    if (mode === 'add') {
      actions.addItem(createLibraryItem(item, values));
      toast.success(`«${item.title}» добавлено в библиотеку`);
    } else {
      actions.updateItem(item.uid, values);
    }
    onClose();
  };

  const remove = () => {
    if (!window.confirm(`Удалить «${item.title}» из библиотеки? Тайтл исчезнет и из всех тир-листов.`)) return;
    actions.removeItem(item.uid);
    toast.info(`«${item.title}» удалено`);
    onClose();
  };

  const sub = [item.year, metaLine(item)].filter(Boolean).join(' · ');

  return (
    <Modal
      title={mode === 'add' ? 'Добавить в библиотеку' : 'Редактирование'}
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
            {mode === 'add' ? 'Добавить' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <Poster
          src={item.poster_path}
          title={item.title}
          mediaType={item.media_type}
          className="aspect-[2/3] w-24 shrink-0 rounded-lg sm:w-28"
        />
        <div className="min-w-0 space-y-1.5">
          <TypeBadge type={item.media_type} />
          <h3 className="text-lg leading-snug font-semibold text-zinc-50">{item.title}</h3>
          {item.original_title && item.original_title !== item.title && (
            <p className="text-sm text-zinc-400">{item.original_title}</p>
          )}
          {sub && <p className="text-sm text-zinc-500">{sub}</p>}
          {mode === 'edit' && <p className="text-xs text-zinc-600">Добавлено {formatDate(item.added_at)}</p>}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <Field label="Статус">
          <StatusSegmented value={status} mediaType={item.media_type} onChange={setStatus} />
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
