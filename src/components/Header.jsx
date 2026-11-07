import { Download, LayoutList, LibraryBig, Settings, Upload } from 'lucide-react';
import { useStore } from '../store/StoreContext.jsx';
import { SearchBar } from './search/SearchBar.jsx';
import { Button } from './ui/primitives.jsx';

const TABS = [
  { id: 'library', label: 'Библиотека', icon: LibraryBig },
  { id: 'tiers', label: 'Тир-листы', icon: LayoutList },
];

export function Header({ tab, onTab, onPickResult, onManualAdd, onOpenSettings, onExport, onImport }) {
  const { library } = useStore();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-3 px-4 py-3 sm:gap-x-4">
        <a href="#/library" className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-50">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
          <span className="hidden sm:inline">MediaVault</span>
        </a>

        <nav className="flex rounded-lg bg-zinc-900 p-1 ring-1 ring-white/5" aria-label="Разделы">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors sm:px-3 ${
                tab === id ? 'bg-zinc-700 font-medium text-white' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Icon size={15} />
              {label}
              {id === 'library' && library.length > 0 && (
                <span className="text-xs text-zinc-500 tabular-nums">{library.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="order-last w-full md:order-none md:w-auto md:min-w-0 md:flex-1">
          <SearchBar onPick={onPickResult} onManualAdd={onManualAdd} onOpenSettings={onOpenSettings} />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {/* На телефоне экспорт/импорт доступны в настройках — экономим место в шапке */}
          <div className="hidden items-center gap-1 sm:flex">
            <Button variant="ghost" size="icon" icon={Download} onClick={() => onExport()} title="Экспорт в JSON" aria-label="Экспорт в JSON" />
            <Button variant="ghost" size="icon" icon={Upload} onClick={onImport} title="Импорт из JSON" aria-label="Импорт из JSON" />
          </div>
          <Button variant="ghost" size="icon" icon={Settings} onClick={onOpenSettings} title="Настройки" aria-label="Настройки" />
        </div>
      </div>
    </header>
  );
}
