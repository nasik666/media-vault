import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useToast } from '../components/ui/Toast.jsx';
import { reducer } from './reducer.js';
import { createDefaultBoard, createTierList, loadData, loadSettings, saveData, saveSettings } from './storage.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const toast = useToast();
  const [data, dispatch] = useReducer(reducer, undefined, loadData);
  const [settings, setSettings] = useState(loadSettings);
  const quotaWarned = useRef(false);

  // Автосохранение в localStorage при любом изменении данных.
  useEffect(() => {
    try {
      saveData(data);
      quotaWarned.current = false;
    } catch (e) {
      if (!quotaWarned.current) {
        quotaWarned.current = true;
        toast.error(`Не удалось сохранить в localStorage: ${e.message}. Сделайте экспорт в JSON!`);
      }
    }
  }, [data, toast]);

  useEffect(() => {
    try {
      saveSettings(settings);
    } catch {
      /* настройки крошечные, переполнение тут маловероятно */
    }
  }, [settings]);

  // Время правки передаём в action, чтобы редьюсер оставался чистой функцией.
  const actions = useMemo(
    () => ({
      addItem: (item) => dispatch({ type: 'item/add', item }),
      updateItem: (uid, patch) => dispatch({ type: 'item/update', uid, patch, at: Date.now() }),
      removeItem: (uid) => dispatch({ type: 'item/remove', uid, at: Date.now() }),

      createTierList: (opts) => {
        const board = createTierList(opts);
        dispatch({ type: 'tierlist/create', board });
        return board;
      },
      updateTierList: (id, patch) => dispatch({ type: 'tierlist/update', id, patch, at: Date.now() }),
      deleteTierList: (id) =>
        dispatch({ type: 'tierlist/delete', id, at: Date.now(), fallback: { ...createDefaultBoard(), updated_at: Date.now() } }),
      selectTierList: (id) => dispatch({ type: 'tierlist/select', id }),

      /** mode: 'merge' | 'replace' */
      importData: (mode, incoming) => dispatch({ type: 'data/import', mode, incoming, at: Date.now() }),
      resetAll: () => dispatch({ type: 'data/reset', at: Date.now() }),
      /** Слить данные из gist с текущим состоянием (вызывается движком синхронизации). */
      applyRemote: (remote) => dispatch({ type: 'sync/merge', remote, at: Date.now() }),

      updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    }),
    [],
  );

  const libraryByUid = useMemo(() => new Map(data.library.map((i) => [i.uid, i])), [data.library]);

  const value = useMemo(
    () => ({ ...data, libraryByUid, settings, actions }),
    [data, libraryByUid, settings, actions],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** @returns {{ library: object[], tierLists: object[], activeTierListId: string, tombstones: object, libraryByUid: Map<string, object>, settings: object, actions: object }} */
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore() должен вызываться внутри <StoreProvider>');
  return ctx;
}
