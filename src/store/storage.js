import { DEFAULT_TIERS, MEDIA_TYPES, STATUSES } from '../constants.js';
import { makeId } from '../utils/helpers.js';

const DATA_KEY = 'mediavault:data:v1';
const SETTINGS_KEY = 'mediavault:settings:v1';
export const BACKUP_VERSION = 1;

export const DEFAULT_SETTINGS = {
  tmdbKey: '',
  rawgKey: '',
  tmdbLanguage: 'ru-RU', // 'ru-RU' | 'en-US' — язык названий в TMDB и Википедии
  gameSource: 'wikipedia', // 'wikipedia' (без ключа) | 'rawg'
  animeTitle: 'english', // 'english' | 'romaji' | 'native'
  searchCategory: 'all',
};

/* ------------------------------------------------------------------ */
/* Фабрики                                                             */
/* ------------------------------------------------------------------ */

/** Превращает результат поиска в запись библиотеки. */
export function createLibraryItem(result, { status = 'Planned', user_rating = null, notes = '' } = {}) {
  const now = Date.now();
  return {
    uid: `${result.media_type}:${result.id}`,
    id: result.id,
    media_type: result.media_type,
    title: result.title,
    original_title: result.original_title ?? null,
    poster_path: result.poster_path ?? null,
    year: result.year ?? null,
    user_rating,
    status,
    notes,
    added_at: now,
    updated_at: now,
    meta: result.meta ?? {},
  };
}

export function createDefaultTiers() {
  return DEFAULT_TIERS.map((t) => ({ id: makeId(), label: t.label, color: t.color, items: [] }));
}

export function createTierList({ name = 'Новый тир-лист', mediaType = 'all', status = 'any', showTitles = false } = {}) {
  const now = Date.now();
  return {
    id: makeId(),
    name,
    filter: { mediaType, status },
    showTitles,
    tiers: createDefaultTiers(),
    unranked: [],
    created_at: now,
    updated_at: now,
  };
}

export function createInitialData() {
  const board = createTierList({ name: 'Мой тир-лист' });
  return { library: [], tierLists: [board], activeTierListId: board.id };
}

/* ------------------------------------------------------------------ */
/* Санитайзеры — всё, что приходит из localStorage или JSON-файла,     */
/* проходит через них. Битые записи отбрасываются, а не роняют app.    */
/* ------------------------------------------------------------------ */

const isStr = (v) => typeof v === 'string';
const HEX = /^#[0-9a-f]{6}$/i;

function safeUrl(v) {
  if (!isStr(v) || !v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

function toTimestamp(v, fallback) {
  if (Number.isFinite(v)) return v;
  if (isStr(v)) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return fallback;
}

const strArray = (v) => (Array.isArray(v) ? [...new Set(v.filter(isStr))] : []);

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  if (Array.isArray(meta.platforms)) out.platforms = meta.platforms.filter(isStr).slice(0, 12);
  if (isStr(meta.format)) out.format = meta.format;
  if (Number.isFinite(meta.episodes)) out.episodes = meta.episodes;
  if (['tmdb', 'rawg', 'anilist', 'wikipedia', 'manual'].includes(meta.source)) out.source = meta.source;
  const url = safeUrl(meta.url);
  if (url) out.url = url;
  return out;
}

export function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { media_type } = raw;
  if (!MEDIA_TYPES[media_type]) return null;
  if (!(Number.isFinite(raw.id) || (isStr(raw.id) && raw.id))) return null;
  const title = isStr(raw.title) ? raw.title.trim() : '';
  if (!title) return null;

  const rating = Number(raw.user_rating);
  const year = Number(raw.year);
  const added = toTimestamp(raw.added_at, Date.now());

  return {
    uid: `${media_type}:${raw.id}`,
    id: raw.id,
    media_type,
    title,
    original_title: isStr(raw.original_title) && raw.original_title ? raw.original_title : null,
    poster_path: safeUrl(raw.poster_path),
    year: Number.isInteger(year) && year > 1800 && year < 3000 ? year : null,
    user_rating: raw.user_rating != null && rating >= 1 && rating <= 10 ? Math.round(rating) : null,
    status: STATUSES.includes(raw.status) ? raw.status : 'Planned',
    notes: isStr(raw.notes) ? raw.notes : '',
    added_at: added,
    updated_at: toTimestamp(raw.updated_at, added),
    meta: sanitizeMeta(raw.meta),
  };
}

export function sanitizeTierList(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const seenTierIds = new Set();
  const tiers = (Array.isArray(raw.tiers) ? raw.tiers : [])
    .filter((t) => t && typeof t === 'object')
    .map((t) => {
      let id = isStr(t.id) && t.id ? t.id : makeId();
      if (seenTierIds.has(id)) id = makeId();
      seenTierIds.add(id);
      return {
        id,
        label: isStr(t.label) ? t.label.slice(0, 40) : '?',
        color: isStr(t.color) && HEX.test(t.color) ? t.color : '#a1a1aa',
        items: strArray(t.items),
      };
    });

  const mediaType = raw.filter?.mediaType;
  const status = raw.filter?.status;
  const now = Date.now();

  return {
    id: isStr(raw.id) && raw.id ? raw.id : makeId(),
    name: isStr(raw.name) && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Тир-лист',
    filter: {
      mediaType: mediaType === 'all' || MEDIA_TYPES[mediaType] ? mediaType : 'all',
      status: status === 'any' || STATUSES.includes(status) ? status : 'any',
    },
    showTitles: Boolean(raw.showTitles),
    tiers: tiers.length ? tiers : createDefaultTiers(),
    unranked: strArray(raw.unranked),
    created_at: toTimestamp(raw.created_at, now),
    updated_at: toTimestamp(raw.updated_at, now),
  };
}

/** Чистит весь объект данных. ensureBoard — гарантировать хотя бы один тир-лист. */
export function normalizeData(raw, { ensureBoard = true } = {}) {
  const byUid = new Map();
  for (const item of Array.isArray(raw?.library) ? raw.library : []) {
    const clean = sanitizeItem(item);
    if (clean) byUid.set(clean.uid, clean);
  }

  const boards = new Map();
  for (const board of Array.isArray(raw?.tierLists) ? raw.tierLists : []) {
    const clean = sanitizeTierList(board);
    if (clean) boards.set(clean.id, clean);
  }
  let tierLists = [...boards.values()];
  if (ensureBoard && tierLists.length === 0) tierLists = [createTierList({ name: 'Мой тир-лист' })];

  const activeTierListId = tierLists.some((b) => b.id === raw?.activeTierListId)
    ? raw.activeTierListId
    : (tierLists[0]?.id ?? null);

  return { library: [...byUid.values()], tierLists, activeTierListId };
}

export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  if (isStr(raw.tmdbKey)) out.tmdbKey = raw.tmdbKey.trim();
  if (isStr(raw.rawgKey)) out.rawgKey = raw.rawgKey.trim();
  if (raw.tmdbLanguage === 'ru-RU' || raw.tmdbLanguage === 'en-US') out.tmdbLanguage = raw.tmdbLanguage;
  if (['english', 'romaji', 'native'].includes(raw.animeTitle)) out.animeTitle = raw.animeTitle;
  if (raw.gameSource === 'wikipedia' || raw.gameSource === 'rawg') out.gameSource = raw.gameSource;
  if (['all', ...Object.keys(MEDIA_TYPES)].includes(raw.searchCategory)) out.searchCategory = raw.searchCategory;
  return out;
}

/* ------------------------------------------------------------------ */
/* localStorage                                                        */
/* ------------------------------------------------------------------ */

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadData() {
  const raw = readJson(DATA_KEY);
  return raw ? normalizeData(raw) : createInitialData();
}

/** Бросает исключение при переполнении квоты — вызывающий код показывает тост. */
export function saveData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...sanitizeSettings(readJson(SETTINGS_KEY)) };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* ------------------------------------------------------------------ */
/* Бэкап (экспорт / импорт JSON)                                       */
/* ------------------------------------------------------------------ */

export function buildBackup(data, settings, { includeKeys = false } = {}) {
  const { tmdbKey, rawgKey, ...publicSettings } = settings;
  return {
    app: 'MediaVault',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    library: data.library,
    tierLists: data.tierLists,
    activeTierListId: data.activeTierListId,
    settings: includeKeys ? { ...publicSettings, tmdbKey, rawgKey } : publicSettings,
  };
}

/** Разбирает текст файла. Бросает Error с понятным сообщением. */
export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('файл не является корректным JSON');
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.library)) {
    throw new Error('это не бэкап MediaVault — нет массива "library"');
  }
  const data = normalizeData(raw, { ensureBoard: false });
  const settings = sanitizeSettings(raw.settings);
  // Пустые ключи из файла не должны затирать уже сохранённые.
  if (!settings.tmdbKey) delete settings.tmdbKey;
  if (!settings.rawgKey) delete settings.rawgKey;
  return {
    data,
    settings,
    hasKeys: Boolean(settings.tmdbKey || settings.rawgKey),
    skipped: raw.library.length - data.library.length,
  };
}

/** Объединение: тайтлы по uid (побеждает более свежий updated_at), тир-листы по id. */
export function mergeData(current, incoming) {
  const library = new Map(current.library.map((i) => [i.uid, i]));
  for (const item of incoming.library) {
    const existing = library.get(item.uid);
    if (!existing || item.updated_at >= existing.updated_at) library.set(item.uid, item);
  }
  const boards = new Map(current.tierLists.map((b) => [b.id, b]));
  for (const b of incoming.tierLists) boards.set(b.id, b);
  return {
    library: [...library.values()],
    tierLists: [...boards.values()],
    activeTierListId: current.activeTierListId,
  };
}
