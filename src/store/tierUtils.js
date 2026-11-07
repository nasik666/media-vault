export const POOL_ID = '__pool__';

export function matchesFilter(item, filter) {
  return (
    (filter.mediaType === 'all' || item.media_type === filter.mediaType) &&
    (filter.statuses ?? []).includes(item.status)
  );
}

/**
 * Сводит сохранённую доску с актуальной библиотекой:
 *  - из рангов выкидываются удалённые/не подходящие под фильтр тайтлы;
 *  - всё, что подходит под фильтр и не стоит в ранге, попадает в пул «Нераспределённое»
 *    (новые тайтлы — в начало пула).
 * @returns {{ tiers: {id,label,color,items:string[]}[], unranked: string[], itemsByUid: Map<string, object> }}
 */
export function resolveBoard(board, library) {
  const itemsByUid = new Map();
  for (const item of library) if (matchesFilter(item, board.filter)) itemsByUid.set(item.uid, item);

  const placed = new Set();
  const tiers = board.tiers.map((t) => {
    const items = t.items.filter((uid) => itemsByUid.has(uid) && !placed.has(uid));
    items.forEach((uid) => placed.add(uid));
    return { ...t, items };
  });

  const known = [];
  for (const uid of board.unranked ?? []) {
    if (itemsByUid.has(uid) && !placed.has(uid)) {
      known.push(uid);
      placed.add(uid);
    }
  }

  const fresh = [...itemsByUid.values()]
    .filter((i) => !placed.has(i.uid))
    .sort((a, b) => b.added_at - a.added_at)
    .map((i) => i.uid);

  return { tiers, unranked: [...fresh, ...known], itemsByUid };
}

/** Следующая свободная буква для нового ранга: после D → E, F… */
export function nextTierLabel(tiers) {
  const used = new Set(tiers.map((t) => t.label.toUpperCase()));
  for (const letter of 'SABCDEFGHIJKLMNOPQRTUVWXYZ') if (!used.has(letter)) return letter;
  return `Ранг ${tiers.length + 1}`;
}
