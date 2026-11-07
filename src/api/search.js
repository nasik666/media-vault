import { isAbortError } from './http.js';
import { searchAnilist } from './anilist.js';
import { searchRawg } from './rawg.js';
import { searchTmdb } from './tmdb.js';
import { searchWikipediaGames } from './wikipedia.js';

const SOURCES = {
  movie: (q, s, opts) => searchTmdb(q, 'movie', { apiKey: s.tmdbKey, language: s.tmdbLanguage, ...opts }),
  tv: (q, s, opts) => searchTmdb(q, 'tv', { apiKey: s.tmdbKey, language: s.tmdbLanguage, ...opts }),
  // Игры: по умолчанию Википедия (без ключа), RAWG — по выбору в настройках.
  game: (q, s, opts) =>
    s.gameSource === 'rawg'
      ? searchRawg(q, { apiKey: s.rawgKey, ...opts })
      : searchWikipediaGames(q, { language: s.tmdbLanguage, ...opts }),
  anime: (q, s, opts) => searchAnilist(q, { titleLang: s.animeTitle, ...opts }),
};

/**
 * Единый поиск. category = 'all' | 'movie' | 'tv' | 'game' | 'anime'.
 * Источники опрашиваются параллельно; падение одного не ломает остальные.
 * @returns {Promise<{ results: object[], errors: { type: string, message: string, code?: string }[] }>}
 */
export async function searchMedia(query, category, settings, signal) {
  const types = category === 'all' ? Object.keys(SOURCES) : [category];
  const limit = category === 'all' ? 5 : 12;

  const settled = await Promise.allSettled(types.map((t) => SOURCES[t](query, settings, { limit, signal })));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const results = [];
  const errors = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') results.push(...r.value);
    else if (!isAbortError(r.reason)) {
      errors.push({ type: types[i], message: r.reason?.message ?? 'Неизвестная ошибка', code: r.reason?.code });
    }
  });

  // В режиме «Все» TMDB-ошибка «нет ключа» придёт дважды (фильмы + сериалы) — схлопываем.
  const seen = new Set();
  const uniqueErrors = errors.filter((e) => (seen.has(e.message) ? false : seen.add(e.message)));

  return { results, errors: uniqueErrors };
}
