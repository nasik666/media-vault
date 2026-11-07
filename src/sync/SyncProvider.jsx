import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/ui/Toast.jsx';
import { useStore } from '../store/StoreContext.jsx';
import { normalizeData, SYNCED_SETTING_KEYS } from '../store/storage.js';
import { pluralize, TITLE_FORMS } from '../utils/helpers.js';
import { createGist, findGist, getUser, readGist, writeGist } from './gist.js';
import { canonical, mergeSyncedSettings, settingsSnapshot, syncMerge } from './merge.js';

/**
 * Синхронизация между устройствами через секретный GitHub Gist.
 *
 * Цикл синхронизации: скачать gist → слить с локальными данными (merge.js) →
 * применить результат локально → отправить в gist, если там что-то другое.
 * Запускается: при открытии сайта, через 2.5 с после любой правки,
 * при возвращении на вкладку и раз в 2 минуты, пока вкладка открыта.
 */
const SyncContext = createContext(null);

const PUSH_DELAY = 2500;
const FOCUS_MIN_INTERVAL = 15_000;
const POLL_INTERVAL = 120_000;

function localSettingsSnapshot(settings) {
  if (!settings.syncSettings) return 'off';
  return settingsSnapshot({ values: settings, updated_at: settings.settingsUpdatedAt || 0 });
}

export function SyncProvider({ children }) {
  const store = useStore();
  const { settings, actions } = store;
  const toast = useToast();

  const storeRef = useRef(store);
  storeRef.current = store;

  // off | idle | pending | syncing | error
  const [status, setStatus] = useState(settings.syncToken ? 'idle' : 'off');
  const [error, setError] = useState(null);
  const running = useRef(false);
  const rerun = useRef(false);
  const lastSynced = useRef(null); // canonical(данные) после последней успешной синхронизации
  const lastSettingsSynced = useRef(null);
  // Что сейчас применяется самой синхронизацией — эти изменения не должны запускать новую отправку.
  const inflight = useRef({ data: null, settings: null });
  const announce = useRef(false); // показать тост после первой синхронизации при подключении

  const syncNow = useCallback(
    async ({ manual = false } = {}) => {
      const token = storeRef.current.settings.syncToken;
      if (!token) return false;
      if (running.current) {
        rerun.current = true;
        return false;
      }
      running.current = true;
      setStatus('syncing');

      try {
        // 1. Найти и скачать gist.
        let gistId = storeRef.current.settings.syncGistId;
        let remoteRaw = null;
        if (gistId) {
          try {
            remoteRaw = await readGist(token, gistId);
          } catch (e) {
            if (e.code !== 'NOT_FOUND') throw e;
            gistId = ''; // gist удалили — поищем другой или создадим заново
          }
        }
        if (!gistId) {
          gistId = (await findGist(token)) ?? '';
          if (gistId) remoteRaw = await readGist(token, gistId);
        }
        const remote = remoteRaw ? normalizeData(remoteRaw, { ensureBoard: false }) : null;

        // 2. Слить данные. Редьюсер повторит слияние против самого свежего состояния.
        const current = storeRef.current;
        const merged = syncMerge(current, remote);
        const mergedCanon = canonical(merged);
        inflight.current.data = mergedCanon;
        if (mergedCanon !== canonical(current)) actions.applyRemote(remote);

        // 3. Слить настройки (ключи API, язык, источник игр).
        let settingsPayload;
        if (current.settings.syncSettings) {
          const m = mergeSyncedSettings(current.settings, remoteRaw?.settings);
          const localValues = Object.fromEntries(SYNCED_SETTING_KEYS.map((k) => [k, current.settings[k] ?? '']));
          if (
            JSON.stringify(m.values) !== JSON.stringify(localValues) ||
            m.updated_at !== (current.settings.settingsUpdatedAt || 0)
          ) {
            actions.updateSettings({ ...m.values, settingsUpdatedAt: m.updated_at });
          }
          settingsPayload = { ...m.values, updated_at: m.updated_at };
          inflight.current.settings = settingsSnapshot(settingsPayload);
        }

        // 4. Отправить, если в gist лежит не то же самое.
        const payload = {
          app: 'MediaVault',
          kind: 'sync',
          version: 1,
          synced_at: new Date().toISOString(),
          library: merged.library,
          tierLists: merged.tierLists,
          tombstones: merged.tombstones,
          ...(settingsPayload ? { settings: settingsPayload } : {}),
        };
        const remoteChanged =
          !remote ||
          mergedCanon !== canonical(remote) ||
          settingsSnapshot(settingsPayload) !== settingsSnapshot(remoteRaw?.settings ?? null);
        if (!gistId) gistId = (await createGist(token, payload)).id;
        else if (remoteChanged) await writeGist(token, gistId, payload);

        lastSynced.current = mergedCanon;
        lastSettingsSynced.current = current.settings.syncSettings
          ? settingsSnapshot(settingsPayload)
          : 'off';
        actions.updateSettings({ syncGistId: gistId, lastSyncAt: Date.now() });
        setError(null);
        setStatus('idle');
        if (announce.current) {
          announce.current = false;
          toast.success(`Синхронизация включена: в библиотеке ${pluralize(merged.library.length, TITLE_FORMS)}`);
        } else if (manual) {
          toast.success('Синхронизировано');
        }
        return true;
      } catch (e) {
        setError(e.message);
        setStatus('error');
        if (manual || announce.current) toast.error(`Синхронизация: ${e.message}`);
        announce.current = false;
        return false;
      } finally {
        inflight.current = { data: null, settings: null };
        running.current = false;
        if (rerun.current) {
          rerun.current = false;
          setTimeout(() => syncNow(), 300);
        }
      }
    },
    [actions, toast],
  );

  // Первая синхронизация — при открытии сайта и при подключении токена.
  useEffect(() => {
    if (settings.syncToken) {
      syncNow();
    } else {
      lastSynced.current = null;
      setStatus('off');
      setError(null);
    }
  }, [settings.syncToken, syncNow]);

  // Локальные правки → отправка через PUSH_DELAY (правки подряд объединяются).
  const { library, tierLists, tombstones } = store;
  const dataCanon = useMemo(
    () => (settings.syncToken ? canonical({ library, tierLists, tombstones }) : null),
    [library, tierLists, tombstones, settings.syncToken],
  );
  const settingsCanon = localSettingsSnapshot(settings);

  useEffect(() => {
    if (!settings.syncToken || lastSynced.current == null) return undefined;
    const dataSettled = dataCanon === lastSynced.current || dataCanon === inflight.current.data;
    const settingsSettled =
      settingsCanon === lastSettingsSynced.current || settingsCanon === inflight.current.settings;
    if (dataSettled && settingsSettled) return undefined;
    setStatus((s) => (s === 'syncing' ? s : 'pending'));
    const t = setTimeout(() => syncNow(), PUSH_DELAY);
    return () => clearTimeout(t);
  }, [dataCanon, settingsCanon, settings.syncToken, syncNow]);

  // Вернулись на вкладку / периодически — подтянуть изменения с других устройств.
  useEffect(() => {
    if (!settings.syncToken) return undefined;
    const maybeSync = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - (storeRef.current.settings.lastSyncAt || 0) > FOCUS_MIN_INTERVAL) syncNow();
    };
    window.addEventListener('focus', maybeSync);
    document.addEventListener('visibilitychange', maybeSync);
    const poll = setInterval(maybeSync, POLL_INTERVAL);
    return () => {
      window.removeEventListener('focus', maybeSync);
      document.removeEventListener('visibilitychange', maybeSync);
      clearInterval(poll);
    };
  }, [settings.syncToken, syncNow]);

  // Предупредить, если закрывают вкладку с неотправленными правками.
  useEffect(() => {
    if (status !== 'pending' && status !== 'syncing') return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  /** Проверяет токен и включает синхронизацию. Бросает ошибку с понятным текстом. */
  const connect = useCallback(
    async (rawToken) => {
      const token = rawToken.trim();
      const login = await getUser(token);
      announce.current = true;
      actions.updateSettings({ syncToken: token, syncLogin: login, syncGistId: '', lastSyncAt: 0 });
      return login;
    },
    [actions],
  );

  const disconnect = useCallback(() => {
    actions.updateSettings({ syncToken: '', syncGistId: '', syncLogin: '', lastSyncAt: 0 });
  }, [actions]);

  const value = useMemo(
    () => ({
      enabled: Boolean(settings.syncToken),
      status,
      error,
      login: settings.syncLogin,
      gistId: settings.syncGistId,
      lastSyncAt: settings.lastSyncAt,
      syncNow: () => syncNow({ manual: true }),
      connect,
      disconnect,
    }),
    [settings.syncToken, settings.syncLogin, settings.syncGistId, settings.lastSyncAt, status, error, syncNow, connect, disconnect],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync() должен вызываться внутри <SyncProvider>');
  return ctx;
}
