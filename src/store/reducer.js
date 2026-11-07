import { syncMerge } from '../sync/merge.js';
import { mergeData, replaceData } from './storage.js';

/**
 * Состояние данных (то, что сохраняется в localStorage и синхронизируется):
 * {
 *   library: LibraryItem[],
 *   tierLists: TierList[],
 *   activeTierListId: string,
 *   tombstones: { items: { [uid]: ts }, boards: { [id]: ts } },  // отметки удаления для синхронизации
 * }
 * Настройки (API-ключи, токен GitHub) живут отдельно — см. StoreContext.
 */

function removeFromBoard(board, uid) {
  if (!board.unranked.includes(uid) && !board.tiers.some((t) => t.items.includes(uid))) return board;
  return {
    ...board,
    tiers: board.tiers.map((t) => (t.items.includes(uid) ? { ...t, items: t.items.filter((x) => x !== uid) } : t)),
    unranked: board.unranked.filter((x) => x !== uid),
  };
}

function withTombstone(tombstones, kind, id, at) {
  return { ...tombstones, [kind]: { ...tombstones[kind], [id]: at } };
}

function withoutTombstone(tombstones, kind, id) {
  if (tombstones[kind][id] == null) return tombstones;
  const next = { ...tombstones[kind] };
  delete next[id];
  return { ...tombstones, [kind]: next };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'item/add': {
      if (state.library.some((i) => i.uid === action.item.uid)) return state;
      return {
        ...state,
        library: [action.item, ...state.library],
        tombstones: withoutTombstone(state.tombstones, 'items', action.item.uid),
      };
    }

    case 'item/update':
      return {
        ...state,
        library: state.library.map((i) =>
          i.uid === action.uid ? { ...i, ...action.patch, updated_at: action.at } : i,
        ),
      };

    case 'item/remove':
      return {
        ...state,
        library: state.library.filter((i) => i.uid !== action.uid),
        tierLists: state.tierLists.map((b) => removeFromBoard(b, action.uid)),
        tombstones: withTombstone(state.tombstones, 'items', action.uid, action.at),
      };

    case 'tierlist/create':
      return { ...state, tierLists: [...state.tierLists, action.board], activeTierListId: action.board.id };

    case 'tierlist/update':
      return {
        ...state,
        tierLists: state.tierLists.map((b) =>
          b.id === action.id ? { ...b, ...action.patch, updated_at: action.at } : b,
        ),
      };

    case 'tierlist/delete': {
      let tierLists = state.tierLists.filter((b) => b.id !== action.id);
      let tombstones = withTombstone(state.tombstones, 'boards', action.id, action.at);
      if (tierLists.length === 0) {
        tierLists = [action.fallback];
        tombstones = withoutTombstone(tombstones, 'boards', action.fallback.id);
      }
      const activeTierListId =
        state.activeTierListId === action.id || !tierLists.some((b) => b.id === state.activeTierListId)
          ? tierLists[0].id
          : state.activeTierListId;
      return { ...state, tierLists, activeTierListId, tombstones };
    }

    case 'tierlist/select':
      return { ...state, activeTierListId: action.id };

    case 'data/import':
      return action.mode === 'replace'
        ? replaceData(state, action.incoming, action.at)
        : mergeData(state, action.incoming, action.at);

    case 'data/reset':
      return replaceData(state, { library: [], tierLists: [], activeTierListId: null }, action.at);

    case 'sync/merge': {
      const merged = syncMerge(state, action.remote, action.at);
      const activeTierListId = merged.tierLists.some((b) => b.id === state.activeTierListId)
        ? state.activeTierListId
        : merged.tierLists[0].id;
      return { ...merged, activeTierListId };
    }

    default:
      return state;
  }
}
