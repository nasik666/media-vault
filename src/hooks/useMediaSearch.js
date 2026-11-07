import { useEffect, useState } from 'react';
import { searchMedia } from '../api/search.js';
import { isAbortError } from '../api/http.js';
import { useStore } from '../store/StoreContext.jsx';

export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Небольшой кэш на сессию: бережёт лимиты API при повторных запросах.
const cache = new Map();
const CACHE_LIMIT = 60;

function cacheSet(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

const EMPTY = { loading: false, results: [], errors: [] };

/** Дебаунс 400 мс + отмена устаревших запросов через AbortController. */
export function useMediaSearch(query, category) {
  const { settings } = useStore();
  const { tmdbKey, rawgKey, tmdbLanguage, animeTitle, gameSource } = settings;
  const debounced = useDebounce(query.trim(), 400);
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (debounced.length < 2) {
      setState(EMPTY);
      return undefined;
    }
    const key = [category, debounced.toLowerCase(), tmdbLanguage, animeTitle, gameSource, Boolean(tmdbKey), Boolean(rawgKey)].join('|');
    const cached = cache.get(key);
    if (cached) {
      setState({ loading: false, ...cached });
      return undefined;
    }

    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    searchMedia(debounced, category, { tmdbKey, rawgKey, tmdbLanguage, animeTitle, gameSource }, controller.signal)
      .then((res) => {
        // Ошибки не кэшируем — пользователь мог как раз поправить ключ.
        if (res.errors.length === 0) cacheSet(key, res);
        setState({ loading: false, ...res });
      })
      .catch((e) => {
        if (!isAbortError(e)) setState({ loading: false, results: [], errors: [{ type: 'all', message: e.message }] });
      });
    return () => controller.abort();
  }, [debounced, category, tmdbKey, rawgKey, tmdbLanguage, animeTitle, gameSource]);

  return { ...state, pending: query.trim() !== debounced };
}
