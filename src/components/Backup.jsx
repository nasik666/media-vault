import { useCallback, useRef, useState } from 'react';
import { FileJson, KeyRound, TriangleAlert } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { buildBackup, mergeData, parseBackup, SYNCED_SETTING_KEYS } from '../store/storage.js';
import { downloadJson, localDateStamp, pluralize, TITLE_FORMS } from '../utils/helpers.js';
import { Modal } from './ui/Modal.jsx';
import { Button } from './ui/primitives.jsx';
import { useToast } from './ui/Toast.jsx';

/**
 * Экспорт/импорт всей базы.
 * Возвращает функции для кнопок и элемент (скрытый <input type=file> + диалог импорта), который надо отрендерить.
 */
export function useBackup() {
  const store = useStore();
  const toast = useToast();
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null);

  const exportBackup = useCallback(
    ({ includeKeys = false } = {}) => {
      const backup = buildBackup(store, store.settings, { includeKeys });
      downloadJson(backup, `mediavault-backup-${localDateStamp()}.json`);
      toast.success(`Экспортировано: ${pluralize(backup.library.length, TITLE_FORMS)}, тир-листов: ${backup.tierLists.length}`);
    },
    [store, toast],
  );

  const startImport = useCallback(() => inputRef.current?.click(), []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // чтобы можно было выбрать тот же файл повторно
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      setPending({ ...parsed, fileName: file.name });
    } catch (err) {
      toast.error(`Импорт не удался: ${err.message}`);
    }
  };

  const apply = (mode) => {
    const { data, settings } = pending;
    const total = mode === 'replace' ? data.library.length : mergeData(store, data).library.length;
    store.actions.importData(mode, data);
    if (Object.keys(settings).length) {
      // Импортированные ключи/язык считаются свежей правкой — уедут на другие устройства при синхронизации.
      const touchesSynced = SYNCED_SETTING_KEYS.some((k) => k in settings);
      store.actions.updateSettings(touchesSynced ? { ...settings, settingsUpdatedAt: Date.now() } : settings);
    }
    toast.success(
      mode === 'replace'
        ? `Импортировано: ${pluralize(total, TITLE_FORMS)}`
        : `Объединено: теперь в библиотеке ${pluralize(total, TITLE_FORMS)}`,
    );
    setPending(null);
  };

  const element = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
        aria-hidden="true"
        tabIndex={-1}
      />
      {pending && (
        <Modal
          title="Импорт бэкапа"
          size="sm"
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Отмена
              </Button>
              <Button variant="danger" onClick={() => apply('replace')}>
                Заменить всё
              </Button>
              <Button variant="primary" onClick={() => apply('merge')}>
                Объединить
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3 rounded-lg bg-zinc-950/60 p-3 ring-1 ring-white/5">
              <FileJson size={20} className="shrink-0 text-violet-300" />
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-200">{pending.fileName}</div>
                <div className="text-xs text-zinc-500">
                  {pluralize(pending.data.library.length, TITLE_FORMS)} · тир-листов: {pending.data.tierLists.length}
                </div>
              </div>
            </div>
            {pending.skipped > 0 && (
              <p className="flex items-start gap-2 text-amber-300">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                Пропущено записей (повреждённые или дубли): {pending.skipped}
              </p>
            )}
            {pending.hasKeys && (
              <p className="flex items-start gap-2 text-sky-300">
                <KeyRound size={15} className="mt-0.5 shrink-0" />
                Файл содержит API-ключи — они заменят текущие.
              </p>
            )}
            <ul className="space-y-1.5 text-zinc-400">
              <li>
                <b className="text-zinc-200">Объединить</b> — новые тайтлы добавятся, совпадающие обновятся (побеждает
                более свежая правка), тир-листы с одинаковым id заменятся.
              </li>
              <li>
                <b className="text-zinc-200">Заменить всё</b> — текущая библиотека ({pluralize(store.library.length, TITLE_FORMS)})
                будет удалена.
              </li>
            </ul>
          </div>
        </Modal>
      )}
    </>
  );

  return { exportBackup, startImport, element };
}
