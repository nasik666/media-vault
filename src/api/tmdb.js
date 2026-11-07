import { fetchJson, missingKeyError } from './http.js';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

/**
 * TMDB принимает два вида ключей:
 *  - v3 «API Key» (32 hex-символа) → параметр ?api_key=
 *  - v4 «API Read Access Token» (JWT, начинается с eyJ) → заголовок Authorization: Bearer
 */
function auth(apiKey) {
  const key = apiKey.trim();
  if (key.startsWith('eyJ')) {
    return { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, params: {} };
  }
  return { headers: { Accept: 'application/json' }, params: { api_key: key } };
}

function normalize(r, type) {
  const isMovie = type === 'movie';
  const date = isMovie ? r.release_date : r.first_air_date;
  return {
    id: r.id,
    media_type: type,
    title: (isMovie ? r.title : r.name) || (isMovie ? r.original_title : r.original_name),
    original_title: isMovie ? r.original_title : r.original_name,
    year: date ? Number(date.slice(0, 4)) || null : null,
    poster_path: r.poster_path ? `${IMG}/w342${r.poster_path}` : null,
    thumb: r.poster_path ? `${IMG}/w92${r.poster_path}` : null,
    meta: {},
  };
}

/**
 * Поиск фильмов или сериалов.
 * @param {string} query
 * @param {'movie'|'tv'} type
 * @param {{ apiKey: string, language?: string, limit?: number, signal?: AbortSignal }} opts
 */
export async function searchTmdb(query, type, { apiKey, language = 'ru-RU', limit = 10, signal }) {
  if (!apiKey?.trim()) throw missingKeyError('TMDB');
  const { headers, params } = auth(apiKey);
  const qs = new URLSearchParams({ query, language, include_adult: 'false', page: '1', ...params });
  const data = await fetchJson(`${BASE}/search/${type}?${qs}`, { headers, signal, source: 'TMDB' });
  return (data.results ?? []).slice(0, limit).map((r) => normalize(r, type));
}

/** Проверка ключа: GET /authentication отвечает 200 для валидного v3-ключа или v4-токена. */
export async function testTmdbKey(apiKey) {
  if (!apiKey?.trim()) throw missingKeyError('TMDB');
  const { headers, params } = auth(apiKey);
  const qs = new URLSearchParams(params);
  await fetchJson(`${BASE}/authentication?${qs}`, { headers, source: 'TMDB' });
  return true;
}
