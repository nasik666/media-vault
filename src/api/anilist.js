import { ApiError, fetchJson } from './http.js';

const ENDPOINT = 'https://graphql.anilist.co';

// Ключ не нужен. Лимит AniList — ~30–90 запросов в минуту, поэтому поиск дебаунсится и кэшируется.
const SEARCH_QUERY = /* GraphQL */ `
  query ($search: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
        id
        title { romaji english native }
        format
        episodes
        seasonYear
        startDate { year }
        coverImage { large medium }
      }
    }
  }
`;

function pickTitle(title, preference) {
  const order =
    preference === 'romaji'
      ? [title.romaji, title.english, title.native]
      : preference === 'native'
        ? [title.native, title.romaji, title.english]
        : [title.english, title.romaji, title.native];
  return order.find(Boolean) ?? 'Без названия';
}

/** @param {{ titleLang?: 'english'|'romaji'|'native', limit?: number, signal?: AbortSignal }} opts */
export async function searchAnilist(query, { titleLang = 'english', limit = 10, signal } = {}) {
  const data = await fetchJson(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query, perPage: limit } }),
    signal,
    source: 'AniList',
  });
  if (data.errors?.length) {
    throw new ApiError(`AniList: ${data.errors[0].message}`, { source: 'AniList' });
  }
  return (data.data?.Page?.media ?? []).map((m) => {
    const title = pickTitle(m.title, titleLang);
    const original = m.title.native || m.title.romaji;
    return {
      id: m.id,
      media_type: 'anime',
      title,
      original_title: original && original !== title ? original : null,
      year: m.seasonYear ?? m.startDate?.year ?? null,
      poster_path: m.coverImage?.large ?? null,
      thumb: m.coverImage?.medium ?? m.coverImage?.large ?? null,
      meta: { format: m.format ?? null, episodes: m.episodes ?? null },
    };
  });
}
