/**
 * Состояние данных (то, что сохраняется в localStorage и экспортируется):
 * {
 *   library: LibraryItem[],
 *   tierLists: TierList[],
 *   activeTierListId: string,
 * }
 * Настройки (API-ключи и т.п.) живут отдельно — см. StoreContext.
 */

function removeFromBoard(board, uid) {
  return {
    ...board,
    tiers: board.tiers.map((t) => (t.items.includes(uid) ? { ...t, items: t.items.filter((x) => x !== uid) } : t)),
    unranked: board.unranked.filter((x) => x !== uid),
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'item/add': {
      if (state.library.some((i) => i.uid === action.item.uid)) return state;
      return { ...state, library: [action.item, ...state.library] };
    }

    case 'item/update':
      return {
        ...state,
        library: state.library.map((i) =>
          i.uid === action.uid ? { ...i, ...action.patch, updated_at: Date.now() } : i,
        ),
      };

    case 'item/remove':
      return {
        ...state,
        library: state.library.filter((i) => i.uid !== action.uid),
        tierLists: state.tierLists.map((b) => removeFromBoard(b, action.uid)),
      };

    case 'tierlist/create':
      return { ...state, tierLists: [...state.tierLists, action.board], activeTierListId: action.board.id };

    case 'tierlist/update':
      return {
        ...state,
        tierLists: state.tierLists.map((b) =>
          b.id === action.id ? { ...b, ...action.patch, updated_at: Date.now() } : b,
        ),
      };

    case 'tierlist/delete': {
      let tierLists = state.tierLists.filter((b) => b.id !== action.id);
      if (tierLists.length === 0) tierLists = [action.fallback];
      const activeTierListId =
        state.activeTierListId === action.id || !tierLists.some((b) => b.id === state.activeTierListId)
          ? tierLists[0].id
          : state.activeTierListId;
      return { ...state, tierLists, activeTierListId };
    }

    case 'tierlist/select':
      return { ...state, activeTierListId: action.id };

    case 'data/replace':
      return action.data;

    default:
      return state;
  }
}
