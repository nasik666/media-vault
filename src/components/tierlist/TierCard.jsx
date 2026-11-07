import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Poster } from '../ui/primitives.jsx';

const SIZE = 'h-24 w-16 sm:h-[120px] sm:w-20';

/** Визуальная карточка (используется и в списке, и в DragOverlay). */
export function TierCard({ item, showTitles = false, overlay = false }) {
  return (
    <div
      className={`relative ${SIZE} overflow-hidden rounded-md bg-zinc-800 select-none ${
        overlay ? 'scale-105 cursor-grabbing shadow-2xl ring-2 ring-violet-400' : 'cursor-grab'
      }`}
      title={`${item.title}${item.year ? ` (${item.year})` : ''}`}
    >
      <Poster
        src={item.poster_path}
        title={item.title}
        mediaType={item.media_type}
        className="h-full w-full"
        iconSize={18}
        showTitle={!showTitles}
      />
      {showTitles && (
        <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-center text-[10px] leading-tight text-zinc-100">
          <span className="line-clamp-2">{item.title}</span>
        </div>
      )}
    </div>
  );
}

/** Карточка, которую можно перетаскивать. Двойной клик — открыть редактирование. */
export const SortableTierCard = memo(function SortableTierCard({ item, showTitles, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`touch-manipulation rounded-md outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
        isDragging ? 'opacity-30' : ''
      }`}
      onDoubleClick={() => onOpen(item)}
      {...attributes}
      {...listeners}
      aria-roledescription="перетаскиваемый тайтл"
      aria-label={item.title}
    >
      <TierCard item={item} showTitles={showTitles} />
    </div>
  );
});
