import { createDefaultBoard, emptyTombstones, sanitizeSettings, SYNCED_SETTING_KEYS } from '../store/storage.js';

/** Отметки удаления старше года больше не нужны — все устройства давно их увидели. */
const TOMBSTONE_TTL = 365 * 24 * 60 * 60 * 1000;

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

/** Из двух версий одной записи берём более свежую; при равных датах — детерминированно (одинаково на всех устройствах). */
function newer(a, b) {
  if (a.updated_at !== b.updated_at) return a.updated_at > b.updated_at ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function mergeTombstoneMaps(a = {}, b = {}, now) {
  const out = {};
  for (const [key, ts] of [...Object.entries(a), ...Object.entries(b)]) {
    if (now - ts > TOMBSTONE_TTL) continue;
    out[key] = Math.max(out[key] ?? 0, ts);
  }
  return out;
}

function mergeById(localList, remoteList, getId, tombstones) {
  const byId = new Map();
  for (const rec of [...localList, ...remoteList]) {
    const id = getId(rec);
    const existing = byId.get(id);
    byId.set(id, existing ? newer(existing, rec) : rec);
  }
  const result = [];
  for (const [id, rec] of byId) {
    const deletedAt = tombstones[id];
    if (deletedAt != null && deletedAt >= rec.updated_at) continue; // удалено позже последней правки
    if (deletedAt != null) delete tombstones[id]; // запись правили/добавили заново после удаления
    result.push(rec);
  }
  return result;
}

/** Канонический порядок, чтобы одинаковые данные давали одинаковый JSON на всех устройствах. */
function sortLibrary(list) {
  return list.sort((a, b) => b.added_at - a.added_at || collator.compare(a.uid, b.uid));
}
function sortBoards(list) {
  return list.sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Слияние локальных данных с данными из gist.
 * Тайтлы — по uid, тир-листы — по id: побеждает более свежий updated_at.
 * Удаления распространяются через tombstones и побеждают правки, сделанные до удаления.
 * @returns {{ library, tierLists, tombstones }}
 */
export function syncMerge(local, remote, now = Date.now()) {
  const lt = local.tombstones ?? emptyTombstones();
  const rt = remote?.tombstones ?? emptyTombstones();
  const tombstones = {
    items: mergeTombstoneMaps(lt.items, rt.items, now),
    boards: mergeTombstoneMaps(lt.boards, rt.boards, now),
  };

  const library = sortLibrary(
    mergeById(local.library, remote?.library ?? [], (i) => i.uid, tombstones.items),
  );
  let tierLists = sortBoards(
    mergeById(local.tierLists, remote?.tierLists ?? [], (b) => b.id, tombstones.boards),
  );
  if (tierLists.length === 0) tierLists = [createDefaultBoard()];

  return { library, tierLists, tombstones };
}

function sortedObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Стабильная строка для сравнения «изменилось ли что-то» (без activeTierListId — он у каждого устройства свой). */
export function canonical(data) {
  const t = data.tombstones ?? emptyTombstones();
  return JSON.stringify({
    library: sortLibrary([...data.library]),
    tierLists: sortBoards([...data.tierLists]),
    tombstones: { items: sortedObject(t.items), boards: sortedObject(t.boards) },
  });
}

/* ------------------------------------------------------------------ */
/* Настройки (ключи API, язык, источник игр)                           */
/* ------------------------------------------------------------------ */

const pickSynced = (obj) => Object.fromEntries(SYNCED_SETTING_KEYS.map((k) => [k, obj?.[k] ?? '']));

/**
 * Слияние синхронизируемых настроек: побеждает более свежий settingsUpdatedAt.
 * При равенстве (например, оба устройства ни разу не сохраняли настройки) —
 * по каждому полю: непустое побеждает пустое, иначе берём значение из gist.
 * Так устройство без ключей никогда не затирает ключи, введённые на другом.
 * @returns {{ values: object, updated_at: number }}
 */
export function mergeSyncedSettings(local, remote) {
  const mine = { values: pickSynced(local), updated_at: local.settingsUpdatedAt || 0 };
  if (!remote || typeof remote !== 'object') return mine;
  const theirs = {
    values: { ...mine.values, ...sanitizeSettings(remote) },
    updated_at: Number.isFinite(remote.updated_at) ? remote.updated_at : 0,
  };
  // sanitizeSettings мог не вернуть поля — подставляем свои, а не пустоту.
  theirs.values = pickSynced(theirs.values);
  if (theirs.updated_at > mine.updated_at) return theirs;
  if (theirs.updated_at < mine.updated_at) return mine;
  const values = {};
  for (const k of SYNCED_SETTING_KEYS) {
    const l = mine.values[k];
    const r = remote[k] ?? '';
    values[k] = l && r ? theirs.values[k] : l || theirs.values[k];
  }
  return { values, updated_at: mine.updated_at };
}

/** Строка для сравнения настроек в gist и у нас. */
export function settingsSnapshot(snap) {
  if (!snap) return 'null';
  return JSON.stringify({ ...pickSynced(snap.values ?? snap), updated_at: snap.updated_at ?? 0 });
}
