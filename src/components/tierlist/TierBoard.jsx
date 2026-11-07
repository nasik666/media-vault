import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Captions, ImageDown, Inbox, Loader2, Plus, RotateCcw, Search } from 'lucide-react';
import { MEDIA_TYPES, TIER_COLOR_PRESETS, statusLabel } from '../../constants.js';
import { useStore } from '../../store/StoreContext.jsx';
import { createDefaultTiers } from '../../store/storage.js';
import { POOL_ID, nextTierLabel, resolveBoard } from '../../store/tierUtils.js';
import { downloadBlob, makeId, pluralize, slugify, TITLE_FORMS } from '../../utils/helpers.js';
import { Button } from '../ui/primitives.jsx';
import { useToast } from '../ui/Toast.jsx';
import { TierCard } from './TierCard.jsx';
import { TierEditor } from './TierEditor.jsx';
import { PoolArea, TierRow } from './TierRow.jsx';

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function findContainer(id, containers) {
  if (id == null || !containers) return null;
  if (has(containers, id)) return id;
  return Object.keys(containers).find((key) => containers[key].includes(id)) ?? null;
}

/**
 * Доска тир-листа на dnd-kit (паттерн «multiple containers»).
 *
 * Пока ничего не тащим, контейнеры вычисляются из стора (resolveBoard).
 * На время перетаскивания берём снимок в dragState и двигаем карточки локально
 * (onDragOver — между контейнерами, onDragEnd — сортировка внутри),
 * а в стор коммитим один раз в конце. Так localStorage не дёргается на каждый пиксель.
 */
export function TierBoard({ board, onOpenItem }) {
  const { library, actions } = useStore();
  const toast = useToast();

  const resolved = useMemo(() => resolveBoard(board, library), [board, library]);
  const baseContainers = useMemo(
    () => ({ ...Object.fromEntries(resolved.tiers.map((t) => [t.id, t.items])), [POOL_ID]: resolved.unranked }),
    [resolved],
  );

  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const activeIdRef = useRef(null);
  const lastOverId = useRef(null);
  const recentlyMovedToNewContainer = useRef(false);

  const containers = dragState ?? baseContainers;

  const [exporting, setExporting] = useState(false);
  const [editingTierId, setEditingTierId] = useState(null);
  const [poolQuery, setPoolQuery] = useState('');
  const captureRef = useRef(null);

  const sensors = useSensors(
    // Мышь: drag начинается после 5px движения — обычный клик/двойной клик не ломается.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Тач: долгое нажатие 180 мс, иначе страница просто скроллится.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setDrag = (next) => {
    dragRef.current = next;
    setDragState(next);
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [dragState]);

  /**
   * Своя стратегия коллизий (из официального примера dnd-kit для нескольких списков):
   * сначала ищем контейнер под курсором, затем ближайшую карточку внутри него.
   */
  const collisionDetection = useCallback((args) => {
    const current = dragRef.current;
    const pointerHits = pointerWithin(args);
    const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
    let overId = getFirstCollision(hits, 'id');

    if (overId != null) {
      if (current && has(current, overId)) {
        const containerItems = current[overId];
        if (containerItems.length > 0) {
          const closest = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (c) => c.id !== overId && containerItems.includes(c.id),
            ),
          });
          if (closest.length > 0) overId = closest[0].id;
        }
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }

    if (recentlyMovedToNewContainer.current) lastOverId.current = activeIdRef.current;
    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  }, []);

  const handleDragStart = ({ active }) => {
    setDrag(baseContainers);
    activeIdRef.current = active.id;
    setActiveId(active.id);
  };

  const handleDragOver = ({ active, over }) => {
    const current = dragRef.current;
    if (!over || !current) return;
    const from = findContainer(active.id, current);
    const to = findContainer(over.id, current);
    if (!from || !to || from === to) return;

    const toItems = current[to];
    let index = toItems.length;
    if (!has(current, over.id)) {
      const overIndex = toItems.indexOf(over.id);
      const rect = active.rect.current.translated;
      const isAfter = rect && rect.left + rect.width / 2 > over.rect.left + over.rect.width / 2;
      if (overIndex >= 0) index = overIndex + (isAfter ? 1 : 0);
    }

    recentlyMovedToNewContainer.current = true;
    setDrag({
      ...current,
      [from]: current[from].filter((id) => id !== active.id),
      [to]: [...toItems.slice(0, index), active.id, ...toItems.slice(index)],
    });
  };

  const commit = (final) => {
    if (JSON.stringify(final) === JSON.stringify(baseContainers)) return;
    // Тайтлы, временно скрытые фильтром доски (но всё ещё в библиотеке), сохраняем на своих местах.
    const libraryUids = new Set(library.map((i) => i.uid));
    const tiers = board.tiers.map((t) => ({
      ...t,
      items: [
        ...(final[t.id] ?? []),
        ...t.items.filter((uid) => libraryUids.has(uid) && !resolved.itemsByUid.has(uid)),
      ],
    }));
    actions.updateTierList(board.id, { tiers, unranked: final[POOL_ID] ?? [] });
  };

  const handleDragEnd = ({ active, over }) => {
    const current = dragRef.current;
    activeIdRef.current = null;
    setActiveId(null);
    if (!current) return;

    let final = current;
    if (over) {
      const from = findContainer(active.id, current);
      const to = findContainer(over.id, current);
      if (from && to && from === to) {
        const items = current[to];
        const oldIndex = items.indexOf(active.id);
        const newIndex = has(current, over.id) ? items.length - 1 : items.indexOf(over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          final = { ...current, [to]: arrayMove(items, oldIndex, newIndex) };
        }
      }
    }
    commit(final);
    setDrag(null);
  };

  const handleDragCancel = () => {
    activeIdRef.current = null;
    setActiveId(null);
    setDrag(null);
  };

  /* ----------------------------- операции с рангами ----------------------------- */

  const patchBoard = (patch) => actions.updateTierList(board.id, patch);

  const moveTier = (tierId, dir) => {
    const i = board.tiers.findIndex((t) => t.id === tierId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= board.tiers.length) return;
    patchBoard({ tiers: arrayMove(board.tiers, i, j) });
  };

  const saveTier = (tierId, values) =>
    patchBoard({ tiers: board.tiers.map((t) => (t.id === tierId ? { ...t, ...values } : t)) });

  const clearTier = (tierId) => {
    const tier = board.tiers.find((t) => t.id === tierId);
    patchBoard({
      tiers: board.tiers.map((t) => (t.id === tierId ? { ...t, items: [] } : t)),
      unranked: [...tier.items, ...board.unranked],
    });
  };

  const deleteTier = (tierId) => {
    const tier = board.tiers.find((t) => t.id === tierId);
    patchBoard({ tiers: board.tiers.filter((t) => t.id !== tierId), unranked: [...tier.items, ...board.unranked] });
  };

  const addTier = () =>
    patchBoard({
      tiers: [
        ...board.tiers,
        {
          id: makeId(),
          label: nextTierLabel(board.tiers),
          color: TIER_COLOR_PRESETS[board.tiers.length % TIER_COLOR_PRESETS.length],
          items: [],
        },
      ],
    });

  const resetPlacement = () => {
    if (!window.confirm('Вернуть все тайтлы в «Нераспределённое»?')) return;
    patchBoard({ tiers: board.tiers.map((t) => ({ ...t, items: [] })), unranked: [] });
  };

  const resetTiers = () => {
    if (!window.confirm('Сбросить ранги к стандартным S/A/B/C/D? Тайтлы вернутся в «Нераспределённое».')) return;
    patchBoard({ tiers: createDefaultTiers(), unranked: [] });
  };

  /* ------------------------------- экспорт в PNG ------------------------------- */

  const exportPng = async () => {
    if (!captureRef.current) return;
    // Синхронно убираем кнопки управления из DOM: html2canvas клонирует DOM, ждать отрисовки кадра не нужно.
    flushSync(() => setExporting(true));
    try {
      // html2canvas-pro — API-совместимый форк html2canvas с поддержкой oklch()-цветов Tailwind v4.
      // Грузится лениво, только при первом экспорте.
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('пустой canvas');
      downloadBlob(blob, `${slugify(board.name)}.png`);
      toast.success('Картинка тир-листа сохранена');
    } catch (e) {
      console.error(e);
      toast.error(`Не удалось сохранить картинку: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  /* ---------------------------------- рендер ---------------------------------- */

  const activeItem = activeId ? resolved.itemsByUid.get(activeId) : null;
  const activeContainer = activeId ? findContainer(activeId, containers) : null;

  const needle = poolQuery.trim().toLowerCase();
  const poolItems = needle
    ? containers[POOL_ID].filter(
        (uid) => uid === activeId || resolved.itemsByUid.get(uid)?.title.toLowerCase().includes(needle),
      )
    : containers[POOL_ID];

  const placedCount = resolved.tiers.reduce((n, t) => n + t.items.length, 0);
  const filterParts = [
    board.filter.mediaType === 'all' ? 'Все типы' : MEDIA_TYPES[board.filter.mediaType].plural,
    board.filter.status !== 'any' &&
      statusLabel(board.filter.status, board.filter.mediaType === 'all' ? undefined : board.filter.mediaType),
  ].filter(Boolean);

  const editingTier = board.tiers.find((t) => t.id === editingTierId);
  const showControls = !exporting;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={Plus} onClick={addTier}>
          Ранг
        </Button>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetPlacement} disabled={placedCount === 0}>
          Всё в пул
        </Button>
        <Button size="sm" variant="ghost" onClick={resetTiers}>
          Стандартные ранги
        </Button>
        <Button
          size="sm"
          variant={board.showTitles ? 'secondary' : 'ghost'}
          icon={Captions}
          onClick={() => patchBoard({ showTitles: !board.showTitles })}
          aria-pressed={board.showTitles}
        >
          Названия
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={exporting ? Loader2 : ImageDown}
          onClick={exportPng}
          disabled={exporting}
          className={`ml-auto ${exporting ? '[&>svg]:animate-spin' : ''}`}
        >
          Скачать PNG
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Всё внутри captureRef попадёт на картинку */}
        <div ref={captureRef} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          <div className="flex items-baseline justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <h2 className="truncate text-lg font-bold text-zinc-50">{board.name}</h2>
            <span className="shrink-0 text-xs text-zinc-500">
              {filterParts.join(' · ')} · {pluralize(placedCount, TITLE_FORMS)}
            </span>
          </div>
          {resolved.tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              items={containers[tier.id] ?? []}
              itemsByUid={resolved.itemsByUid}
              showTitles={board.showTitles}
              highlighted={activeContainer === tier.id}
              showControls={showControls}
              isFirst={i === 0}
              isLast={i === resolved.tiers.length - 1}
              onEdit={() => setEditingTierId(tier.id)}
              onMove={(dir) => moveTier(tier.id, dir)}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>

        <section className="rounded-xl bg-zinc-900/60 ring-1 ring-white/5">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Inbox size={16} className="text-zinc-500" />
              Нераспределённое
              <span className="text-xs font-normal text-zinc-500 tabular-nums">{containers[POOL_ID].length}</span>
            </h3>
            <div className="relative w-full sm:w-56">
              <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                placeholder="Найти в пуле"
                className="h-8 w-full rounded-lg bg-zinc-950 pr-2 pl-7 text-xs text-zinc-100 ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-violet-500/60"
              />
            </div>
          </header>
          <PoolArea
            id={POOL_ID}
            items={poolItems}
            itemsByUid={resolved.itemsByUid}
            showTitles={board.showTitles}
            highlighted={activeContainer === POOL_ID}
            onOpenItem={onOpenItem}
            empty={
              resolved.itemsByUid.size === 0
                ? 'Под фильтр этого тир-листа пока не подходит ни один тайтл из библиотеки.'
                : needle
                  ? 'В пуле ничего не найдено.'
                  : 'Все тайтлы распределены 🎉'
            }
          />
        </section>

        <DragOverlay>{activeItem ? <TierCard item={activeItem} showTitles={board.showTitles} overlay /> : null}</DragOverlay>
      </DndContext>

      <p className="text-xs text-zinc-600">
        Перетаскивайте постеры мышью (на телефоне — долгое нажатие). Двойной клик по постеру — оценка и заметки. Клик по
        плашке ранга — название и цвет.
      </p>

      {editingTier && (
        <TierEditor
          tier={editingTier}
          canDelete={board.tiers.length > 1}
          onClose={() => setEditingTierId(null)}
          onSave={(values) => saveTier(editingTier.id, values)}
          onClear={() => clearTier(editingTier.id)}
          onDelete={() => deleteTier(editingTier.id)}
        />
      )}
    </div>
  );
}
