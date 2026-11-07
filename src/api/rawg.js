import { fetchJson, missingKeyError } from './http.js';

const BASE = 'https://api.rawg.io/api';

/**
 * RAWG отдаёт оригиналы картинок (часто 1–3 МБ). У CDN есть ресайзер:
 * media.rawg.io/media/games/… → media.rawg.io/media/resize/420/-/games/…
 */
function resize(url, width) {
  if (!url || url.includes('/media/resize/')) return url;
  return url.replace('/media/', `/media/resize/${width}/-/`);
}

function normalize(g) {
  const platforms = (g.parent_platforms ?? g.platforms ?? []).map((p) => p.platform?.name).filter(Boolean);
  return {
    id: g.id,
    media_type: 'game',
    title: g.name,
    original_title: null,
    year: g.released ? Number(g.released.slice(0, 4)) || null : null,
    poster_path: resize(g.background_image, 420),
    thumb: resize(g.background_image, 200),
    meta: { platforms, source: 'rawg', url: g.slug ? `https://rawg.io/games/${g.slug}` : null },
  };
}

/** @param {{ apiKey: string, limit?: number, signal?: AbortSignal }} opts */
export async function searchRawg(query, { apiKey, limit = 10, signal }) {
  if (!apiKey?.trim()) throw missingKeyError('RAWG');
  const qs = new URLSearchParams({
    key: apiKey.trim(),
    search: query,
    page_size: String(limit),
    search_precise: 'true',
  });
  const data = await fetchJson(`${BASE}/games?${qs}`, { signal, source: 'RAWG' });
  return (data.results ?? []).map(normalize);
}

export async function testRawgKey(apiKey) {
  if (!apiKey?.trim()) throw missingKeyError('RAWG');
  const qs = new URLSearchParams({ key: apiKey.trim(), page_size: '1' });
  await fetchJson(`${BASE}/games?${qs}`, { source: 'RAWG' });
  return true;
}
