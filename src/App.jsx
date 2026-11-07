import { useCallback, useEffect, useState } from 'react';
import { useBackup } from './components/Backup.jsx';
import { Header } from './components/Header.jsx';
import { ItemEditor } from './components/ItemEditor.jsx';
import { Library } from './components/library/Library.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { TierListPage } from './components/tierlist/TierListPage.jsx';
import { useStore } from './store/StoreContext.jsx';

/** Вкладка хранится в hash (#/library, #/tiers) — на GitHub Pages не нужен 404-хак для роутера. */
function useHashTab() {
  const read = () => (window.location.hash.replace(/^#\/?/, '') === 'tiers' ? 'tiers' : 'library');
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onHash = () => {
      setTab(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((next) => {
    window.location.hash = `/${next}`;
  }, []);
  return [tab, go];
}

export default function App() {
  const { libraryByUid } = useStore();
  const [tab, setTab] = useHashTab();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // { mode: 'add', item: searchResult } | { mode: 'edit', uid }
  const [editor, setEditor] = useState(null);
  const backup = useBackup();

  const openSettings = useCallback(() => setSettingsOpen(true), []);

  const openSearchResult = useCallback(
    (result) => {
      const uid = `${result.media_type}:${result.id}`;
      setEditor(libraryByUid.has(uid) ? { mode: 'edit', uid } : { mode: 'add', item: result });
    },
    [libraryByUid],
  );

  const openItem = useCallback((item) => setEditor({ mode: 'edit', uid: item.uid }), []);
  const openManual = useCallback(
    (prefill = {}) => setEditor({ mode: 'manual', item: { title: '', media_type: 'movie', ...prefill } }),
    [],
  );
  const closeEditor = useCallback(() => setEditor(null), []);

  const editorItem = editor?.mode === 'edit' ? libraryByUid.get(editor.uid) : editor?.item;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        tab={tab}
        onTab={setTab}
        onPickResult={openSearchResult}
        onManualAdd={openManual}
        onOpenSettings={openSettings}
        onExport={backup.exportBackup}
        onImport={backup.startImport}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {tab === 'library' ? (
          <Library onOpenItem={openItem} onOpenSettings={openSettings} onManualAdd={openManual} />
        ) : (
          <TierListPage onOpenItem={openItem} />
        )}
      </main>

      <footer className="border-t border-white/5 px-4 py-5 text-center text-xs leading-relaxed text-zinc-600">
        Данные и постеры:{' '}
        <a className="hover:text-zinc-400" href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          TMDB
        </a>
        ,{' '}
        <a className="hover:text-zinc-400" href="https://www.wikipedia.org/" target="_blank" rel="noreferrer">
          Википедия
        </a>
        ,{' '}
        <a className="hover:text-zinc-400" href="https://anilist.co/" target="_blank" rel="noreferrer">
          AniList
        </a>
        ,{' '}
        <a className="hover:text-zinc-400" href="https://rawg.io/" target="_blank" rel="noreferrer">
          RAWG
        </a>
        . This product uses the TMDB API but is not endorsed or certified by TMDB.
        <br />
        Все данные хранятся только в этом браузере (localStorage).
      </footer>

      {editor && editorItem && (
        <ItemEditor key={editor.uid ?? editor.item.id ?? 'manual'} mode={editor.mode} item={editorItem} onClose={closeEditor} />
      )}
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} onExport={backup.exportBackup} onImport={backup.startImport} />
      )}
      {backup.element}
    </div>
  );
}
