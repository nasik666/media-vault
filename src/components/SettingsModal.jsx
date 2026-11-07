import { useId, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { testRawgKey } from '../api/rawg.js';
import { testTmdbKey } from '../api/tmdb.js';
import { useStore } from '../store/StoreContext.jsx';
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

export function SettingsModal({ onClose, onExport, onImport }) {
  const { settings, library, tierLists, actions } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [includeKeys, setIncludeKeys] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    actions.updateSettings({ ...draft, tmdbKey: draft.tmdbKey.trim(), rawgKey: draft.rawgKey.trim() });
    toast.success('Настройки сохранены');
    onClose();
  };

  const wipe = () => {
    const msg = `Удалить всю библиотеку (${pluralize(library.length, TITLE_FORMS)}) и все тир-листы (${tierLists.length})? API-ключи останутся. Отменить нельзя — сначала сделайте экспорт.`;
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
        <section className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Источники и ключи</h3>
          <p className="text-sm text-zinc-400">
            Ключи вводятся один раз — браузер их запомнит. Заново понадобятся только на другом устройстве или после
            очистки данных сайта (перенести можно JSON-бэкапом с ключами).
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
