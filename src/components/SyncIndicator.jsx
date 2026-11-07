import { Cloud, CloudCheck, CloudOff, CloudUpload, RefreshCw } from 'lucide-react';
import { useSync } from '../sync/SyncProvider.jsx';

function timeAgo(ts) {
  if (!ts) return 'ещё не было';
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return 'только что';
  if (sec < 3600) return `${Math.round(sec / 60)} мин назад`;
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const VIEW = {
  idle: { icon: CloudCheck, cls: 'text-emerald-400' },
  pending: { icon: CloudUpload, cls: 'text-amber-300' },
  syncing: { icon: RefreshCw, cls: 'text-sky-300 animate-spin' },
  error: { icon: CloudOff, cls: 'text-rose-400' },
};

/** Значок в шапке: состояние синхронизации; клик — синхронизировать сейчас. */
export function SyncIndicator({ onOpenSettings }) {
  const sync = useSync();
  if (!sync.enabled) return null;

  const { icon: Icon, cls } = VIEW[sync.status] ?? { icon: Cloud, cls: 'text-zinc-400' };
  const title =
    sync.status === 'error'
      ? `Ошибка синхронизации: ${sync.error}. Нажмите, чтобы повторить`
      : sync.status === 'pending'
        ? 'Есть изменения — скоро отправлю в gist'
        : sync.status === 'syncing'
          ? 'Синхронизация…'
          : `Синхронизировано (${timeAgo(sync.lastSyncAt)}). Нажмите, чтобы обновить`;

  return (
    <button
      type="button"
      onClick={() => (sync.status === 'error' && sync.error?.includes('Токен') ? onOpenSettings() : sync.syncNow())}
      title={title}
      aria-label={title}
      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/5"
    >
      <Icon size={17} className={cls} />
    </button>
  );
}

export { timeAgo };
