import { useState } from 'react';
import { Eraser, Trash2 } from 'lucide-react';
import { TIER_COLOR_PRESETS } from '../../constants.js';
import { readableTextColor } from '../../utils/helpers.js';
import { Modal } from '../ui/Modal.jsx';
import { Button, Field, inputClass } from '../ui/primitives.jsx';

export function TierEditor({ tier, canDelete, onClose, onSave, onClear, onDelete }) {
  const [label, setLabel] = useState(tier.label);
  const [color, setColor] = useState(tier.color);

  const save = () => {
    onSave({ label: label.trim() || tier.label, color });
    onClose();
  };

  return (
    <Modal
      title="Настройка ранга"
      size="sm"
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
      <div className="space-y-5">
        <div
          className="flex h-20 items-center justify-center rounded-lg text-3xl font-bold break-all"
          style={{ backgroundColor: color, color: readableTextColor(color) }}
        >
          {label || ' '}
        </div>

        <Field label="Название" htmlFor="tier-label" hint="Можно букву (S, A…) или текст: «Шедевр», «Мусор».">
          <input
            id="tier-label"
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 40))}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field label="Цвет">
          <div className="flex flex-wrap items-center gap-2">
            {TIER_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-lg ring-offset-2 ring-offset-zinc-900 ${color === c ? 'ring-2 ring-white' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Цвет ${c}`}
              />
            ))}
            <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-lg ring-1 ring-white/20" title="Свой цвет">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute -inset-2 h-12 w-12 cursor-pointer"
              />
            </label>
          </div>
        </Field>

        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
          <Button
            size="sm"
            icon={Eraser}
            onClick={() => {
              onClear();
              onClose();
            }}
            disabled={tier.items.length === 0}
          >
            Очистить ранг
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            disabled={!canDelete}
            onClick={() => {
              if (!window.confirm(`Удалить ранг «${tier.label}»? Его тайтлы вернутся в «Нераспределённое».`)) return;
              onDelete();
              onClose();
            }}
          >
            Удалить ранг
          </Button>
        </div>
      </div>
    </Modal>
  );
}
