import { useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudCheck,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Unlink,
  Upload,
} from 'lucide-react';
import { testRawgKey } from '../api/rawg.js';
import { testTmdbKey } from '../api/tmdb.js';
import { useStore } from '../store/StoreContext.jsx';
import { SYNCED_SETTING_KEYS } from '../store/storage.js';
import { NEW_TOKEN_URL } from '../sync/gist.js';
import { useSync } from '../sync/SyncProvider.jsx';
import { timeAgo } from './SyncIndicator.jsx';
import { downloadRatingsCsv, sortByRating } from '../utils/exportRatings.js';
import { pluralize, TITLE_FORMS } from '../utils/helpers.js';
import { Modal } from './ui/Modal.jsx';
import { Button, Field, Select, inputClass } from './ui/primitives.jsx';
import { useToast } from './ui/Toast.jsx';

function KeyField({ label, value, onChange, onTest, placeholder, hint }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [test, setTest] = useState({ state: 'idle', message: '' });

  const run = async () => {
    setTest({ state: 'loading', message: '' });
    try {
      await onTest(value);
      setTest({ state: 'ok', message: 'Ключ работает' });
    } catch (e) {
      setTest({ state: 'error', message: e.message });
    }
  };

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setTest({ state: 'idle', message: '' });
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} pr-10 font-mono text-xs`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:text-zinc-200"
            aria-label={visible ? 'Скрыть ключ' : 'Показать ключ'}
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <Button onClick={run} disabled={!value.trim() || test.state === 'loading'}>
          {test.state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : 'Проверить'}
        </Button>
      </div>
      {test.state === 'ok' && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 size={13} /> {test.message}
        </p>
      )}
      {test.state === 'error' && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400">
          <TriangleAlert size={13} /> {test.message}
        </p>
      )}
    </Field>
  );
}

const ExtLink = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer noopener"
    className="inline-flex items-center gap-0.5 text-violet-300 underline-offset-2 hover:underline"
  >
    {children}
    <ExternalLink size={11} />
  </a>
);

const STATUS_TEXT = {
  idle: 'всё синхронизировано',
  pending: 'есть изменения, отправляю…',
  syncing: 'синхронизация…',
  error: 'ошибка',
};

function SyncSection() {
  const sync = useSync();
  const { settings, actions } = useStore();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await sync.connect(token);
      setToken('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    if (!window.confirm('Выключить синхронизацию на этом устройстве? Токен будет забыт, данные останутся и здесь, и в gist.')) return;
    sync.disconnect();
  };

  return (
    <section className="space-y-3 rounded-xl bg-sky-500/5 p-4 ring-1 ring-sky-500/20">
      <h3 className="text-xs font-semibold tracking-wider text-sky-300/80 uppercase">Синхронизация между устройствами</h3>

      {!sync.enabled ? (
        <>
          <p className="text-sm text-zinc-300">
            Библиотека, оценки и тир-листы хранятся в секретном gist в вашем GitHub и совпадают на ПК, Mac и телефоне.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-400">
            <li>
              <ExtLink href={NEW_TOKEN_URL}>Создайте токен на GitHub</ExtLink> — галочка «gist» уже стоит. В Expiration
              выберите «No expiration» (или срок, после которого токен придётся заменить), нажмите Generate token и
              скопируйте его.
            </li>
            <li>Вставьте токен сюда и нажмите «Подключить». На других устройствах — тот же токен.</li>
          </ol>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && token.trim() && connect()}
              placeholder="ghp_…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Токен GitHub"
              className={`${inputClass} font-mono text-xs`}
            />
            <Button variant="primary" onClick={connect} disabled={!token.trim() || busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : 'Подключить'}
            </Button>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-rose-400">
              <TriangleAlert size={13} /> {error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-zinc-500">
            Токен хранится только в этом браузере и даёт доступ лишь к вашим gist. Секретный gist не виден в поиске и
            профиле, но открывается по прямой ссылке — там будут названия, оценки и заметки.
          </p>
        </>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-300">
            <CloudCheck size={16} className="text-emerald-400" />
            Подключено: <b className="text-zinc-100">{sync.login}</b>
            <span className="text-zinc-500">
              · {STATUS_TEXT[sync.status] ?? ''} · {timeAgo(sync.lastSyncAt)}
            </span>
          </p>
          {sync.status === 'error' && (
            <p className="flex items-center gap-1.5 text-xs text-rose-400">
              <TriangleAlert size={13} /> {sync.error}
            </p>
          )}
          <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={settings.syncSettings}
              onChange={(e) => actions.updateSettings({ syncSettings: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-sky-500"
            />
            <span>
              Синхронизировать и API-ключи с настройками
              <span className="block text-xs text-zinc-500">
                На новом устройстве достаточно токена GitHub — ключ TMDB подтянется сам.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button icon={RefreshCw} onClick={sync.syncNow} disabled={sync.status === 'syncing'}>
              Синхронизировать
            </Button>
            {sync.gistId && (
              <Button onClick={() => window.open(`https://gist.github.com/${sync.gistId}`, '_blank', 'noopener')}>
                Открыть gist
              </Button>
            )}
            <Button variant="ghost" icon={Unlink} onClick={disconnect}>
              Отключить здесь
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export function SettingsModal({ onClose, onExport, onImport }) {
  const { settings, library, tierLists, actions } = useStore();
  const sync = useSync();
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [includeKeys, setIncludeKeys] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // Значения, пришедшие с синхронизацией, подхватываем в поля, которые пользователь не трогал.
  const seen = useRef(settings);
  useEffect(() => {
    setDraft((d) => {
      const next = { ...d };
      for (const k of SYNCED_SETTING_KEYS) if (d[k] === seen.current[k]) next[k] = settings[k];
      return next;
    });
    seen.current = settings;
  }, [settings]);

  const save = () => {
    // Сохраняем только реально изменённые поля — чтобы случайно не затереть ключ, пришедший с другого устройства.
    const patch = {};
    for (const k of SYNCED_SETTING_KEYS) {
      const value = typeof draft[k] === 'string' ? draft[k].trim() : draft[k];
      if (value !== settings[k]) patch[k] = value;
    }
    if (Object.keys(patch).length) actions.updateSettings({ ...patch, settingsUpdatedAt: Date.now() });
    toast.success('Настройки сохранены');
    onClose();
  };

  const wipe = () => {
    const msg = `Удалить всю библиотеку (${pluralize(library.length, TITLE_FORMS)}) и все тир-листы (${tierLists.length})? API-ключи останутся.${sync.enabled ? ' Удаление разойдётся на все синхронизированные устройства.' : ''} Отменить нельзя — сначала сделайте экспорт.`;
    if (!window.confirm(msg)) return;
    actions.resetAll();
    toast.info('Данные очищены');
    onClose();
  };

  return (
    <Modal
      title="Настройки"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <SyncSection />

        <section className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Источники и ключи</h3>
          <p className="text-sm text-zinc-400">
            Ключи вводятся один раз — браузер их запомнит. С включённой синхронизацией ключей на других устройствах
            вводить их не нужно.
          </p>
          <KeyField
            label="TMDB — фильмы и сериалы"
            value={draft.tmdbKey}
            onChange={(tmdbKey) => set({ tmdbKey })}
            onTest={testTmdbKey}
            placeholder="API Key (v3) или API Read Access Token (v4)"
            hint={
              <>
                Бесплатно: <ExtLink href="https://www.themoviedb.org/settings/api">themoviedb.org → Settings → API</ExtLink>.
                Подходит и короткий ключ v3, и длинный токен v4 (eyJ…).
              </>
            }
          />
          <Field
            label="Игры"
            hint={
              draft.gameSource === 'rawg'
                ? 'RAWG даёт платформы и хорошие обложки, но иногда бывает недоступен.'
                : 'Ищет по русской и английской Википедии: обложка, год, название на двух языках. Ключ не нужен.'
            }
          >
            <Select
              value={draft.gameSource}
              onChange={(gameSource) => set({ gameSource })}
              options={[
                { value: 'wikipedia', label: 'Википедия — без ключа' },
                { value: 'rawg', label: 'RAWG — нужен ключ' },
              ]}
            />
          </Field>
          {draft.gameSource === 'rawg' && (
            <KeyField
              label="Ключ RAWG"
              value={draft.rawgKey}
              onChange={(rawgKey) => set({ rawgKey })}
              onTest={testRawgKey}
              placeholder="API Key"
              hint={
                <>
                  Бесплатно: <ExtLink href="https://rawg.io/apidocs">rawg.io/apidocs</ExtLink> → Get API Key.
                </>
              }
            />
          )}
          <p className="rounded-lg bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-500 ring-1 ring-white/5">
            Ключи хранятся только в localStorage этого браузера и уходят напрямую в TMDB/RAWG. Аниме (AniList) и игры
            из Википедии ищутся без ключа. Сайт на GitHub Pages публичный, но ключи видны только в вашем браузере.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Язык названий (TMDB, Википедия)">
            <Select
              value={draft.tmdbLanguage}
              onChange={(tmdbLanguage) => set({ tmdbLanguage })}
              options={[
                { value: 'ru-RU', label: 'Русский' },
                { value: 'en-US', label: 'English' },
              ]}
            />
          </Field>
          <Field label="Названия аниме (AniList)">
            <Select
              value={draft.animeTitle}
              onChange={(animeTitle) => set({ animeTitle })}
              options={[
                { value: 'english', label: 'English' },
                { value: 'romaji', label: 'Romaji (Shingeki no Kyojin)' },
                { value: 'native', label: 'Оригинал (進撃の巨人)' },
              ]}
            />
          </Field>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Бэкап</h3>
          <p className="text-sm text-zinc-400">
            В базе {pluralize(library.length, TITLE_FORMS)} и {tierLists.length} тир-лист(ов). localStorage может
            очиститься вместе с данными сайта — периодически сохраняйте JSON.
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={includeKeys}
              onChange={(e) => setIncludeKeys(e.target.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            Включить API-ключи в файл (не делитесь таким файлом)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button icon={Download} onClick={() => onExport({ includeKeys })}>
              Экспорт в JSON
            </Button>
            <Button icon={Upload} onClick={onImport}>
              Импорт из JSON
            </Button>
            <Button
              icon={FileSpreadsheet}
              disabled={library.length === 0}
              onClick={() => {
                downloadRatingsCsv(sortByRating(library));
                toast.success(`CSV с оценками сохранён: ${pluralize(library.length, TITLE_FORMS)}`);
              }}
            >
              Оценки в CSV
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            JSON — полный бэкап для восстановления. CSV — таблица оценок для Excel/Google Таблиц (обратно не
            импортируется). Выгрузить только отфильтрованное можно кнопкой «Экспорт» в библиотеке.
          </p>
        </section>

        <section className="space-y-3 border-t border-white/5 pt-5">
          <h3 className="text-xs font-semibold tracking-wider text-rose-400/80 uppercase">Опасная зона</h3>
          <Button variant="danger" icon={Trash2} onClick={wipe}>
            Очистить библиотеку и тир-листы
          </Button>
        </section>
      </div>
    </Modal>
  );
}
