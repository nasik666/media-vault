import { MEDIA_TYPES, MEDIA_TYPE_KEYS, statusLabel } from '../constants.js';
import { downloadBlob, formatDate, localDateStamp, metaLine } from './helpers.js';

/** Колонки CSV: [заголовок, функция получения значения]. */
const COLUMNS = [
  ['Тип', (i) => MEDIA_TYPES[i.media_type]?.label ?? i.media_type],
  ['Название', (i) => i.title],
  ['Оригинальное название', (i) => i.original_title ?? ''],
  ['Год', (i) => i.year ?? ''],
  ['Оценка', (i) => i.user_rating ?? ''],
  ['Статус', (i) => statusLabel(i.status, i.media_type)],
  ['Заметки', (i) => i.notes ?? ''],
  ['Платформы / формат', (i) => metaLine(i)],
  ['Добавлено', (i) => new Date(i.added_at).toLocaleDateString('ru-RU')],
];

function csvCell(value) {
  if (typeof value === 'number') return String(value);
  let s = String(value ?? '');
  // Защита от «формул»: Excel выполнил бы ячейку, начинающуюся с = + - @
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV для Excel / Google Таблиц.
 * Разделитель «;» и BOM — так русский Excel открывает файл двойным кликом
 * без «кракозябр» и без мастера импорта.
 */
export function buildRatingsCsv(items) {
  const rows = [COLUMNS.map(([title]) => title), ...items.map((item) => COLUMNS.map(([, get]) => get(item)))];
  return `﻿${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export function downloadRatingsCsv(items) {
  const blob = new Blob([buildRatingsCsv(items)], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `mediavault-ratings-${localDateStamp()}.csv`);
}

/** Текстовый список для мессенджера/заметок. Порядок внутри групп сохраняется. */
export function buildRatingsText(items) {
  const lines = [`Мои оценки — MediaVault, ${formatDate(Date.now())}`];
  for (const type of MEDIA_TYPE_KEYS) {
    const group = items.filter((i) => i.media_type === type);
    if (!group.length) continue;
    lines.push('', `${MEDIA_TYPES[type].plural.toUpperCase()} (${group.length})`);
    for (const i of group) {
      const rating = i.user_rating ? `${i.user_rating}/10` : '—/10';
      const year = i.year ? ` (${i.year})` : '';
      lines.push(`${rating} · ${i.title}${year} · ${statusLabel(i.status, i.media_type)}`);
    }
  }
  return lines.join('\n');
}

/** Все тайтлы: сначала по оценке (без оценки — в конце), затем по названию. */
export function sortByRating(items) {
  const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
  return [...items].sort(
    (a, b) => (b.user_rating ?? -1) - (a.user_rating ?? -1) || collator.compare(a.title, b.title),
  );
}
