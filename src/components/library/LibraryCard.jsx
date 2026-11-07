import { memo } from 'react';
import { NotebookPen, Star } from 'lucide-react';
import { metaLine, ratingTone } from '../../utils/helpers.js';
import { Popover, Poster, RatingBadge, RatingPicker, StatusSelect, TypeBadge } from '../ui/primitives.jsx';

/** Карточка библиотеки: клик по постеру — полное редактирование; статус и оценка правятся прямо тут. */
export const LibraryCard = memo(function LibraryCard({ item, onOpen, onUpdate }) {
  const sub = [item.year, metaLine(item)].filter(Boolean).join(' · ');

  return (
    <article className="group flex flex-col rounded-xl bg-zinc-900 ring-1 ring-white/5 transition-shadow hover:ring-white/15">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="relative aspect-[2/3] overflow-hidden rounded-t-xl focus-visible:outline-2 focus-visible:outline-violet-500"
        aria-label={`Редактировать «${item.title}»`}
      >
        <Poster
          src={item.poster_path}
          title={item.title}
          mediaType={item.media_type}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <TypeBadge type={item.media_type} overlay compact className="absolute top-2 left-2" />
        <RatingBadge rating={item.user_rating} className="absolute top-2 right-2 shadow-lg" />
        {item.notes && (
          <span
            className="absolute right-2 bottom-2 rounded-md bg-black/75 p-1 text-zinc-300"
            title={item.notes.length > 200 ? `${item.notes.slice(0, 200)}…` : item.notes}
          >
            <NotebookPen size={12} />
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm leading-snug font-medium text-zinc-100" title={item.title}>
            {item.title}
          </h3>
          {sub && <p className="mt-0.5 truncate text-xs text-zinc-500">{sub}</p>}
        </div>

        <div className="mt-auto flex items-center gap-1.5">
          <StatusSelect
            value={item.status}
            mediaType={item.media_type}
            onChange={(status) => onUpdate(item.uid, { status })}
            className="flex-1"
          />
          <Popover
            align="right"
            className="w-48"
            renderTrigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                title="Быстрая оценка"
                className={`flex h-8 min-w-10 items-center justify-center gap-0.5 rounded-lg px-1.5 text-xs font-bold tabular-nums ${ratingTone(item.user_rating)}`}
              >
                <Star size={11} className={item.user_rating ? 'fill-current' : ''} />
                {item.user_rating ?? '—'}
              </button>
            )}
          >
            {({ close }) => (
              <RatingPicker
                dense
                value={item.user_rating}
                onChange={(user_rating) => {
                  onUpdate(item.uid, { user_rating });
                  close();
                }}
              />
            )}
          </Popover>
        </div>
      </div>
    </article>
  );
});
