import { ANIME_FORMATS } from '../constants.js';

/** Уникальный id. crypto.randomUUID есть на https и localhost (GitHub Pages — https). */
export function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Русская плюрализация: plural(5, ['тайтл', 'тайтла', 'тайтлов']) → 'тайтлов' */
export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const pluralize = (n, forms) => `${n} ${plural(n, forms)}`;
export const TITLE_FORMS = ['тайтл', 'тайтла', 'тайтлов'];

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Локальная дата YYYY-MM-DD для имён файлов (toISOString дал бы дату по UTC). */
export function localDateStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'tierlist'
  );
}

/** Tailwind-классы бейджа оценки. */
export function ratingTone(rating) {
  if (!rating) return 'bg-zinc-800 text-zinc-400';
  if (rating >= 9) return 'bg-violet-500 text-white';
  if (rating >= 7) return 'bg-emerald-500 text-emerald-950';
  if (rating >= 5) return 'bg-amber-400 text-amber-950';
  return 'bg-rose-500 text-white';
}

/** Вторая строка карточки: платформы для игр, формат/эпизоды для аниме. */
export function metaLine(item) {
  const meta = item.meta ?? {};
  if (item.media_type === 'game' && meta.platforms?.length) return meta.platforms.join(', ');
  if (item.media_type === 'anime') {
    const parts = [];
    if (meta.format) parts.push(ANIME_FORMATS[meta.format] ?? meta.format);
    if (meta.episodes) parts.push(`${meta.episodes} эп.`);
    return parts.join(' · ');
  }
  return '';
}

/** Чёрный или белый текст поверх произвольного hex-цвета (для подписей рангов). */
export function readableTextColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return '#111111';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#111111' : '#ffffff';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(data, filename) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

/** true, если фокус в поле ввода (чтобы горячие клавиши не мешали печатать). */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
