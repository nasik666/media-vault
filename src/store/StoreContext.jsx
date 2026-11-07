import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useToast } from '../components/ui/Toast.jsx';
import { reducer } from './reducer.js';
import {
  createInitialData,
  createTierList,
  loadData,
  loadSettings,
  saveData,
  saveSettings,
} from './storage.js';

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

  const actions = useMemo(
    () => ({
      addItem: (item) => dispatch({ type: 'item/add', item }),
      updateItem: (uid, patch) => dispatch({ type: 'item/update', uid, patch }),
      removeItem: (uid) => dispatch({ type: 'item/remove', uid }),

      createTierList: (opts) => {
        const board = createTierList(opts);
        dispatch({ type: 'tierlist/create', board });
        return board;
      },
      updateTierList: (id, patch) => dispatch({ type: 'tierlist/update', id, patch }),
      deleteTierList: (id) =>
        dispatch({ type: 'tierlist/delete', id, fallback: createTierList({ name: 'Мой тир-лист' }) }),
      selectTierList: (id) => dispatch({ type: 'tierlist/select', id }),

      replaceData: (next) => dispatch({ type: 'data/replace', data: next }),
      resetAll: () => dispatch({ type: 'data/replace', data: createInitialData() }),

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

/** @returns {{ library: object[], tierLists: object[], activeTierListId: string, libraryByUid: Map<string, object>, settings: object, actions: object }} */
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore() должен вызываться внутри <StoreProvider>');
  return ctx;
}
