import { useEffect, useState } from 'react';

/** useState, который помнит значение в localStorage (для UI-мелочей: фильтры, сортировка). */
export function usePersistentState(key, initial) {
  const storageKey = `mediavault:ui:${key}`;
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* приватный режим и т.п. — не критично */
    }
  }, [storageKey, value]);

  return [value, setValue];
}
