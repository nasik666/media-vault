import { ApiError, fetchJson } from './http.js';

/**
 * Поиск игр по Википедии — без ключа, CORS разрешён (origin=*).
 *
 * - Фильтр hastemplate оставляет только статьи с инфобоксом игры, так что книги,
 *   фильмы и персонажи с тем же названием в выдачу не попадают.
 * - Название на втором языке берётся из межъязыковой ссылки статьи (langlinks):
 *   «Ведьмак (игра)» ↔ «The Witcher (video game)».
 * - Кириллический запрос ищем только в русской Википедии, латинский — в обеих;
 *   результаты склеиваются по ID Викиданных (Q…).
 */
const INFOBOX = {
  en: 'Infobox video game',
  ru: 'Компьютерная игра',
};
const OTHER = { ru: 'en', en: 'ru' };

/** «Ведьмак (игра)» → «Ведьмак», «Doom (2016 video game)» → «Doom». */
function cleanTitle(title) {
  return title.replace(/\s*\(([^)]*(?:game|игра)[^)]*)\)\s*$/i, '').trim();
}

/** Год из краткого описания: «2017 video game», «компьютерная игра 2007 года». */
function extractYear(description) {
  const m = /(?:^|\D)(19[5-9]\d|20\d\d)(?!\d)/.exec(description ?? '');
  return m ? Number(m[1]) : null;
}

/** Убираем utm-метки из ссылки на картинку. */
function cleanImage(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.search = '';
    return u.href;
  } catch {
    return null;
  }
}

/** Сравнение названий без учёта регистра и вида апострофов («Baldur's» = «Baldur’s»). */
const sameTitle = (a, b) => a.toLowerCase().replace(/[’`ʼ]/g, "'") === b.toLowerCase().replace(/[’`ʼ]/g, "'");

async function searchLanguage(lang, query, limit, signal) {
  const qs = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} hastemplate:"${INFOBOX[lang]}"`,
    gsrlimit: String(limit),
    gsrnamespace: '0',
    prop: 'pageimages|description|pageprops|langlinks',
    ppprop: 'wikibase_item',
    pilicense: 'any', // иначе обложки (несвободные файлы) не отдаются
    piprop: 'thumbnail',
    pithumbsize: '400',
    lllang: OTHER[lang],
    lllimit: 'max',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const data = await fetchJson(`https://${lang}.wikipedia.org/w/api.php?${qs}`, { signal, source: 'Википедия' });
  if (data.error) throw new ApiError(`Википедия: ${data.error.info}`, { source: 'Википедия' });

  return (data.query?.pages ?? [])
    .sort((a, b) => a.index - b.index)
    .map((p) => {
      const titles = { [lang]: cleanTitle(p.title) };
      const link = p.langlinks?.[0]?.title;
      if (link) titles[OTHER[lang]] = cleanTitle(link);
      return {
        lang,
        key: p.pageprops?.wikibase_item ?? `${lang}-${p.pageid}`,
        titles,
        year: extractYear(p.description),
        image: cleanImage(p.thumbnail?.source),
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
      };
    });
}

/**
 * @param {string} query
 * @param {{ language?: string, limit?: number, signal?: AbortSignal }} opts
 *   language — 'ru-RU' | 'en-US': какое название показывать основным.
 */
export async function searchWikipediaGames(query, { language = 'ru-RU', limit = 10, signal } = {}) {
  const preferred = language.startsWith('ru') ? 'ru' : 'en';
  const cyrillic = /[а-яё]/i.test(query);
  // Кириллицу ищем только в ruwiki; латиницу — в обеих, «своя» Википедия первой.
  const langs = cyrillic ? ['ru'] : [preferred, OTHER[preferred]];

  const settled = await Promise.allSettled(langs.map((l) => searchLanguage(l, query, limit, signal)));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (settled.every((s) => s.status === 'rejected')) throw settled[0].reason;

  const merged = new Map();
  settled.forEach((s, langIndex) => {
    (s.value ?? []).forEach((r, index) => {
      const entry = merged.get(r.key) ?? { key: r.key, score: Infinity, titles: {}, images: {}, url: null, year: null };
      // Название статьи надёжнее межъязыковой ссылки — оно перезаписывает её.
      entry.titles = langIndex === 0 ? { ...entry.titles, ...r.titles } : { ...r.titles, ...entry.titles };
      entry.titles[r.lang] = r.titles[r.lang];
      entry.images[r.lang] = r.image;
      entry.year ??= r.year;
      entry.url ??= r.url;
      entry.score = Math.min(entry.score, index + langIndex * 0.5);
      merged.set(r.key, entry);
    });
  });

  return [...merged.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => {
      const title = entry.titles[preferred] ?? entry.titles[OTHER[preferred]];
      const alt = entry.titles[preferred] ? entry.titles[OTHER[preferred]] : null;
      // Обложки в английской Википедии обычно есть чаще и лучше качеством.
      const image = entry.images.en ?? entry.images.ru ?? null;
      return {
        id: entry.key,
        media_type: 'game',
        title,
        original_title: alt && !sameTitle(alt, title) ? alt : null,
        year: entry.year,
        poster_path: image,
        thumb: image,
        meta: { source: 'wikipedia', url: entry.url },
      };
    });
}
