import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { readableTextColor } from '../../utils/helpers.js';
import { SortableTierCard } from './TierCard.jsx';

/** Одна строка-ранг: цветная плашка + зона, куда бросают карточки. */
export function TierRow({
  tier,
  items,
  itemsByUid,
  showTitles,
  highlighted,
  showControls,
  isFirst,
  isLast,
  onEdit,
  onMove,
  onOpenItem,
}) {
  const { setNodeRef } = useDroppable({ id: tier.id });
  const long = tier.label.length > 3;

  return (
    <div className="flex border-b border-zinc-950 bg-zinc-900 last:border-b-0">
      <button
        type="button"
        onClick={onEdit}
        disabled={!showControls}
        className="flex w-16 shrink-0 cursor-pointer items-center justify-center p-1.5 text-center font-bold break-words sm:w-24"
        style={{ backgroundColor: tier.color, color: readableTextColor(tier.color) }}
        title="Настроить ранг"
      >
        <span className={long ? 'text-xs leading-tight sm:text-sm' : 'text-2xl sm:text-3xl'}>{tier.label}</span>
      </button>

      <SortableContext id={tier.id} items={items} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-[6.25rem] flex-1 flex-wrap content-start gap-1 p-1 transition-colors sm:min-h-32 ${
            highlighted ? 'bg-zinc-800' : ''
          }`}
        >
          {items.map((uid) => (
            <SortableTierCard key={uid} item={itemsByUid.get(uid)} showTitles={showTitles} onOpen={onOpenItem} />
          ))}
        </div>
      </SortableContext>

      {showControls && (
        <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-zinc-950 sm:w-9">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"
            aria-label={`Настроить ранг ${tier.label}`}
          >
            <Settings2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-100 disabled:opacity-20"
            aria-label="Поднять ранг"
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-100 disabled:opacity-20"
            aria-label="Опустить ранг"
          >
            <ChevronDown size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Пул «Нераспределённое». */
export function PoolArea({ id, items, itemsByUid, showTitles, highlighted, onOpenItem, empty }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        className={`flex min-h-32 flex-wrap content-start gap-1.5 p-2 transition-colors ${highlighted ? 'bg-zinc-800/60' : ''}`}
      >
        {items.map((uid) => (
          <SortableTierCard key={uid} item={itemsByUid.get(uid)} showTitles={showTitles} onOpen={onOpenItem} />
        ))}
        {items.length === 0 && (
          <div className="flex w-full items-center justify-center py-8 text-center text-sm text-zinc-500">{empty}</div>
        )}
      </div>
    </SortableContext>
  );
}
