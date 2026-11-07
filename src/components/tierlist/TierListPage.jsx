import { useState } from 'react';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { MEDIA_TYPES, MEDIA_TYPE_KEYS, STATUSES, statusLabel } from '../../constants.js';
import { useStore } from '../../store/StoreContext.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Button, Field, Select, inputClass } from '../ui/primitives.jsx';
import { useToast } from '../ui/Toast.jsx';
import { TierBoard } from './TierBoard.jsx';

const TYPE_OPTIONS = [
  { value: 'all', label: 'Все типы' },
  ...MEDIA_TYPE_KEYS.map((k) => ({ value: k, label: MEDIA_TYPES[k].plural })),
];

function BoardSettingsModal({ board, onClose, onSubmit }) {
  const [name, setName] = useState(board?.name ?? '');
  const [mediaType, setMediaType] = useState(board?.filter.mediaType ?? 'all');
  const [status, setStatus] = useState(board?.filter.status ?? 'any');

  const statusOptions = [
    { value: 'any', label: 'Любой статус' },
    ...STATUSES.map((s) => ({ value: s, label: statusLabel(s, mediaType === 'all' ? undefined : mediaType) })),
  ];

  const submit = () =>
    onSubmit({
      name: name.trim() || (board ? board.name : 'Новый тир-лист'),
      filter: { mediaType, status },
    });

  return (
    <Modal
      title={board ? 'Параметры тир-листа' : 'Новый тир-лист'}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit}>
            {board ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Название" htmlFor="board-name">
          <input
            id="board-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Например: Игры 2025 или Лучшие аниме"
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="Какие тайтлы попадают в пул" hint="Тир-лист берёт тайтлы из библиотеки по этому фильтру.">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={mediaType} onChange={setMediaType} options={TYPE_OPTIONS} aria-label="Тип медиа" />
            <Select value={status} onChange={setStatus} options={statusOptions} aria-label="Статус" />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export function TierListPage({ onOpenItem }) {
  const { tierLists, activeTierListId, actions } = useStore();
  const toast = useToast();
  const [dialog, setDialog] = useState(null); // 'create' | 'edit' | null
  const board = tierLists.find((b) => b.id === activeTierListId) ?? tierLists[0];

  const remove = () => {
    if (!window.confirm(`Удалить тир-лист «${board.name}»? Тайтлы останутся в библиотеке.`)) return;
    actions.deleteTierList(board.id);
    toast.info('Тир-лист удалён');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={board.id}
          onChange={actions.selectTierList}
          options={tierLists.map((b) => ({ value: b.id, label: b.name }))}
          className="min-w-48 flex-1 sm:max-w-xs sm:flex-none"
          aria-label="Выбор тир-листа"
        />
        <Button icon={Plus} onClick={() => setDialog('create')}>
          Новый
        </Button>
        <Button icon={Settings2} onClick={() => setDialog('edit')}>
          Параметры
        </Button>
        <Button variant="ghost" size="icon" icon={Trash2} onClick={remove} title="Удалить тир-лист" aria-label="Удалить тир-лист" />
      </div>

      <TierBoard key={board.id} board={board} onOpenItem={onOpenItem} />

      {dialog && (
        <BoardSettingsModal
          board={dialog === 'edit' ? board : null}
          onClose={() => setDialog(null)}
          onSubmit={(values) => {
            if (dialog === 'create') actions.createTierList({ name: values.name, ...values.filter });
            else actions.updateTierList(board.id, values);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
