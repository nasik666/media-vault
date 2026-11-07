import { DEFAULT_BOARD_STATUSES, DEFAULT_TIERS, MEDIA_TYPES, STATUSES } from '../constants.js';
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
  // Когда менялись синхронизируемые настройки (ключи, язык, источник игр) — для «побеждает свежее».
  settingsUpdatedAt: 0,
  // Синхронизация через GitHub Gist (только этот браузер, в бэкапы и gist не попадает).
  syncToken: '',
  syncGistId: '',
  syncLogin: '',
  syncSettings: true, // синхронизировать ли ключи и настройки вместе с данными
  lastSyncAt: 0,
};

/** Настройки, которые уезжают в gist (если включено syncSettings). */
export const SYNCED_SETTING_KEYS = ['tmdbKey', 'rawgKey', 'gameSource', 'tmdbLanguage', 'animeTitle'];
/** Настройки, которые никогда не попадают ни в бэкап, ни в gist. */
const LOCAL_ONLY_KEYS = ['syncToken', 'syncGistId', 'syncLogin', 'lastSyncAt', 'syncSettings', 'settingsUpdatedAt'];

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

export function createTierList({
  name = 'Новый тир-лист',
  mediaType = 'all',
  statuses = DEFAULT_BOARD_STATUSES,
  showTitles = false,
} = {}) {
  const now = Date.now();
  return {
    id: makeId(),
    name,
    filter: { mediaType, statuses: [...statuses] },
    showTitles,
    tiers: createDefaultTiers(),
    unranked: [],
    created_at: now,
    updated_at: now,
  };
}

/**
 * Тир-лист по умолчанию полностью детерминирован (фиксированные id, нулевые даты):
 * на двух новых устройствах он одинаковый, и синхронизация не плодит дубликаты «Мой тир-лист».
 */
export function createDefaultBoard() {
  return {
    id: 'default',
    name: 'Мой тир-лист',
    filter: { mediaType: 'all', statuses: [...DEFAULT_BOARD_STATUSES] },
    showTitles: false,
    tiers: DEFAULT_TIERS.map((t) => ({ id: `default-${t.label.toLowerCase()}`, label: t.label, color: t.color, items: [] })),
    unranked: [],
    created_at: 0,
    updated_at: 0,
  };
}

export const emptyTombstones = () => ({ items: {}, boards: {} });

export function createInitialData() {
  const board = createDefaultBoard();
  return { library: [], tierLists: [board], activeTierListId: board.id, tombstones: emptyTombstones() };
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
  const now = Date.now();
  const createdAt = toTimestamp(raw.created_at, now);
  const updatedAt = toTimestamp(raw.updated_at, now);

  // Статусы: новый формат — массив filter.statuses; старый — одиночный filter.status ('any' = все).
  let statuses;
  if (Array.isArray(raw.filter?.statuses)) {
    statuses = STATUSES.filter((s) => raw.filter.statuses.includes(s));
  } else if (STATUSES.includes(raw.filter?.status)) {
    statuses = [raw.filter.status];
  } else {
    statuses = [...STATUSES];
  }
  // Нетронутый тир-лист по умолчанию получает новый набор статусов по умолчанию.
  if (raw.id === 'default' && updatedAt === 0) statuses = [...DEFAULT_BOARD_STATUSES];
  if (statuses.length === 0) statuses = [...STATUSES];

  return {
    id: isStr(raw.id) && raw.id ? raw.id : makeId(),
    name: isStr(raw.name) && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Тир-лист',
    filter: {
      mediaType: mediaType === 'all' || MEDIA_TYPES[mediaType] ? mediaType : 'all',
      statuses,
    },
    showTitles: Boolean(raw.showTitles),
    tiers: tiers.length ? tiers : createDefaultTiers(),
    unranked: strArray(raw.unranked),
    created_at: createdAt,
    updated_at: updatedAt,
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
  if (ensureBoard && tierLists.length === 0) tierLists = [createDefaultBoard()];

  const activeTierListId = tierLists.some((b) => b.id === raw?.activeTierListId)
    ? raw.activeTierListId
    : (tierLists[0]?.id ?? null);

  return { library: [...byUid.values()], tierLists, activeTierListId, tombstones: sanitizeTombstones(raw?.tombstones) };
}

/** Отметки удаления для синхронизации: { items: { uid: время }, boards: { id: время } }. */
export function sanitizeTombstones(raw) {
  const clean = (obj) => {
    const out = {};
    if (obj && typeof obj === 'object') {
      for (const [key, ts] of Object.entries(obj)) if (key && Number.isFinite(ts)) out[key] = ts;
    }
    return out;
  };
  return { items: clean(raw?.items), boards: clean(raw?.boards) };
}

/**
 * includeLocal — принимать ли поля, живущие только в этом браузере (токен GitHub и т.п.).
 * Для импорта из файла и данных из gist — false.
 */
export function sanitizeSettings(raw, { includeLocal = false } = {}) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  if (isStr(raw.tmdbKey)) out.tmdbKey = raw.tmdbKey.trim();
  if (isStr(raw.rawgKey)) out.rawgKey = raw.rawgKey.trim();
  if (raw.tmdbLanguage === 'ru-RU' || raw.tmdbLanguage === 'en-US') out.tmdbLanguage = raw.tmdbLanguage;
  if (['english', 'romaji', 'native'].includes(raw.animeTitle)) out.animeTitle = raw.animeTitle;
  if (raw.gameSource === 'wikipedia' || raw.gameSource === 'rawg') out.gameSource = raw.gameSource;
  if (['all', ...Object.keys(MEDIA_TYPES)].includes(raw.searchCategory)) out.searchCategory = raw.searchCategory;
  if (includeLocal) {
    if (isStr(raw.syncToken)) out.syncToken = raw.syncToken.trim();
    if (isStr(raw.syncGistId) && /^[0-9a-f]*$/i.test(raw.syncGistId)) out.syncGistId = raw.syncGistId;
    if (isStr(raw.syncLogin)) out.syncLogin = raw.syncLogin;
    if (typeof raw.syncSettings === 'boolean') out.syncSettings = raw.syncSettings;
    if (Number.isFinite(raw.lastSyncAt)) out.lastSyncAt = raw.lastSyncAt;
    if (Number.isFinite(raw.settingsUpdatedAt)) out.settingsUpdatedAt = raw.settingsUpdatedAt;
  }
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
  return { ...DEFAULT_SETTINGS, ...sanitizeSettings(readJson(SETTINGS_KEY), { includeLocal: true }) };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* ------------------------------------------------------------------ */
/* Бэкап (экспорт / импорт JSON)                                       */
/* ------------------------------------------------------------------ */

export function buildBackup(data, settings, { includeKeys = false } = {}) {
  const { tmdbKey, rawgKey, ...rest } = settings;
  // Токен GitHub и прочие локальные поля не попадают в файл никогда.
  const publicSettings = Object.fromEntries(Object.entries(rest).filter(([key]) => !LOCAL_ONLY_KEYS.includes(key)));
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
  const settings = sanitizeSettings(raw.settings); // без токена GitHub и прочих локальных полей
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

/**
 * Импортированные записи — осознанное восстановление: если тайтл или тир-лист
 * когда-то удаляли, снимаем отметку удаления и делаем запись «свежее» её,
 * иначе синхронизация сразу удалит восстановленное снова.
 */
function revive(library, tierLists, tombstones, now) {
  const tomb = { items: { ...tombstones.items }, boards: { ...tombstones.boards } };
  const lib = library.map((i) => {
    if (tomb.items[i.uid] == null) return i;
    delete tomb.items[i.uid];
    return { ...i, updated_at: Math.max(i.updated_at, now) };
  });
  const boards = tierLists.map((b) => {
    if (tomb.boards[b.id] == null) return b;
    delete tomb.boards[b.id];
    return { ...b, updated_at: Math.max(b.updated_at, now) };
  });
  return { library: lib, tierLists: boards, tombstones: tomb };
}

/** Импорт «Объединить»: тайтлы по uid (побеждает более свежий updated_at), тир-листы по id. */
export function mergeData(current, incoming, now = Date.now()) {
  const library = new Map(current.library.map((i) => [i.uid, i]));
  for (const item of incoming.library) {
    const existing = library.get(item.uid);
    if (!existing || item.updated_at >= existing.updated_at) library.set(item.uid, item);
  }
  const boards = new Map(current.tierLists.map((b) => [b.id, b]));
  for (const b of incoming.tierLists) boards.set(b.id, b);
  return {
    ...revive([...library.values()], [...boards.values()], current.tombstones ?? emptyTombstones(), now),
    activeTierListId: current.activeTierListId,
  };
}

/**
 * Импорт «Заменить всё» и очистка: всё, что было и исчезло, помечается удалённым —
 * иначе синхронизация вернёт это с других устройств.
 */
export function replaceData(current, incoming, now = Date.now()) {
  const tomb = {
    items: { ...(current.tombstones?.items ?? {}) },
    boards: { ...(current.tombstones?.boards ?? {}) },
  };
  const keepItems = new Set(incoming.library.map((i) => i.uid));
  for (const i of current.library) if (!keepItems.has(i.uid)) tomb.items[i.uid] = now;
  const keepBoards = new Set(incoming.tierLists.map((b) => b.id));
  for (const b of current.tierLists) if (!keepBoards.has(b.id)) tomb.boards[b.id] = now;

  const tierLists = incoming.tierLists.length ? incoming.tierLists : [createDefaultBoard()];
  const activeTierListId = tierLists.some((b) => b.id === incoming.activeTierListId)
    ? incoming.activeTierListId
    : tierLists[0].id;
  return { ...revive(incoming.library, tierLists, tomb, now), activeTierListId };
}
